if (!process.env.AGENT_HOST || !process.env.AGENT_WALLET_KEY) {
  throw new Error("env variable not set");
}

const AGENT_HOST = process.env.AGENT_HOST;
const AGENT_WALLET_KEY = process.env.AGENT_WALLET_KEY;

export { AGENT_HOST, AGENT_WALLET_KEY };
