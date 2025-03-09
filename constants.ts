if (!process.env.AGENT_HOST || !process.env.AGENT_WALLET_KEY) {
  throw new Error("env variable not set");
}

const AGENT_HOST = process.env.AGENT_HOST;
const AGENT_WALLET_KEY = process.env.AGENT_WALLET_KEY;
const DEMO_DID_METHOD = process.env.DEMO_DID_METHOD
const CHEQD_TESTNET_COSMOS_PAYER_SEED = process.env.CHEQD_TESTNET_COSMOS_PAYER_SEED

export { AGENT_HOST, AGENT_WALLET_KEY, CHEQD_TESTNET_COSMOS_PAYER_SEED, DEMO_DID_METHOD };
