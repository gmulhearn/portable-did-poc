import {
  Agent,
  ConsoleLogger,
  DidDocument,
  DidDocumentBuilder,
  DidsModule,
  JsonTransformer,
  JwkDidRegistrar,
  JwkDidResolver,
  Key,
  KeyDidRegistrar,
  KeyDidResolver,
  KeyType,
  LogLevel,
  VerificationMethod,
  WebDidResolver,
} from "@credo-ts/core";
import { CheqdDidResolver } from "@credo-ts/cheqd";
import { agentDependencies } from "@credo-ts/node";
import { AskarModule } from "@credo-ts/askar";
import { ariesAskar } from "@hyperledger/aries-askar-nodejs";
import { AGENT_HOST, AGENT_WALLET_KEY } from "./constants";
import { BbsModule } from "@credo-ts/bbs-signatures";
import { DidRoutingResolver } from "./DidRoutingResolver";
import { Express, Response } from "express";

export const agent = new Agent({
  dependencies: agentDependencies,
  config: {
    label: "Portable DIDS",
    logger: new ConsoleLogger(LogLevel.trace),
    walletConfig: {
      id: "portable-dids",
      key: AGENT_WALLET_KEY,
    },
  },
  modules: {
    dids: new DidsModule({
      resolvers: [
        new DidRoutingResolver([
          // wrap resolvers we want to support in a re-router
          new KeyDidResolver(),
          new JwkDidResolver(),
          new WebDidResolver(),
          new CheqdDidResolver(),
        ]),
      ],
      registrars: [new KeyDidRegistrar(), new JwkDidRegistrar()],
    }),
    askar: new AskarModule({
      ariesAskar,
    }),
    bbs: new BbsModule(),
  },
});

export async function setupAssertionKey(): Promise<Key> {
  return await agent.wallet.createKey({
    keyType: KeyType.Ed25519,
  });
}

export async function setupFirstIssuerDid(
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

export async function setupSecondIssuerDid(
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

export async function updateDidDocumentWithAlsoKnownAs(
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

export async function rotateIssuerDidKey(
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
