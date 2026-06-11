import { mkdtemp } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { beforeEach, describe, expect, it } from "vitest";
import { LocalIamService } from "./service.js";
import { JsonlIamStore } from "./store.js";

describe("LocalIamService", () => {
  let service: LocalIamService;

  beforeEach(async () => {
    const directory = await mkdtemp(join(tmpdir(), "ll-score-iam-"));
    service = new LocalIamService({
      recordsPath: join(directory, "iam.jsonl"),
      auditPath: join(directory, "audit.jsonl"),
      allowDevelopmentProfiles: true
    });
    await service.initialize();
  });

  it("allows one bootstrap and authenticates with Argon2id credentials", async () => {
    expect(await service.isBootstrapAvailable()).toBe(true);
    const session = await service.bootstrapAdmin({
      username: "admin",
      password: "correct horse battery staple",
      displayName: "Local Admin"
    });
    expect(session.actor.username).toBe("admin");
    expect(await service.isBootstrapAvailable()).toBe(false);
    await expect(service.bootstrapAdmin({
      username: "other",
      password: "another valid password",
      displayName: "Other"
    })).rejects.toThrow("BOOTSTRAP_ALREADY_COMPLETED");
    const login = await service.login({
      username: "admin",
      password: "correct horse battery staple"
    });
    expect(await service.getSession(login.sessionId)).not.toBeNull();
  });

  it("evaluates anonymous requests as Public without a session", async () => {
    const allowed = await service.authorize({
      action: "read",
      resource: "published-game",
      fields: [],
      context: {}
    });
    const denied = await service.authorize({
      action: "update",
      resource: "game-scoring",
      fields: [],
      context: {}
    });
    expect(allowed.decision).toBe("allow");
    expect(denied.decision).toBe("deny");
  });

  it("gives explicit restrictions precedence over grants", async () => {
    const admin = await service.bootstrapAdmin({
      username: "admin",
      password: "correct horse battery staple",
      displayName: "Local Admin"
    });
    await service.addRestriction({
      actorId: admin.actor.actorId,
      action: "read",
      resource: "published-game",
      reason: "test restriction",
      effectiveStartUtc: new Date().toISOString(),
      status: "active",
      createdBy: admin.actor.actorId
    }, admin.actor.actorId);
    const decision = await service.authorize({
      actorId: admin.actor.actorId,
      action: "read",
      resource: "published-game",
      fields: [],
      context: {}
    });
    expect(decision.decision).toBe("deny");
    expect(decision.reasonCode).toBe("EXPLICIT_RESTRICTION");
  });

  it("limits Team Admin delegation to approved roles and its own team", async () => {
    const admin = await service.bootstrapAdmin({
      username: "admin",
      password: "correct horse battery staple",
      displayName: "Local Admin"
    });
    const teamAdmin = await service.createUser({
      username: "teamadmin",
      password: "team administrator password",
      displayName: "Team Admin"
    }, admin.actor.actorId);
    const player = await service.createUser({
      username: "player",
      password: "player account password",
      displayName: "Player"
    }, admin.actor.actorId);
    await service.assignPermission({
      actorId: teamAdmin.actorId,
      permissionSetKey: "Team Admin",
      scope: { type: "team", id: "team-a" },
      effectiveStartUtc: new Date().toISOString(),
      status: "active",
      grantedBy: admin.actor.actorId
    }, admin.actor.actorId);
    await expect(service.assignPermission({
      actorId: player.actorId,
      permissionSetKey: "Player",
      scope: { type: "team", id: "team-a" },
      effectiveStartUtc: new Date().toISOString(),
      status: "active",
      grantedBy: teamAdmin.actorId
    }, teamAdmin.actorId)).resolves.toMatchObject({
      permissionSetKey: "Player"
    });
    await expect(service.assignPermission({
      actorId: player.actorId,
      permissionSetKey: "Security Admin",
      scope: { type: "application", id: "little-league-scoreboard" },
      effectiveStartUtc: new Date().toISOString(),
      status: "active",
      grantedBy: teamAdmin.actorId
    }, teamAdmin.actorId)).rejects.toThrow("ASSIGNMENT_NOT_ALLOWED");
  });

  it("returns partial when a grant allows only requested fields", async () => {
    const directory = await mkdtemp(join(tmpdir(), "ll-score-iam-fields-"));
    const recordsPath = join(directory, "iam.jsonl");
    const fieldStore = new JsonlIamStore(recordsPath, join(directory, "audit.jsonl"));
    await fieldStore.append({
      type: "permission-set",
      value: {
        key: "Profile Summary",
        version: 1,
        name: "Profile Summary",
        active: true,
        assignableScopes: ["application"],
        rules: [{
          action: "read",
          resource: "player-profile",
          effect: "allow",
          fields: ["displayName"]
        }]
      }
    });
    const fieldService = new LocalIamService({
      recordsPath,
      auditPath: join(directory, "audit.jsonl")
    });
    await fieldService.initialize();
    const admin = await fieldService.bootstrapAdmin({
      username: "admin",
      password: "correct horse battery staple",
      displayName: "Local Admin"
    });
    const user = await fieldService.createUser({
      username: "viewer",
      password: "viewer account password",
      displayName: "Viewer"
    }, admin.actor.actorId);
    await fieldService.assignPermission({
      actorId: user.actorId,
      permissionSetKey: "Profile Summary",
      scope: {
        type: "application",
        id: "little-league-scoreboard"
      },
      effectiveStartUtc: new Date().toISOString(),
      status: "active",
      grantedBy: admin.actor.actorId
    }, admin.actor.actorId);
    const decision = await fieldService.authorize({
      actorId: user.actorId,
      action: "read",
      resource: "player-profile",
      fields: ["displayName", "privateNote"],
      context: {}
    });
    expect(decision.decision).toBe("partial");
    expect(decision.fields).toEqual([
      { field: "displayName", access: "allow" },
      { field: "privateNote", access: "deny" }
    ]);
  });
});
