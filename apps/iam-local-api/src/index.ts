import { join } from "node:path";
import { LocalIamService } from "@ll-score/iam-local";
import { createIamApp } from "./app.js";

const dataDirectory = process.env.LL_SCORE_DATA_DIR ??
  join(process.cwd(), ".local-data");
const port = Number(process.env.LL_SCORE_IAM_PORT ?? "4310");
const host = process.env.LL_SCORE_IAM_HOST ?? "127.0.0.1";

const service = new LocalIamService({
  recordsPath: join(dataDirectory, "catalog", "iam-records.jsonl"),
  auditPath: join(dataDirectory, "audit", "iam-audit-events.jsonl"),
  allowDevelopmentProfiles:
    process.env.LL_SCORE_ALLOW_DEVELOPMENT_PROFILES === "true"
});
await service.initialize();

const app = await createIamApp({
  service,
  secureCookies: process.env.NODE_ENV === "production"
});
await app.listen({ port, host });
