import {
  CheqdDidCreateOptions,
  CheqdDidDeactivateOptions,
} from "@credo-ts/cheqd";
import { randomUUID } from "crypto";
import { agent } from ".";
import {
  DidDocument,
  JsonTransformer,
  Key,
  VerificationMethod,
} from "@credo-ts/core";

export async function setupFirstIssuerDidCheqd(
  assertionKey: Key
): Promise<string> {
  let issuerDid = `did:cheqd:testnet:${randomUUID()}`;
  await agent.dids.create<CheqdDidCreateOptions>({
    method: "cheqd",
    secret: {},
    options: {},
    didDocument: new DidDocument({
      id: issuerDid,
      controller: [issuerDid],
      verificationMethod: [
        {
          id: `${issuerDid}#key-1`,
          type: "Ed25519VerificationKey2018",
          controller: issuerDid,
          publicKeyBase58: assertionKey.publicKeyBase58,
        },
      ],
      authentication: [`${issuerDid}#key-1`],
      assertionMethod: [`${issuerDid}#key-1`],
    }),
  });

  return issuerDid;
}

export async function setupSecondIssuerDidCheqd(
  assertionKey: Key,
  oldDid: string
): Promise<string> {
  let issuerDid = `did:cheqd:testnet:${randomUUID()}`;
  await agent.dids.create<CheqdDidCreateOptions>({
    method: "cheqd",
    secret: {},
    options: {},
    didDocument: new DidDocument({
      id: issuerDid,
      alsoKnownAs: [oldDid],
      controller: [issuerDid],
      verificationMethod: [
        {
          // TODO - cheqd DID is unhappy with VM ID's that aren't the DID..
          id: `${issuerDid}#key-1`, // must retain the old VM
          type: "Ed25519VerificationKey2018",
          controller: issuerDid, // but controlled by the new DID
          publicKeyBase58: assertionKey.publicKeyBase58,
        },
      ],
      authentication: [`${issuerDid}#key-1`],
      assertionMethod: [`${issuerDid}#key-1`],
    }),
  });

  return issuerDid;
}

export async function updateDidCheqdDocumentWithAlsoKnownAs(
  didToUpdate: string,
  newDid: string
) {
  const [didRecord] = await agent.dids.getCreatedDids({ did: didToUpdate });
  const didDoc = didRecord.didDocument!.toJSON();
  didDoc["alsoKnownAs"] = [newDid];

  await agent.dids.update({
    did: didToUpdate,
    didDocument: JsonTransformer.fromJSON(didDoc, DidDocument),
  });
}

export async function deactivateDidCheqd(did: string) {
  await agent.dids.deactivate({
    did: did,
  });
}

export async function rotateIssuerDidCheqdKey(
  didToUpdate: string,
  newAssertionKey: Key
) {
  const [didRecord] = await agent.dids.getCreatedDids({ did: didToUpdate });
  const didDoc = didRecord.didDocument!.toJSON();

  // replace VM
  didDoc!.verificationMethod = [
    new VerificationMethod({
      id: `${didToUpdate}#key-1`,
      type: "Ed25519VerificationKey2018",
      controller: didToUpdate,
      publicKeyBase58: newAssertionKey.publicKeyBase58,
    }),
  ];

  await agent.dids.update({
    did: didToUpdate,
    didDocument: JsonTransformer.fromJSON(didDoc, DidDocument),
  });
}
