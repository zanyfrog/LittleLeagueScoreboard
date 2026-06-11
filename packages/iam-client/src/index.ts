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
  Restriction,
  Session
} from "@ll-score/contracts";

export interface IamHttpClientOptions {
  baseUrl: string;
  fetch?: typeof globalThis.fetch;
}

export class IamHttpClient implements IamService {
  readonly #baseUrl: string;
  readonly #fetch: typeof globalThis.fetch;
  #sessionId?: string;

  constructor(options: IamHttpClientOptions) {
    this.#baseUrl = options.baseUrl.replace(/\/$/, "");
    this.#fetch = options.fetch ?? globalThis.fetch;
  }

  setSessionId(sessionId?: string): void {
    this.#sessionId = sessionId;
  }

  async #request<T>(path: string, init?: RequestInit): Promise<T> {
    const headers = new Headers(init?.headers);
    headers.set("content-type", "application/json");
    if (this.#sessionId) headers.set("x-session-id", this.#sessionId);
    const response = await this.#fetch(`${this.#baseUrl}${path}`, {
      ...init,
      headers
    });
    if (!response.ok) {
      const body = await response.text();
      throw new Error(`I-AM ${response.status}: ${body}`);
    }
    if (response.status === 204) return undefined as T;
    return response.json() as Promise<T>;
  }

  isBootstrapAvailable(): Promise<boolean> {
    return this.#request<{ available: boolean }>("/bootstrap/status")
      .then((result) => result.available);
  }

  bootstrapAdmin(input: BootstrapAdminRequest): Promise<Session> {
    return this.#request("/bootstrap/admin", {
      method: "POST",
      body: JSON.stringify(input)
    });
  }

  login(input: LoginRequest): Promise<Session> {
    return this.#request("/auth/login", {
      method: "POST",
      body: JSON.stringify(input)
    });
  }

  listDevelopmentProfiles(): Promise<DevelopmentProfile[]> {
    return this.#request("/auth/development-profiles");
  }

  loginDevelopmentProfile(actorId: string): Promise<Session> {
    return this.#request("/auth/login/development", {
      method: "POST",
      body: JSON.stringify({ actorId })
    });
  }

  logout(sessionId: string): Promise<void> {
    return this.#request("/auth/logout", {
      method: "POST",
      body: JSON.stringify({ sessionId })
    });
  }

  getSession(sessionId: string): Promise<Session | null> {
    return this.#request(`/auth/sessions/${encodeURIComponent(sessionId)}`);
  }

  getAuthMe(sessionId?: string): Promise<AuthMe> {
    const previous = this.#sessionId;
    if (sessionId) this.#sessionId = sessionId;
    return this.#request<AuthMe>("/auth/me").finally(() => {
      this.#sessionId = previous;
    });
  }

  authorize(input: AuthorizeRequest): Promise<AuthorizeDecision> {
    return this.#request("/auth/authorize", {
      method: "POST",
      body: JSON.stringify(input)
    });
  }

  createUser(input: CreateUserRequest, actorId: string): Promise<Actor> {
    void actorId;
    return this.#request("/api/security/users", {
      method: "POST",
      body: JSON.stringify(input)
    });
  }

  assignPermission(
    assignment: Omit<PermissionAssignment, "assignmentId">,
    actorId: string
  ): Promise<PermissionAssignment> {
    void actorId;
    return this.#request("/api/security/assignments", {
      method: "POST",
      body: JSON.stringify(assignment)
    });
  }

  addRestriction(
    restriction: Omit<Restriction, "restrictionId">,
    actorId: string
  ): Promise<Restriction> {
    void actorId;
    return this.#request("/api/security/restrictions", {
      method: "POST",
      body: JSON.stringify(restriction)
    });
  }
}
