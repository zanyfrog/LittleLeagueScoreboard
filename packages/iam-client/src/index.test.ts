import { describe, expect, it, vi } from "vitest";
import { IamHttpClient } from "./index.js";

describe("IamHttpClient", () => {
  it("sends authorization requests through the configured endpoint", async () => {
    const fetch = vi.fn(async () => new Response(JSON.stringify({
      decision: "allow",
      reasonCode: "PERMISSION_GRANTED",
      fields: [],
      policyVersion: 1,
      actorSecurityVersion: 1,
      expiresAtUtc: new Date(Date.now() + 60_000).toISOString()
    }), {
      status: 200,
      headers: { "content-type": "application/json" }
    }));
    const client = new IamHttpClient({
      baseUrl: "http://localhost:4310/",
      fetch
    });
    const result = await client.authorize({
      actorId: "actor-1",
      action: "read",
      resource: "published-game",
      fields: [],
      context: {}
    });
    expect(result.decision).toBe("allow");
    expect(fetch).toHaveBeenCalledOnce();
    expect(fetch.mock.calls[0]?.[0]).toBe(
      "http://localhost:4310/auth/authorize"
    );
  });
});
