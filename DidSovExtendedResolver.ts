import {
  type DidResolutionResult,
  type ParsedDid,
  type DidResolver,
  type AgentContext,
  DidDocumentService,
  DidCommV1Service,
  NewDidCommV2Service,
  NewDidCommV2ServiceEndpoint,
  DidCommV2Service,
  convertPublicKeyToX25519,
  TypedArrayEncoder,
  DidDocumentBuilder,
  DidDocumentMetadata,
} from "@credo-ts/core";

import { GetAttribRequest, GetNymRequest } from "@hyperledger/indy-vdr-shared";

import { IndyVdrPoolService } from "@credo-ts/indy-vdr";
import { IndyVdrPool } from "@credo-ts/indy-vdr/build/pool";

/// Extensions of the base IndyVdrSovDidResolver with support for:
/// * DID deactivation if verkey set to dead address
/// * DID alsoKnownAs field via `alsoKnownAs` ATTRIB
export class ExtendedIndyVdrSovDidResolver implements DidResolver {
  public readonly supportedMethods = ["sov"];

  public readonly allowsCaching = false;

  public async resolve(
    agentContext: AgentContext,
    did: string,
    parsed: ParsedDid
  ): Promise<DidResolutionResult> {
    const didDocumentMetadata: DidDocumentMetadata = {};

    try {
      const indyVdrPoolService =
        agentContext.dependencyManager.resolve(IndyVdrPoolService);

      // FIXME: this actually fetches the did twice (if not cached), once for the pool and once for the nym
      // we do not store the diddocContent in the pool cache currently so we need to fetch it again
      // The logic is mostly to determine which pool to use for a did
      const { pool } = await indyVdrPoolService.getPoolForDid(
        agentContext,
        parsed.id
      );
      const nym = await this.getPublicDid(pool, parsed.id);

      const alsoKnownAs = await this.getAlsoKnownAsForDid(
        agentContext,
        pool,
        parsed.id
      );

      if (isDidDeactivated(nym)) {
        didDocumentMetadata.deactivated = true;

        let didDoc = new DidDocumentBuilder(parsed.did).build();
        didDoc.alsoKnownAs = alsoKnownAs;

        return {
          didDocument: didDoc,
          didDocumentMetadata,
          didResolutionMetadata: { contentType: "application/did+ld+json" },
        };
      }

      const endpoints = await this.getEndpointsForDid(
        agentContext,
        pool,
        parsed.id
      );

      const keyAgreementId = `${parsed.did}#key-agreement-1`;
      const builder = sovDidDocumentFromDid(parsed.did, nym.verkey);

      if (endpoints) {
        addServicesFromEndpointsAttrib(
          builder,
          parsed.did,
          endpoints,
          keyAgreementId
        );
      }

      let didDoc = builder.build();
      didDoc.alsoKnownAs = alsoKnownAs;

      return {
        didDocument: didDoc,
        didDocumentMetadata,
        didResolutionMetadata: { contentType: "application/did+ld+json" },
      };
    } catch (error) {
      return {
        didDocument: null,
        didDocumentMetadata,
        didResolutionMetadata: {
          error: "notFound",
          message: `resolver_error: Unable to resolve did '${did}': ${error}`,
        },
      };
    }
  }

  private async getPublicDid(pool: IndyVdrPool, unqualifiedDid: string) {
    const request = new GetNymRequest({ dest: unqualifiedDid });
    const didResponse = await pool.submitRequest(request);

    if (!didResponse.result.data) {
      throw new Error(`DID ${unqualifiedDid} not found`);
    }
    return JSON.parse(didResponse.result.data) as GetNymResponseData;
  }

