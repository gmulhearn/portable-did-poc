import express from "express";
import {
  ClaimFormat,
  W3cCredential,
  W3cJsonLdVerifiableCredential,
} from "@credo-ts/core";
import {
  agent,
  rotateIssuerDidKey,
  setupAssertionKey,
  setupFirstIssuerDid,
  setupSecondIssuerDid,
  updateDidDocumentWithAlsoKnownAs,
} from "./setup";
import { assert } from "console";

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
assert(verificationResult.isValid);
assert(
  (verificationResult.validations.vcJs as any)["results"][0][
    "verificationMethod"
  ]["controller"] == firstIssuerDid
);

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
console.log(
  "cred verification result",
  verificationResult2.isValid,
  JSON.stringify(verificationResult2)
);
assert(verificationResult2.isValid);
assert(
  (verificationResult2.validations.vcJs as any)["results"][0][
    "verificationMethod"
  ]["controller"] == secondIssuerDid
);

/// OTHER FLOWS

/// 8. ROTATE KEY IN ISSUER'S FIRST DID DOC (SHOULD NOT AFFECT)
let newAssertionKey = await setupAssertionKey();
await rotateIssuerDidKey(firstIssuerDid, newAssertionKey);

/// 9. RE-VERIFY CREDENTIAL FROM ISSUER'S FIRST DID (SHOULD RE-ROUTE TO NEW DID DOC AND NOT BE AFFECTED)
console.log("### RE-VERIFY CRED FROM ISSUER DID #1");
let verificationResult3 = await agent.w3cCredentials.verifyCredential({
  credential: issuedCredential,
});
console.log(
  "cred verification result",
  verificationResult3.isValid,
  JSON.stringify(verificationResult3)
);

/// 10. ROTATE KEY IN ISSUER'S SECOND DID DOC (SHOULD AFFECT)
await rotateIssuerDidKey(secondIssuerDid, newAssertionKey);

/// 11. RE-VERIFY CREDENTIAL FROM ISSUER'S FIRST DID (SHOULD RE-ROUTE TO NEW DID DOC AND BE AFFECTED)
console.log("### RE-VERIFY CRED FROM ISSUER DID #1");
let verificationResult4 = await agent.w3cCredentials.verifyCredential({
  credential: issuedCredential,
});
console.log(
  "cred verification result",
  verificationResult4.isValid,
  JSON.stringify(verificationResult4)
);
assert(!verificationResult4.isValid);
