import { CheqdDidCreateOptions } from "@credo-ts/cheqd";
import { randomUUID } from "crypto";
import { agent } from ".";
import { DidDocument, Key } from "@credo-ts/core";

export async function setupFirstIssuerCheqdDid(
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
    }),
  });

  return issuerDid;
}
