import {
  CredoError,
  DidsApi,
  getKeyFromVerificationMethod,
  Key,
  KeyType,
  TypedArrayEncoder,
} from "@credo-ts/core";
import { agent } from ".";
import {
  IndyVdrDidCreateOptions,
  IndyVdrPoolService,
} from "@credo-ts/indy-vdr";
import { SOV_ENDORSER_NYM, SOV_ENDORSER_SEED } from "../constants";
import { sleep } from "../utils";
import { AttribRequest, NymRequest } from "@hyperledger/indy-vdr-nodejs";

async function importRegisteredEndorserDid() {
  const did = `did:indy:bcovrin:test:${SOV_ENDORSER_NYM}`;
  await agent.dids.import({
    did: did,
    overwrite: true,
    privateKeys: [
      {
        privateKey: TypedArrayEncoder.fromString(SOV_ENDORSER_SEED!),
        keyType: KeyType.Ed25519,
      },
    ],
  });
  return did;
}

export async function setupFirstIssuerDidSov(
  assertionKey: Key
): Promise<string> {
  let endorserDid = await importRegisteredEndorserDid();

  const createResult = await agent.dids.create<IndyVdrDidCreateOptions>({
    method: "indy",
    options: {
      endorserMode: "internal",
      endorserDid: endorserDid,
    },
  });

  let qualifiedIndyDid = createResult.didState.did;

  if (!qualifiedIndyDid) {
    throw new Error(
      `Did was not created. ${
        createResult.didState.state === "failed"
          ? createResult.didState.reason
          : "Not finished"
      }`
    );
  }

  // transform to legacy sov DID
  let sovDid = `did:sov:${qualifiedIndyDid.split(":").reverse()[0]}`;

  await rotateDidSovVerkey(sovDid, assertionKey.publicKeyBase58);

  // Wait some time pass to let ledger settle the object
  await sleep(2000);

  return sovDid;
}

export async function updateDidSovDocumentWithAlsoKnownAs(
  didToUpdate: string,
  newDid: string
) {
  const nym = didToUpdate.split(":").reverse()[0];
  const didKey = await verificationKeyForSovDid(didToUpdate);

  const pool = agent.context.dependencyManager
    .resolve(IndyVdrPoolService)
    .getPoolForNamespace("bcovrin:test");

  const attribRequest = new AttribRequest({
    submitterDid: nym,
    targetDid: nym,
    raw: JSON.stringify({ alsoKnownAs: [newDid] }),
  });

  const writeRequest = await pool.prepareWriteRequest(
    agent.context,
    attribRequest,
    didKey,
    undefined
  );

  const response = await pool.submitRequest(writeRequest);

  console.log(JSON.stringify(response));

  // Wait some time pass to let ledger settle the object
  await sleep(2000);
}

async function rotateDidSovVerkey(did: string, verkey: string) {
  const nym = did.split(":").reverse()[0];
  const didKey = await verificationKeyForSovDid(did);

  const pool = agent.context.dependencyManager
    .resolve(IndyVdrPoolService)
    .getPoolForNamespace("bcovrin:test");

  const nullNymRequest = new NymRequest({
    submitterDid: nym,
    dest: nym,
    verkey: verkey,
  });

  const writeRequest = await pool.prepareWriteRequest(
    agent.context,
    nullNymRequest,
    didKey,
    undefined
  );

  const response = await pool.submitRequest(writeRequest);

  console.log(JSON.stringify(response));
}

export async function deactivateDidSov(did: string) {
  await rotateDidSovVerkey(
    did,
    TypedArrayEncoder.toBase58(
      TypedArrayEncoder.fromHex(
        "000000000000000000000000000000000000000000000000000000000000dead"
      )
    )
  );
  // Wait some time pass to let ledger settle the object
  await sleep(2000);
}

async function verificationKeyForSovDid(did: string) {
  // FIXME: we should store the didDocument in the DidRecord so we don't have to fetch our own did
  // from the ledger to know which key is associated with the did
  const didResult = await agent.dids.resolve(did);

  if (!didResult.didDocument) {
    throw new CredoError(
      `Could not resolve did ${did}. ${didResult.didResolutionMetadata.error} ${didResult.didResolutionMetadata.message}`
    );
  }

  // did:sov dids MUST have a verificationMethod with #key-1
  const verificationMethod = didResult.didDocument.dereferenceKey(
    `${did}#key-1`
  );
  const key = getKeyFromVerificationMethod(verificationMethod);

  return key;
}
