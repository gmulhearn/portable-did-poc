import {
  Agent,
  ConsoleLogger,
  DidsModule,
  JwkDidRegistrar,
  JwkDidResolver,
  KeyDidRegistrar,
  KeyDidResolver,
  LogLevel,
  WebDidResolver,
} from "@credo-ts/core";
import { CheqdDidResolver } from "@credo-ts/cheqd";
import { agentDependencies } from "@credo-ts/node";
import { AskarModule } from "@credo-ts/askar";
import { ariesAskar } from "@hyperledger/aries-askar-nodejs";
import { AGENT_WALLET_KEY } from "./constants";
import { BbsModule } from "@credo-ts/bbs-signatures";

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
        new KeyDidResolver(),
        new JwkDidResolver(),
        new WebDidResolver(),
        new CheqdDidResolver(),
      ],
      registrars: [new KeyDidRegistrar(), new JwkDidRegistrar()],
    }),
    askar: new AskarModule({
      ariesAskar,
    }),
    bbs: new BbsModule(),
  },
});