  private async getAlsoKnownAsForDid(
    agentContext: AgentContext,
    pool: IndyVdrPool,
    did: string
  ): Promise<string[] | undefined> {
    try {
      agentContext.config.logger.debug(
        `Get alsoKnownAs for did '${did}' from ledger '${pool.indyNamespace}'`
      );

      const request = new GetAttribRequest({
        targetDid: did,
        raw: "alsoKnownAs",
      });

      agentContext.config.logger.debug(
        `Submitting get alsoKnownAs ATTRIB request for did '${did}' to ledger '${pool.indyNamespace}'`
      );
      const response = await pool.submitRequest(request);

      if (!response.result.data) {
        return;
      }

      const alsoKnownAs = JSON.parse(response.result.data as string)
        ?.alsoKnownAs as string[];
      agentContext.config.logger.debug(
        `Got alsoKnownAs '${JSON.stringify(
          alsoKnownAs
        )}' for did '${did}' from ledger '${pool.indyNamespace}'`,
        {
        //   response,
          alsoKnownAs,
        }
      );

      return alsoKnownAs ?? null;
    } catch (error) {
      agentContext.config.logger.error(
        `Error retrieving alsoKnownAs for did '${did}' from ledger '${pool.indyNamespace}'`,
        {
          error,
        }
      );

      throw new Error(error as any);
    }
  }

  private async getEndpointsForDid(
    agentContext: AgentContext,
    pool: IndyVdrPool,
    did: string
  ) {
    try {
      agentContext.config.logger.debug(
        `Get endpoints for did '${did}' from ledger '${pool.indyNamespace}'`
      );

      const request = new GetAttribRequest({ targetDid: did, raw: "endpoint" });

      agentContext.config.logger.debug(
        `Submitting get endpoint ATTRIB request for did '${did}' to ledger '${pool.indyNamespace}'`
      );
      const response = await pool.submitRequest(request);

      if (!response.result.data) {
        return null;
      }

      const endpoints = JSON.parse(response.result.data as string)
        ?.endpoint as IndyEndpointAttrib;
      agentContext.config.logger.debug(
        `Got endpoints '${JSON.stringify(
          endpoints
        )}' for did '${did}' from ledger '${pool.indyNamespace}'`,
        {
        //   response,
          endpoints,
        }
      );

      return endpoints ?? null;
    } catch (error) {
      agentContext.config.logger.error(
        `Error retrieving endpoints for did '${did}' from ledger '${pool.indyNamespace}'`,
        {
          error,
        }
      );

      throw new Error(error as any);
    }
  }
}

function isDidDeactivated(nymResponse: GetNymResponseData): boolean {
  let deadVerkey = TypedArrayEncoder.toBase58(
    TypedArrayEncoder.fromHex(
      "000000000000000000000000000000000000000000000000000000000000dead"
    )
  );

  return nymResponse.verkey == deadVerkey;
}

type CommEndpointType =
  | "endpoint"
  | "did-communication"
  | "DIDComm"
  | "DIDCommMessaging";

interface IndyEndpointAttrib {
  endpoint?: string;
  types?: Array<CommEndpointType>;
  routingKeys?: string[];
  [key: string]: unknown;
}

interface GetNymResponseData {
  did: string;
  verkey: string;
  role: string;
  alias?: string;
  diddocContent?: string;
}

const FULL_VERKEY_REGEX = /^[1-9A-HJ-NP-Za-km-z]{43,44}$/;

/**
 * Check a base58 encoded string against a regex expression to determine if it is a full valid verkey
 * @param verkey Base58 encoded string representation of a verkey
 * @return Boolean indicating if the string is a valid verkey
 */
export function isFullVerkey(verkey: string): boolean {
  return FULL_VERKEY_REGEX.test(verkey);
}

export function getFullVerkey(did: string, verkey: string) {
  if (isFullVerkey(verkey)) return verkey;

  // Did could have did:xxx prefix, only take the last item after :
  const id = did.split(":").pop() ?? did;
  // Verkey is prefixed with ~ if abbreviated
  const verkeyWithoutTilde = verkey.slice(1);

  // Create base58 encoded public key (32 bytes)
  return TypedArrayEncoder.toBase58(
    Buffer.concat([
      // Take did identifier (16 bytes)
      TypedArrayEncoder.fromBase58(id),
      // Concat the abbreviated verkey (16 bytes)
      TypedArrayEncoder.fromBase58(verkeyWithoutTilde),
    ])
  );
}

