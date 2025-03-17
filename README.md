# Portable DIDs Proof of Concept
## Description
### VC Issuer DID rotation demo
Proof of concept demo which shows the following issuer flow:
1. initialize issuer agent
2. issuer creates DID 1
3. issuer issues VC with DID 1
4. verifier verifies VC
5. issuer creates DID 2 with the same assertionKey as DID 1
6. issuer deactivates DID 1 and redirects it to DID 2
7. verifier re-verifies VC (works due to re-direct)
8. issuer rotates the assertionKey on DID 2
9. verifier re-verifies VC (fails, as the VC was signed by pre-rotation key)

please see [demo.ts](./demo.ts) for a code walkthrough of these steps

## Setup
Base setup:
1. `cp .env.template .env`
2. `npm i` (use node >=20)

### Run the `did:sov` -> `did:cheqd` issuer demo
This flow involves a `did:sov` issuer moving to a `did:cheqd` DID.

To setup:
1. create a indy DID seed (32 hex chars). (e.g. with `uuidgen | sed -e "s/-//gi"`)
2. register the DID with BCovrin testnet: http://test.bcovrin.vonx.io/ (paste in seed - not recommended for production)
3. set `.env` `SOV_ENDORSER_SEED` to your seed
4. set `.env` `SOV_ENDORSER_NYM` to the "DID" that was output from BCovrin (e.g. `SOV_ENDORSER_NYM=EGZ73i3drAEWNejZED7uhg`)
5. set `.env` `DEMO_DID_METHODS` to `sov-to-cheqd` (`DEMO_DID_METHODS=sov-to-cheqd`)
6. run the demo `npm run dev`

#### Notes:
* this uses a modified version of did:sov method, where:
  * if the DID's resolved verkey is dead (`0x000000000000000000000000000000000000000000000000000000000000dead`), then the DID is "deactivated". This is in-place of the real did:sov deactivation step where verkey is set to null. This isn't possible with the current typing of indy-vdr (doesn't allow null), and is significant effort to fix.
  * the the indy NYM has an attribute (ATTRIB) for `alsoKnownAs`, then it is added to the resolved DID Document as the `alsoKnownAs` field.
  * These changes can be seen in the [modified resolver](./DidSovExtendedResolver.ts)

### Run the `did:web` -> `did:web` issuer demo
This flow involves a `did:web` issuer moving from one `did:web` DID to another `did:web`.

To setup:
1. setup ngrok on your machine: https://ngrok.com/
2. start ngrok for port 3000 `ngrok http 3000`
3. set `.env` `AGENT_HOST` to your ngrok url, e.g. `AGENT_HOST=https://38eb-2401-d002-ca04-a900-2452-e2fa-70e9-3f6a.ngrok-free.app`
4. set `.env` `DEMO_DID_METHODS` to `web-to-web` (`DEMO_DID_METHODS=web-to-web`)
5. run the demo `npm run dev`

#### Notes:
* this uses a modified version of did:web method rules, where:
  * if the did.json contains a `deactivated: true` field, then the DID is "deactivated". This is due to did:web not having an official way to deactivate the document whilst retaining the data.

### Run the `did:cheqd` -> `did:cheqd` issuer demo
This flow involves a `did:cheqd` issuer moving from one `did:cheqd` DID to another `did:cheqd`.

To setup:
1. follow the [cheqd guide for setting up Leap wallet](https://docs.cheqd.io/product/network/wallets/setup-leap-wallet/testnet), noting down your seed phrase and topping up testnet tokens
2. set `.env` `CHEQD_TESTNET_COSMOS_PAYER_SEED` to your seed from leap setup, e.g. `CHEQD_TESTNET_COSMOS_PAYER_SEED='foo foo foo foo foo foo foo foo foo foo foo foo'`
3. set `.env` `DEMO_DID_METHODS` to `cheqd-to-cheqd` (`DEMO_DID_METHODS=cheqd-to-cheqd`)
4. run the demo `npm run dev`

### Analyse the metrics
We've also instrumented the implementation to get metrics from the different portability demos. For every `npm run dev`, there will be created a `metrics_DEMO_DID_METHODS_id.json with a compilation with data from that demo in the /metrics folder

To create the Performance Report from the average of all demo runs you do, run `npx ts-node metrics-report.ts `

Instead of running manually each demo, you can instead run `npx ts-node benchmark-runner.ts`, which will run 3 times each demo, and after it, you can create the Performance Report from the values you get with the Benchmark