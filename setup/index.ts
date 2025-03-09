import {
  Agent,
  ConsoleLogger,
  DidsModule,
  JwkDidRegistrar,
  JwkDidResolver,
  Key,
  KeyDidRegistrar,
  KeyDidResolver,
  KeyType,
  LogLevel,
  WebDidResolver,
} from "@credo-ts/core";
import {
  CheqdDidRegistrar,
  CheqdDidResolver,
  CheqdModule,
  CheqdModuleConfig,
} from "@credo-ts/cheqd";
import { agentDependencies } from "@credo-ts/node";
import { AskarModule } from "@credo-ts/askar";
import { ariesAskar } from "@hyperledger/aries-askar-nodejs";
import {
  AGENT_WALLET_KEY,
  CHEQD_TESTNET_COSMOS_PAYER_SEED,
} from "../constants";
import { DidRoutingResolver } from "../DidRoutingResolver";
import {
  rotateIssuerDidWebKey,
  setupFirstIssuerDidWeb,
  setupSecondIssuerDidWeb,
  updateDidWebDocumentWithAlsoKnownAs,
} from "./didweb";

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
      registrars: [
        new KeyDidRegistrar(),
        new JwkDidRegistrar(),
        new CheqdDidRegistrar(),
      ],
    }),
    askar: new AskarModule({
      ariesAskar,
    }),
    cheqd: new CheqdModule(
      new CheqdModuleConfig({
        networks: [
          {
            network: "testnet",
            cosmosPayerSeed: CHEQD_TESTNET_COSMOS_PAYER_SEED,
          },
        ],
      })
    ),
  },
});

export async function setupAssertionKey(): Promise<Key> {
  return await agent.wallet.createKey({
    keyType: KeyType.Ed25519,
  });
}

export async function setupFirstIssuerDid(assertionKey: Key): Promise<string> {
  return await setupFirstIssuerDidWeb(assertionKey);
}

export async function setupSecondIssuerDid(
  assertionKey: Key,
  oldDid: string
): Promise<string> {
  return await setupSecondIssuerDidWeb(assertionKey, oldDid);
}

export async function updateDidDocumentWithAlsoKnownAs(
  didToUpdate: string,
  newDid: string
) {
  await updateDidWebDocumentWithAlsoKnownAs(didToUpdate, newDid);
}

export async function rotateIssuerDidKey(
  didToUpdate: string,
  newAssertionKey: Key
) {
  await rotateIssuerDidWebKey(didToUpdate, newAssertionKey);
}