export function sovDidDocumentFromDid(fullDid: string, verkey: string) {
  const verificationMethodId = `${fullDid}#key-1`;
  const keyAgreementId = `${fullDid}#key-agreement-1`;

  const publicKeyBase58 = getFullVerkey(fullDid, verkey);
  const publicKeyX25519 = TypedArrayEncoder.toBase58(
    convertPublicKeyToX25519(TypedArrayEncoder.fromBase58(publicKeyBase58))
  );

  const builder = new DidDocumentBuilder(fullDid)
    .addContext("https://w3id.org/security/suites/ed25519-2018/v1")
    .addContext("https://w3id.org/security/suites/x25519-2019/v1")
    .addVerificationMethod({
      controller: fullDid,
      id: verificationMethodId,
      publicKeyBase58: publicKeyBase58,
      type: "Ed25519VerificationKey2018",
    })
    .addVerificationMethod({
      controller: fullDid,
      id: keyAgreementId,
      publicKeyBase58: publicKeyX25519,
      type: "X25519KeyAgreementKey2019",
    })
    .addAuthentication(verificationMethodId)
    .addAssertionMethod(verificationMethodId)
    .addKeyAgreement(keyAgreementId);

  return builder;
}

// Process Indy Attrib Endpoint Types according to: https://sovrin-foundation.github.io/sovrin/spec/did-method-spec-template.html > Read (Resolve) > DID Service Endpoint
function processEndpointTypes(types?: string[]) {
  const expectedTypes = [
    "endpoint",
    "did-communication",
    "DIDComm",
    "DIDCommMessaging",
  ];
  const defaultTypes = ["endpoint", "did-communication"];

  // Return default types if types "is NOT present [or] empty"
  if (!types || types.length <= 0) {
    return defaultTypes;
  }

  // Return default types if types "contain any other values"
  for (const type of types) {
    if (!expectedTypes.includes(type)) {
      return defaultTypes;
    }
  }

  // Return provided types
  return types;
}

export function addServicesFromEndpointsAttrib(
  builder: DidDocumentBuilder,
  did: string,
  endpoints: IndyEndpointAttrib,
  keyAgreementId: string
) {
  const { endpoint, routingKeys, types, ...otherEndpoints } = endpoints;

  if (endpoint) {
    const processedTypes = processEndpointTypes(types);

    // If 'endpoint' included in types, add id to the services array
    if (processedTypes.includes("endpoint")) {
      builder.addService(
        new DidDocumentService({
          id: `${did}#endpoint`,
          serviceEndpoint: endpoint,
          type: "endpoint",
        })
      );
    }

    // If 'did-communication' included in types, add DIDComm v1 entry
    if (processedTypes.includes("did-communication")) {
      builder.addService(
        new DidCommV1Service({
          id: `${did}#did-communication`,
          serviceEndpoint: endpoint,
          priority: 0,
          routingKeys: routingKeys ?? [],
          recipientKeys: [keyAgreementId],
          accept: ["didcomm/aip2;env=rfc19"],
        })
      );
    }

    // If 'DIDCommMessaging' included in types, add DIDComm v2 entry
    if (processedTypes.includes("DIDCommMessaging")) {
      builder
        .addService(
          new NewDidCommV2Service({
            id: `${did}#didcomm-messaging-1`,
            serviceEndpoint: new NewDidCommV2ServiceEndpoint({
              uri: endpoint,
              routingKeys: routingKeys,
              accept: ["didcomm/v2"],
            }),
          })
        )
        .addContext("https://didcomm.org/messaging/contexts/v2");
    }

    // If 'DIDComm' included in types, add legacy DIDComm v2 entry
    if (processedTypes.includes("DIDComm")) {
      builder
        .addService(
          new DidCommV2Service({
            id: `${did}#didcomm-1`,
            routingKeys: routingKeys,
            accept: ["didcomm/v2"],
            serviceEndpoint: endpoint,
          })
        )
        .addContext("https://didcomm.org/messaging/contexts/v2");
    }
  }

  // Add other endpoint types
  for (const [type, endpoint] of Object.entries(otherEndpoints)) {
    builder.addService(
      new DidDocumentService({
        id: `${did}#${type}`,
        serviceEndpoint: endpoint as string,
        type,
      })
    );
  }
}
