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
  KeyType,
  VerificationMethod,
} from "@credo-ts/core";

async function setupAuthencationVM(did: string): Promise<VerificationMethod> {
  let authKey = await agent.wallet.createKey({
    keyType: KeyType.Ed25519,
  });
  return {
    id: `${did}#auth`,
    type: "Ed25519VerificationKey2018",
    controller: did,
    publicKeyBase58: authKey.publicKeyBase58,
  };
}

export async function setupFirstIssuerDidCheqd(
  assertionKey: Key
): Promise<string> {
  let issuerDid = `did:cheqd:testnet:${randomUUID()}`;

  let authVM = await setupAuthencationVM(issuerDid);

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
        authVM,
      ],
      assertionMethod: [`${issuerDid}#key-1`],
      authentication: [authVM.id],
    }),
  });

  return issuerDid;
}

export async function setupSecondIssuerDidCheqd(
  assertionKey: Key,
  oldDid: string
): Promise<string> {
  let issuerDid = `did:cheqd:testnet:${randomUUID()}`;

  let authVM = await setupAuthencationVM(issuerDid);
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
        authVM,
      ],
      assertionMethod: [`${issuerDid}#key-1`],
      authentication: [authVM.id],
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
  const didDoc = didRecord.didDocument!;

  let newVMs = didDoc!.verificationMethod!.map((vm) => {
    if (vm.id.endsWith("#key-1")) {
      vm.publicKeyBase58 = newAssertionKey.publicKeyBase58;
    }
    return vm;
  });
  didDoc.verificationMethod = newVMs;

  await agent.dids.update({
    did: didToUpdate,
    didDocument: didDoc,
  });
}
