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

/// 1. AGENT INITIALIZATION
console.log("### AGENT INITIALIZATION");
const server = express();
await agent.initialize();
server.listen(3000, (err?: any) => {
  if (err) throw err;
  console.log(
    "Server running on http://localhost:3000 (for did:web resolution)"
  );
});

/// 2. SETUP ISSUER'S FIRST (OLD) DID
console.log("### SETUP ISSUER DID #1");
const issuerAssertionKey = await setupAssertionKey();
const firstIssuerDid = await setupFirstIssuerDid(server, issuerAssertionKey);
{
  let didDoc = await agent.dids.resolveDidDocument(firstIssuerDid);
  console.log("initialized issuer's first DID", firstIssuerDid, didDoc);
}

/// 3. ISSUE CREDENTIAL FROM ISSUER'S FIRST DID
console.log("### ISSUE CRED FROM ISSUER DID #1");
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

/// 4. VERIFY CREDENTIAL FROM ISSUER'S FIRST DID
console.log("### VERIFY CRED FROM ISSUER DID #1");
let verificationResult = await agent.w3cCredentials.verifyCredential({
  credential: issuedCredential,
});
console.log("cred verification result", verificationResult.isValid);

/// 5. SETUP ISSUER'S SECOND (NEW) DID
console.log("### SETUP ISSUER DID #2");
const secondIssuerDid = await setupSecondIssuerDid(
  server,
  issuerAssertionKey,
  firstIssuerDid
);
{
  let didDoc = await agent.dids.resolveDidDocument(secondIssuerDid);
  console.log("initialized issuer's second DID", secondIssuerDid, didDoc);
}

/// 6. DEACTIVATE ISSUER'S OLD DID AND POINT TO NEW DID (alsoKnownAs)
console.log("### DEACTIVATE ISSUER DID #1");
await updateDidDocumentWithAlsoKnownAs(firstIssuerDid, secondIssuerDid);
{
  let didDoc = await agent.dids.resolveDidDocument(firstIssuerDid);
  console.log("updated issuer's first DID with AKA field", didDoc);
}
// TODO - deactive old DID

/// 7. RE-VERIFY CREDENTIAL FROM ISSUER'S FIRST DID (SHOULD RE-ROUTE TO NEW DID DOC)
console.log("### RE-VERIFY CRED FROM ISSUER DID #1");
let verificationResult2 = await agent.w3cCredentials.verifyCredential({
  credential: issuedCredential,
});
console.log("cred verification result", verificationResult2.isValid, JSON.stringify(verificationResult2));

// TODO - some more fail cases

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

  server.use("/first/did.json", async (_, response: Response) => {
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
    id: `${oldDid}#key-1`, // must retain the old VM
    type: "Ed25519VerificationKey2018",
    controller: issuerDid,
    // controller: oldDid, // must retain the old controller?
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
