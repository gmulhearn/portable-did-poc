import express, { Response, Express } from "express";
import {
  ClaimFormat,
  DidDocument,
  DidDocumentBuilder,
  JsonTransformer,
  Key,
  KeyType,
  VerificationMethod,
  W3cCredential,
  W3cJsonLdVerifiableCredential,
} from "@credo-ts/core";
import { AGENT_HOST } from "./constants";
import { agent } from "./agent";

const server = express();

await agent.initialize();
console.log("agent initialized");

const issuerAssertionKey = await setupAssertionKey();
const firstIssuerDid = await setupFirstIssuerDid(server, issuerAssertionKey);
{
  let didDoc = await agent.dids.resolveDidDocument(firstIssuerDid);
  console.log("initialized issuer's first DID", firstIssuerDid, didDoc);
}

server.listen(3000, (err?: any) => {
  if (err) throw err;
  console.log("Server running on http://localhost:3000");
});

console.log(
  JSON.stringify(await agent.dids.resolve(`${firstIssuerDid}#key-1`))
);

let issuedCredential = (await agent.w3cCredentials.signCredential({
  verificationMethod: `${firstIssuerDid}#key-1`, // TODO - dynamic
  format: ClaimFormat.LdpVc,
  proofType: "Ed25519Signature2018",
  credential: new W3cCredential({
    id: "https://credential.com/123",
    type: ["VerifiableCredential"],
    issuer: firstIssuerDid,
    issuanceDate: new Date().toISOString(),
    expirationDate: "2026-10-05T14:48:00.000Z",
    credentialSubject: {
      id: "did:example:holder",
    },
  }),
})) as W3cJsonLdVerifiableCredential;

console.log("issued credential", issuedCredential.toJson());

let verificationResult = await agent.w3cCredentials.verifyCredential({
  credential: issuedCredential,
});
console.log("cred verification result", verificationResult.isValid);

const secondIssuerDid = await setupSecondIssuerDid(
  server,
  issuerAssertionKey,
  firstIssuerDid
);
{
  let didDoc = await agent.dids.resolveDidDocument(secondIssuerDid);
  console.log("initialized issuer's second DID", secondIssuerDid, didDoc);
}

await updateDidDocumentWithAlsoKnownAs(firstIssuerDid, secondIssuerDid);
{
  let didDoc = await agent.dids.resolveDidDocument(firstIssuerDid);
  console.log("updated issuer's first DID with AKA field", didDoc);
}

async function setupAssertionKey(): Promise<Key> {
  return await agent.wallet.createKey({
    keyType: KeyType.Ed25519,
  });
}

async function setupFirstIssuerDid(
  server: Express,
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

  server.use("/first/.well-known/did.json", async (_, response: Response) => {
    const [createdDid] = await agent.dids.getCreatedDids({ did: issuerDid });

    if (!createdDid || !createdDid.didDocument) {
      throw new Error("did does not exist");
    }

    return response.json(createdDid.didDocument);
  });

  return issuerDid;
}

async function updateDidDocumentWithAlsoKnownAs(
  didToUpdate: string,
  newDid: string
) {
  const [oldDidRecord] = await agent.dids.getCreatedDids({ did: didToUpdate });
  const oldDidDoc = oldDidRecord.didDocument!.toJSON();
  oldDidDoc["alsoKnownAs"] = [newDid];

  await agent.dids.import({
    did: didToUpdate,
    didDocument: JsonTransformer.fromJSON(oldDidDoc, DidDocument),
    overwrite: true,
  });
}

async function setupSecondIssuerDid(
  server: Express,
  assertionKey: Key,
  oldDid: string
): Promise<string> {
  const cleanHost = encodeURIComponent(
    AGENT_HOST.replace("https://", "").replace("http://", "")
  );
  const issuerDid = `did:web:${cleanHost}:second`;

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
    .build()
    .toJSON();

  didDocument["alsoKnownAs"] = [oldDid];

  await agent.dids.import({
    did: issuerDid,
    didDocument: JsonTransformer.fromJSON(didDocument, DidDocument),
    overwrite: true,
  });

  server.use("/second/.well-known/did.json", async (_, response: Response) => {
    const [createdDid] = await agent.dids.getCreatedDids({ did: issuerDid });

    if (!createdDid || !createdDid.didDocument) {
      throw new Error("did does not exist");
    }

    return response.json(createdDid.didDocument);
  });

  return issuerDid;
}
