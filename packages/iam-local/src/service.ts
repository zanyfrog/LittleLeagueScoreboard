import { createHash, randomBytes, randomUUID } from "node:crypto";
import { hash, verify } from "@node-rs/argon2";
import type {
  Actor,
  AuthMe,
  AuthorizeDecision,
  AuthorizeRequest,
  BootstrapAdminRequest,
  CreateUserRequest,
  DevelopmentProfile,
  IamService,
  LoginRequest,
  PermissionAssignment,
  PermissionRule,
  Restriction,
  Scope,
  Session
} from "@ll-score/contracts";
import type {
  AuditEvent,
  LocalIamState,
  LocalUser,
  StoredSession
} from "./model.js";
import { BUILTIN_PERMISSION_SETS, TEAM_ADMIN_ASSIGNABLE } from "./policy.js";
import { JsonlIamStore } from "./store.js";

export interface LocalIamOptions {
  recordsPath: string;
  auditPath: string;
  sessionLifetimeMs?: number;
  decisionLifetimeMs?: number;
  allowDevelopmentProfiles?: boolean;
  now?: () => Date;
}

export class LocalIamService implements IamService {
  readonly #store: JsonlIamStore;
  readonly #sessionLifetimeMs: number;
  readonly #decisionLifetimeMs: number;
  readonly #allowDevelopmentProfiles: boolean;
  readonly #now: () => Date;
  #state?: LocalIamState;

  constructor(options: LocalIamOptions) {
    this.#store = new JsonlIamStore(options.recordsPath, options.auditPath);
    this.#sessionLifetimeMs = options.sessionLifetimeMs ?? 8 * 60 * 60 * 1000;
    this.#decisionLifetimeMs = options.decisionLifetimeMs ?? 60 * 1000;
    this.#allowDevelopmentProfiles =
      options.allowDevelopmentProfiles ?? false;
    this.#now = options.now ?? (() => new Date());
  }

  async initialize(): Promise<void> {
    this.#state = await this.#store.load();
    for (const permissionSet of BUILTIN_PERMISSION_SETS) {
      if (!this.#state.permissionSets.has(permissionSet.key)) {
        await this.#store.append({ type: "permission-set", value: permissionSet });
        this.#state.permissionSets.set(permissionSet.key, permissionSet);
      }
    }
  }

