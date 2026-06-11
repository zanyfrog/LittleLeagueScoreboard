import { mkdtemp } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { describe, expect, it } from "vitest";
import { LocalIamService } from "@ll-score/iam-local";
import { createIamApp } from "./app.js";

describe("local I-AM API", () => {
  it("sets an HTTP-only session cookie and returns auth/me", async () => {
    const directory = await mkdtemp(join(tmpdir(), "ll-score-iam-api-"));
    const service = new LocalIamService({
      recordsPath: join(directory, "iam.jsonl"),
      auditPath: join(directory, "audit.jsonl")
    });
    const app = await createIamApp({ service });
    const bootstrap = await app.inject({
      method: "POST",
      url: "/bootstrap/admin",
      payload: {
        username: "admin",
        password: "correct horse battery staple",
        displayName: "Local Admin"
      }
    });
    expect(bootstrap.statusCode).toBe(200);
    const cookie = bootstrap.headers["set-cookie"];
    expect(cookie).toContain("HttpOnly");
    expect(cookie).toContain("SameSite=Strict");
    const me = await app.inject({
      method: "GET",
      url: "/auth/me",
      headers: { cookie: cookie as string }
    });
    expect(me.statusCode).toBe(200);
    expect(me.json().actor.username).toBe("admin");
    const spoofed = await app.inject({
      method: "POST",
      url: "/auth/authorize",
      headers: { cookie: cookie as string },
      payload: {
        actorId: "different-actor",
        action: "read",
        resource: "published-game",
        fields: [],
        context: {}
      }
    });
    expect(spoofed.statusCode).toBe(403);
    await app.close();
  });
});
