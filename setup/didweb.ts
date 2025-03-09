import {
  DidDocument,
  DidDocumentBuilder,
  JsonTransformer,
  Key,
  VerificationMethod,
} from "@credo-ts/core";

import { AGENT_HOST } from "../constants";
import { Response } from "express";
import { agent } from ".";
import { server } from "./server";

export async function setupFirstIssuerDidWeb(
  assertionKey: Key
): Promise<string> {
  const cleanHost = encodeURIComponent(
    AGENT_HOST.replace("https://", "").replace("http://", "")
  );
  const issuerDid = `did:web:${cleanHost}:first`;

  const assertionMethod = new VerificationMethod({
    id: `${issuerDid}#key-1`,
    type: "Ed25519VerificationKey2018",
    controller: issuerDid,
    publicKeyBase58: assertionKey.publicKeyBase58,
  });

  const didDocument = new DidDocumentBuilder(issuerDid)
    .addContext("https://w3id.org/security/suites/ed25519-2018/v1") // context for Ed25519VerificationKey2018
    .addVerificationMethod(assertionMethod)
    .addAssertionMethod(assertionMethod.id)
    .build();

  await agent.dids.import({
    did: issuerDid,
    didDocument,
    overwrite: true,
  });

  server.use("/first/did.json", async (_, response: Response) => {
    const [createdDid] = await agent.dids.getCreatedDids({ did: issuerDid });

    if (!createdDid || !createdDid.didDocument) {
      throw new Error("did does not exist");
    }

    return response.json(createdDid.didDocument);
  });

  return issuerDid;
}

export async function setupSecondIssuerDidWeb(
  assertionKey: Key,
  oldDid: string
): Promise<string> {
  const cleanHost = encodeURIComponent(
    AGENT_HOST.replace("https://", "").replace("http://", "")
  );
  const issuerDid = `did:web:${cleanHost}:second`;

  const assertionMethod = new VerificationMethod({
    id: `${oldDid}#key-1`, // must retain the old VM
    type: "Ed25519VerificationKey2018",
    controller: issuerDid, // but controlled by the new DID
    publicKeyBase58: assertionKey.publicKeyBase58,
  });

  const didDocument = new DidDocumentBuilder(issuerDid)
    .addContext("https://w3id.org/security/suites/ed25519-2018/v1") // context for Ed25519VerificationKey2018
    .addVerificationMethod(assertionMethod)
    .addAssertionMethod(assertionMethod.id)
    .build()
    .toJSON();

  didDocument["alsoKnownAs"] = [oldDid];

  await agent.dids.import({
    did: issuerDid,
    didDocument: JsonTransformer.fromJSON(didDocument, DidDocument),
    overwrite: true,
  });

  server.use("/second/did.json", async (_, response: Response) => {
    const [createdDid] = await agent.dids.getCreatedDids({ did: issuerDid });

    if (!createdDid || !createdDid.didDocument) {
      throw new Error("did does not exist");
    }

    return response.json(createdDid.didDocument);
  });

  return issuerDid;
}

export async function updateDidWebDocumentWithAlsoKnownAs(
  didToUpdate: string,
  newDid: string
) {
  const [didRecord] = await agent.dids.getCreatedDids({ did: didToUpdate });
  const didDoc = didRecord.didDocument!.toJSON();
  didDoc["alsoKnownAs"] = [newDid];

  await agent.dids.import({
    did: didToUpdate,
    didDocument: JsonTransformer.fromJSON(didDoc, DidDocument),
    overwrite: true,
  });
}

export async function deactivateDidWeb(did: string) {
  // TODO - this is a hack, there is no way to deactivate a did:web
  // but we emulate it by inserting it as a field that the resolver can
  // process
  const [didRecord] = await agent.dids.getCreatedDids({ did: did });
  const didDoc = didRecord.didDocument!.toJSON();
  didDoc["deactivated"] = true;

  await agent.dids.import({
    did: did,
    didDocument: JsonTransformer.fromJSON(didDoc, DidDocument),
    overwrite: true,
  });
}

export async function rotateIssuerDidWebKey(
  didToUpdate: string,
  newAssertionKey: Key
) {
  const [didRecord] = await agent.dids.getCreatedDids({ did: didToUpdate });
  let didDoc = didRecord.didDocument!;

  // replace VM
  didDoc!.verificationMethod = [
    new VerificationMethod({
      id: `${didToUpdate}#key-1`,
      type: "Ed25519VerificationKey2018",
      controller: didToUpdate,
      publicKeyBase58: newAssertionKey.publicKeyBase58,
    }),
  ];

  await agent.dids.import({
    did: didToUpdate,
    didDocument: didDoc,
    overwrite: true,
  });
}