  async isBootstrapAvailable(): Promise<boolean> {
    return (await this.#getState()).users.size === 0;
  }

  async bootstrapAdmin(input: BootstrapAdminRequest): Promise<Session> {
    const state = await this.#getState();
    if (state.users.size > 0) throw new Error("BOOTSTRAP_ALREADY_COMPLETED");
    const actor = await this.#createStoredUser(input, "system:bootstrap", false);
    await this.#createAssignment(actor.actorId, "Platform Admin", {
      type: "application",
      id: "little-league-scoreboard"
    }, "system:bootstrap");
    await this.#createAssignment(actor.actorId, "Security Admin", {
      type: "application",
      id: "little-league-scoreboard"
    }, "system:bootstrap");
    await this.#audit(actor.actorId, "bootstrap.admin", "user", actor.actorId,
      "allowed", "BOOTSTRAP_COMPLETED");
    return this.#issueSession(actor);
  }

  async login(input: LoginRequest): Promise<Session> {
    const state = await this.#getState();
    const user = state.usersByName.get(input.username.toLowerCase());
    const valid = user?.status === "active" &&
      await verify(user.passwordHash, input.password);
    if (!user || !valid) {
      await this.#audit("anonymous", "auth.login", "user", undefined,
        "denied", "INVALID_CREDENTIALS");
      throw new Error("INVALID_CREDENTIALS");
    }
    await this.#audit(user.actorId, "auth.login", "session", undefined,
      "allowed", "LOGIN_SUCCEEDED");
    return this.#issueSession(user);
  }

  async listDevelopmentProfiles(): Promise<DevelopmentProfile[]> {
    if (!this.#allowDevelopmentProfiles) return [];
    const state = await this.#getState();
    return [...state.users.values()]
      .filter((user) => user.developmentProfile && user.status === "active")
      .map(({ actorId, username, displayName }) => ({
        actorId,
        username,
        displayName
      }));
  }

  async loginDevelopmentProfile(actorId: string): Promise<Session> {
    if (!this.#allowDevelopmentProfiles) {
      throw new Error("DEVELOPMENT_LOGIN_DISABLED");
    }
    const user = (await this.#getState()).users.get(actorId);
    if (!user?.developmentProfile || user.status !== "active") {
      throw new Error("DEVELOPMENT_PROFILE_NOT_FOUND");
    }
    await this.#audit(user.actorId, "auth.development-login", "session",
      undefined, "allowed", "DEVELOPMENT_LOGIN_SUCCEEDED");
    return this.#issueSession(user);
  }

  async logout(sessionId: string): Promise<void> {
    const state = await this.#getState();
    const tokenHash = this.#tokenHash(sessionId);
    const stored = state.sessions.get(tokenHash);
    if (!stored) return;
    const updated = { ...stored, revokedAtUtc: this.#now().toISOString() };
    await this.#store.append({ type: "session", value: updated });
    state.sessions.set(tokenHash, updated);
    await this.#audit(stored.session.actor.actorId, "auth.logout", "session",
      stored.session.sessionId, "allowed", "LOGOUT_SUCCEEDED");
  }

  async getSession(sessionId: string): Promise<Session | null> {
    const state = await this.#getState();
    const stored = state.sessions.get(
      this.#tokenHash(sessionId)
    );
    if (!stored || stored.revokedAtUtc) return null;
    if (new Date(stored.session.expiresAtUtc) <= this.#now()) return null;
    const user = state.users.get(stored.session.actor.actorId);
    if (!user || user.status !== "active" ||
        user.securityVersion !== stored.session.securityVersion) return null;
    return {
      ...stored.session,
      sessionId,
      policyVersion: state.policyVersion
    };
  }

  async getAuthMe(sessionId?: string): Promise<AuthMe> {
    const state = await this.#getState();
    const session = sessionId ? await this.getSession(sessionId) : null;
    if (!session) {
      return {
        actor: null,
        session: null,
        roles: ["Public"],
        scopes: [{ type: "application", id: "little-league-scoreboard" }],
        uiClaims: { public: true },
        policyVersion: state.policyVersion
      };
    }
    const assignments = this.#activeAssignments(session.actor.actorId);
    const roles = [
      "Authenticated",
      ...assignments.map((item) => item.permissionSetKey)
    ];
    return {
      actor: session.actor,
      session,
      roles: [...new Set(roles)],
      scopes: assignments.map((item) => item.scope),
      uiClaims: this.#buildUiClaims(roles),
      policyVersion: state.policyVersion
    };
  }

  async authorize(input: AuthorizeRequest): Promise<AuthorizeDecision> {
    const state = await this.#getState();
    const user = input.actorId ? state.users.get(input.actorId) : undefined;
    const securityVersion = user?.securityVersion ?? 0;
    const restrictions = user
      ? this.#activeRestrictions(user.actorId, input.scope)
      : [];
    if (restrictions.some((item) =>
      this.#matches(item.action, input.action) &&
      this.#matches(item.resource, input.resource))) {
      const decision = this.#decision(
        "deny",
        "EXPLICIT_RESTRICTION",
        input.fields,
        state.policyVersion,
        securityVersion
      );
      await this.#audit(input.actorId ?? "anonymous", "auth.authorize",
        input.resource, undefined, "denied", decision.reasonCode);
      return decision;
    }

    const sets = user
      ? [
          state.permissionSets.get("Authenticated"),
          ...this.#activeAssignments(user.actorId)
          .filter((item) => this.#scopeMatches(item.scope, input.scope))
          .map((item) => state.permissionSets.get(item.permissionSetKey))
        ]
      : [state.permissionSets.get("Public")];
    const rules = sets.flatMap((set) => set?.rules ?? []);
    const matching = rules.filter((rule) =>
      this.#matches(rule.action, input.action) &&
      this.#matches(rule.resource, input.resource));
    const resourceDenied = matching.some((rule) =>
      rule.effect === "deny" && !rule.fields?.length);
    const resourceAllowed = matching.some((rule) => rule.effect === "allow");
    const fields = input.fields.map((field) => ({
      field,
      access: this.#fieldAllowed(matching, field) ? "allow" as const : "deny" as const
    }));
    const allowedFieldCount = fields.filter((field) => field.access === "allow").length;
    const decisionType = !resourceAllowed || resourceDenied
      ? "deny"
      : allowedFieldCount < fields.length
        ? "partial"
        : "allow";
    const decision: AuthorizeDecision = {
      decision: decisionType,
      reasonCode: decisionType === "allow"
        ? "PERMISSION_GRANTED"
        : decisionType === "partial"
          ? "PARTIAL_FIELD_ACCESS"
          : "DEFAULT_DENY",
      fields,
      policyVersion: state.policyVersion,
      actorSecurityVersion: securityVersion,
      expiresAtUtc: new Date(
        this.#now().getTime() + this.#decisionLifetimeMs
      ).toISOString()
    };
    if (decision.decision === "deny") {
      await this.#audit(input.actorId ?? "anonymous", "auth.authorize",
        input.resource, undefined, "denied", decision.reasonCode);
    }
    return decision;
  }

  async createUser(input: CreateUserRequest, actorId: string): Promise<Actor> {
    await this.#require(actorId, "create", "security");
    const actor = await this.#createStoredUser(input, actorId, false);
    if (input.permissionSetKey && input.scope) {
      await this.#createAssignment(
        actor.actorId,
        input.permissionSetKey,
        input.scope,
        actorId
      );
    }
    await this.#audit(actorId, "security.user.create", "user", actor.actorId,
      "allowed", "USER_CREATED");
    return actor;
  }

  async createDevelopmentProfile(
    input: CreateUserRequest,
    actorId: string
  ): Promise<Actor> {
    if (!this.#allowDevelopmentProfiles) {
      throw new Error("DEVELOPMENT_LOGIN_DISABLED");
    }
    await this.#require(actorId, "create", "security");
    return this.#createStoredUser(input, actorId, true);
  }

  async assignPermission(
    input: Omit<PermissionAssignment, "assignmentId">,
    actorId: string
  ): Promise<PermissionAssignment> {
    await this.#assertCanAssign(actorId, input.permissionSetKey, input.scope);
    return this.#createAssignment(
      input.actorId,
      input.permissionSetKey,
      input.scope,
      actorId,
      input
    );
  }

  async addRestriction(
    input: Omit<Restriction, "restrictionId">,
    actorId: string
  ): Promise<Restriction> {
    await this.#require(actorId, "create", "security");
    const state = await this.#getState();
    const restriction: Restriction = {
      ...input,
      restrictionId: randomUUID()
    };
    await this.#store.append({ type: "restriction", value: restriction });
    state.restrictions.push(restriction);
    await this.#incrementPolicyVersion();
    await this.#audit(actorId, "security.restriction.create", "user",
      input.actorId, "allowed", "RESTRICTION_CREATED");
    return restriction;
  }

  async #createStoredUser(
    input: BootstrapAdminRequest,
    createdBy: string,
    developmentProfile: boolean
  ): Promise<LocalUser> {
    const state = await this.#getState();
    const username = input.username.trim().toLowerCase();
    if (state.usersByName.has(username)) throw new Error("USERNAME_EXISTS");
    const user: LocalUser = {
      actorId: randomUUID(),
      actorType: "user",
      username,
      displayName: input.displayName.trim(),
      passwordHash: await hash(input.password, {
        algorithm: 2,
        memoryCost: 19456,
        timeCost: 2,
        parallelism: 1
      }),
      status: "active",
      securityVersion: 1,
      createdAtUtc: this.#now().toISOString(),
      createdBy,
      developmentProfile
    };
    await this.#store.append({ type: "user", value: user });
    state.users.set(user.actorId, user);
    state.usersByName.set(username, user);
    return user;
  }

  async #issueSession(user: LocalUser): Promise<Session> {
    const state = await this.#getState();
    const token = randomBytes(32).toString("base64url");
    const now = this.#now();
    const session: Session = {
      sessionId: token,
      actor: {
        actorId: user.actorId,
        actorType: "user",
        username: user.username,
        displayName: user.displayName
      },
      createdAtUtc: now.toISOString(),
      expiresAtUtc: new Date(now.getTime() + this.#sessionLifetimeMs).toISOString(),
      securityVersion: user.securityVersion,
      policyVersion: state.policyVersion
    };
    const stored: StoredSession = {
      tokenHash: this.#tokenHash(token),
      session: { ...session, sessionId: randomUUID() }
    };
    await this.#store.append({ type: "session", value: stored });
    state.sessions.set(stored.tokenHash, stored);
    return session;
  }

  async #createAssignment(
    actorId: string,
    permissionSetKey: string,
    scope: Scope,
    grantedBy: string,
    values?: Omit<PermissionAssignment, "assignmentId">
  ): Promise<PermissionAssignment> {
    const state = await this.#getState();
    const permissionSet = state.permissionSets.get(permissionSetKey);
    if (!permissionSet?.active) throw new Error("PERMISSION_SET_NOT_FOUND");
    if (!permissionSet.assignableScopes.includes(scope.type)) {
      throw new Error("INVALID_ASSIGNMENT_SCOPE");
    }
    const assignment: PermissionAssignment = {
      assignmentId: randomUUID(),
      actorId,
      permissionSetKey,
      scope,
      effectiveStartUtc: values?.effectiveStartUtc ?? this.#now().toISOString(),
      effectiveEndUtc: values?.effectiveEndUtc,
      status: values?.status ?? "active",
      grantedBy
    };
    await this.#store.append({ type: "assignment", value: assignment });
    state.assignments.push(assignment);
    await this.#incrementPolicyVersion();
    await this.#audit(grantedBy, "security.assignment.create", "user", actorId,
      "allowed", "ASSIGNMENT_CREATED");
    return assignment;
  }

  async #assertCanAssign(
    actorId: string,
    permissionSetKey: string,
    scope: Scope
  ): Promise<void> {
    const security = await this.authorize({
      actorId,
      action: "create",
      resource: "security",
      scope,
      fields: [],
      context: {}
    });
    if (security.decision === "allow") return;
    const teamAdmin = this.#activeAssignments(actorId).some((item) =>
      item.permissionSetKey === "Team Admin" &&
      item.scope.type === "team" &&
      scope.type === "team" &&
      item.scope.id === scope.id);
    if (!teamAdmin || !TEAM_ADMIN_ASSIGNABLE.has(permissionSetKey)) {
      throw new Error("ASSIGNMENT_NOT_ALLOWED");
    }
  }

  async #require(actorId: string, action: string, resource: string): Promise<void> {
    const decision = await this.authorize({
      actorId,
      action,
      resource,
      fields: [],
      context: {}
    });
    if (decision.decision !== "allow") throw new Error("NOT_AUTHORIZED");
  }

  #activeAssignments(actorId: string): PermissionAssignment[] {
    const state = this.#state;
    if (!state) return [];
    const now = this.#now();
    return state.assignments.filter((item) =>
      item.actorId === actorId &&
      item.status === "active" &&
      new Date(item.effectiveStartUtc) <= now &&
      (!item.effectiveEndUtc || new Date(item.effectiveEndUtc) > now));
  }

  #activeRestrictions(actorId: string, scope?: Scope): Restriction[] {
    const state = this.#state;
    if (!state) return [];
    const now = this.#now();
    return state.restrictions.filter((item) =>
      item.actorId === actorId &&
      item.status === "active" &&
      new Date(item.effectiveStartUtc) <= now &&
      (!item.effectiveEndUtc || new Date(item.effectiveEndUtc) > now) &&
      (!item.scope || this.#scopeMatches(item.scope, scope)));
  }

  #scopeMatches(grant: Scope, requested?: Scope): boolean {
    if (!requested) return grant.type === "application";
    if (grant.type === "application") return true;
    return grant.type === requested.type && grant.id === requested.id;
  }

  #matches(rule: string, value: string): boolean {
    return rule === "*" || rule === value;
  }

  #fieldAllowed(rules: PermissionRule[], field: string): boolean {
    const denied = rules.some((rule) =>
      rule.effect === "deny" &&
      (!rule.fields?.length || rule.fields.includes(field)));
    if (denied) return false;
    return rules.some((rule) =>
      rule.effect === "allow" &&
      (!rule.fields?.length || rule.fields.includes(field)));
  }

  #decision(
    decision: "allow" | "deny" | "partial",
    reasonCode: string,
    fields: string[],
    policyVersion: number,
    actorSecurityVersion: number
  ): AuthorizeDecision {
    return {
      decision,
      reasonCode,
      fields: fields.map((field) => ({
        field,
        access: decision === "allow" ? "allow" : "deny"
      })),
      policyVersion,
      actorSecurityVersion,
      expiresAtUtc: new Date(
        this.#now().getTime() + this.#decisionLifetimeMs
      ).toISOString()
    };
  }

  #buildUiClaims(permissionSets: string[]): Record<string, unknown> {
    return {
      navigation: {
        dashboard: true,
        scoring: permissionSets.includes("Scorer"),
        teamAdmin: permissionSets.includes("Team Admin"),
        securityAdmin: permissionSets.includes("Security Admin")
      }
    };
  }

  async #incrementPolicyVersion(): Promise<void> {
    const state = await this.#getState();
    state.policyVersion += 1;
    await this.#store.append({
      type: "policy-version",
      value: state.policyVersion
    });
  }

  async #audit(
    actorId: string,
    action: string,
    targetType: string,
    targetId: string | undefined,
    decision: AuditEvent["decision"],
    reasonCode: string
  ): Promise<void> {
    const state = await this.#getState();
    await this.#store.appendAudit({
      eventId: randomUUID(),
      timestampUtc: this.#now().toISOString(),
      actorId,
      action,
      targetType,
      targetId,
      decision,
      reasonCode,
      policyVersion: state.policyVersion,
      metadata: {}
    });
  }

  #tokenHash(token: string): string {
    return createHash("sha256").update(token).digest("hex");
  }

  async #getState(): Promise<LocalIamState> {
    if (!this.#state) await this.initialize();
    return this.#state as LocalIamState;
  }
}
