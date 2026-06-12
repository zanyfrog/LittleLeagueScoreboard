import type { IamService, Scope } from "@ll-score/contracts";
import { NotAuthorizedError } from "./errors.js";
import type { RequestContext } from "./contracts.js";

export async function requireAuthorization(
  iam: Pick<IamService, "authorize">,
  context: RequestContext,
  action: string,
  resource: string,
  scope: Scope
): Promise<void> {
  const decision = await iam.authorize({
    actorId: context.actorId,
    action,
    resource,
    scope,
    fields: [],
    context: {
      requestId: context.requestId,
      correlationId: context.correlationId,
      transport: context.transport
    }
  });
  if (decision.decision !== "allow") {
    throw new NotAuthorizedError(action, resource);
  }
}
