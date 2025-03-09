import {
  AgentContext,
  DidResolutionOptions,
  DidResolutionResult,
  DidResolver,
  ParsedDid,
  parseDid,
  WebDidResolver,
} from "@credo-ts/core";

export class DidRoutingResolver implements DidResolver {
  supportedMethods: string[] = this.baseResolvers.flatMap(
    (r) => r.supportedMethods
  );

  allowsCaching: boolean = false;

  allowsLocalDidRecord?: boolean | undefined;

  constructor(private baseResolvers: DidResolver[]) {}

  async resolve(
    agentContext: AgentContext,
    did: string,
    _: ParsedDid,
    didResolutionOptions: DidResolutionOptions
  ): Promise<DidResolutionResult> {
    // TODO - stop infinite loops / cycles (e.g. if both are deactivated)
    var didToResolve = did;
    var expectedAkaDid = undefined; // DID expected in the AKA list of the DIDDoc for `currentDid`
    while (true) {
      let res = await this.resolveWithoutRedirect(
        agentContext,
        didToResolve,
        didResolutionOptions
      );

      let docSatisfiesExpectedAka =
        !expectedAkaDid ||
        res.didDocument?.alsoKnownAs?.includes(expectedAkaDid);

      if (!docSatisfiesExpectedAka) {
        throw new Error(
          `DIDDoc does not contain an expected AKA ${expectedAkaDid}`
        );
      }

      let isDeactivated = res.didDocumentMetadata.deactivated === true;
      if (!isDeactivated) return res; // not deactivated - no need to follow redirect

      // TODO - what if there are multiple AKA DIDs?
      let akaDid = res.didDocument?.alsoKnownAs?.at(0);
      // if no redirect, return usual doc
      if (!akaDid) return res;

      console.log("DID was deactivated and found AKA DID, redirecting...");
      expectedAkaDid = didToResolve; // expect that the new DID contains a reference back to this DID
      didToResolve = akaDid; // resolve again with the new AKA DID
    }
  }

  private async resolveWithoutRedirect(
    agentContext: AgentContext,
    did: string,
    didResolutionOptions: DidResolutionOptions
  ): Promise<DidResolutionResult> {
    let parsed = parseDid(did);
    let resolver = this.baseResolvers.find((r) =>
      r.supportedMethods.includes(parsed.method)
    );
    if (!resolver) {
      throw new Error("Method not implemented.");
    }
    let res = await resolver.resolve(
      agentContext,
      did,
      parsed,
      didResolutionOptions
    );

    console.log(res.didDocument)
    console.log(JSON.stringify(res.didDocument))

    // TODO - HACK since we can't ACTUALLY deactivate did:web's,
    // we use this `deactivated` field that we've forced into the DIDDoc
    // it is NOT a real field.
    let jsonDidDoc = res.didDocument as any
    if (did.startsWith("did:web") && jsonDidDoc.deactivated) {
      res.didDocumentMetadata.deactivated = true;
    }

    return res;
  }
}
