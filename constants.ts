if (!process.env.AGENT_HOST || !process.env.AGENT_WALLET_KEY || !process.env.DEMO_DID_METHODS) {
  throw new Error("env variable not set");
}

const AGENT_HOST = process.env.AGENT_HOST;
const AGENT_WALLET_KEY = process.env.AGENT_WALLET_KEY;
const DEMO_DID_METHODS: "web-to-web" | "cheqd-to-cheqd" | "sov-to-cheqd" = process.env.DEMO_DID_METHODS as any
const CHEQD_TESTNET_COSMOS_PAYER_SEED = process.env.CHEQD_TESTNET_COSMOS_PAYER_SEED

export { AGENT_HOST, AGENT_WALLET_KEY, CHEQD_TESTNET_COSMOS_PAYER_SEED, DEMO_DID_METHODS };
