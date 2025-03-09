# Portable DIDs Proof of Concept
## Setup
### `did:web` -> `did:web` flow
This flow involves a `did:web` issuer moving from one `did:web` DID to another `did:web`.

To setup:
1. `cp .env.template .env`
2. setup ngrok on your machine: https://ngrok.com/
3. start ngrok for port 3000 `ngrok http 3000`
4. set `.env` `AGENT_HOST` to your ngrok url, e.g. `AGENT_HOST=https://38eb-2401-d002-ca04-a900-2452-e2fa-70e9-3f6a.ngrok-free.app`
5. set `.env` `DEMO_DID_METHOD` to `web` (`DEMO_DID_METHOD=web`)
6. run the demo `npm run dev`

### `did:cheqd` -> `did:cheqd` flow
This flow involves a `did:cheqd` issuer moving from one `did:cheqd` DID to another `did:cheqd`.

To setup:
1. `cp .env.template .env`
2. follow the [cheqd guide for setting up Leap wallet](https://docs.cheqd.io/product/network/wallets/setup-leap-wallet/testnet), noting down your seed phrase and topping up testnet tokens
3. set `.env` `CHEQD_TESTNET_COSMOS_PAYER_SEED` to your seed from leap setup, e.g. `CHEQD_TESTNET_COSMOS_PAYER_SEED='foo foo foo foo foo foo foo foo foo foo foo foo'`
4. set `.env` `DEMO_DID_METHOD` to `cheqd` (`DEMO_DID_METHOD=cheqd`)
5. run the demo `npm run dev`
