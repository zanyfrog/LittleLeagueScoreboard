import { randomUUID } from "node:crypto";
import { join } from "node:path";
import { createGameEngine, type RequestContext } from "@ll-score/game-engine";
import { LocalIamService } from "@ll-score/iam-local";
import { createJsonlStorage } from "@ll-score/storage-jsonl";

const localPassword = "local-scoreboard-development-password";

async function createRuntime() {
  const storage = createJsonlStorage(process.env.LL_SCORE_DATA_DIR);
  await storage.initialize();
  const iam = new LocalIamService({
    recordsPath: join(storage.paths.root, "catalog", "landing-iam.jsonl"),
    auditPath: join(storage.paths.root, "audit", "landing-iam-audit.jsonl")
  });
  await iam.initialize();
  let session;
  if (await iam.isBootstrapAvailable()) {
    session = await iam.bootstrapAdmin({
      username: "local-admin",
      password: localPassword,
      displayName: "Local Scorekeeper"
    });
  } else {
    session = await iam.login({
      username: "local-admin",
      password: localPassword
    });
  }
  return {
    storage,
    engine: createGameEngine({ storage, iam }),
    actorId: session.actor.actorId
  };
}

type Runtime = Awaited<ReturnType<typeof createRuntime>>;
const globalRuntime = globalThis as typeof globalThis & {
  __llScoreRuntime?: Promise<Runtime>;
};

export function getRuntime(): Promise<Runtime> {
  globalRuntime.__llScoreRuntime ??= createRuntime();
  return globalRuntime.__llScoreRuntime;
}

export function requestContext(actorId: string, gameId?: string): RequestContext {
  return {
    actorId,
    gameId,
    requestId: randomUUID(),
    correlationId: randomUUID(),
    transport: "http"
  };
}
