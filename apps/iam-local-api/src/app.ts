import cookie from "@fastify/cookie";
import {
  authorizeRequestSchema,
  bootstrapAdminRequestSchema,
  createUserRequestSchema,
  loginRequestSchema,
  permissionAssignmentSchema,
  restrictionSchema
} from "@ll-score/contracts";
import type { LocalIamService } from "@ll-score/iam-local";
import Fastify, {
  type FastifyInstance,
  type FastifyReply
} from "fastify";
import { z } from "zod";

export interface CreateIamAppOptions {
  service: LocalIamService;
  secureCookies?: boolean;
}

const sessionCookie = "ll_score_session";

export async function createIamApp(
  options: CreateIamAppOptions
): Promise<FastifyInstance> {
  const app = Fastify({ logger: false });
  await app.register(cookie);

  const setSessionCookie = (
    reply: FastifyReply,
    sessionId: string,
    expiresAtUtc: string
  ) => {
    reply.setCookie(sessionCookie, sessionId, {
      httpOnly: true,
      sameSite: "strict",
      secure: options.secureCookies ?? false,
      path: "/",
      expires: new Date(expiresAtUtc)
    });
  };

  app.setErrorHandler((error, _request, reply) => {
    if (error instanceof z.ZodError) {
      return reply.status(400).send({
        error: "VALIDATION_ERROR",
        issues: error.issues
      });
    }
    const code = error instanceof Error ? error.message : "INTERNAL_ERROR";
    const status = [
      "INVALID_CREDENTIALS",
      "NOT_AUTHORIZED",
      "ASSIGNMENT_NOT_ALLOWED"
    ].includes(code) ? 403 :
      code === "BOOTSTRAP_ALREADY_COMPLETED" ? 409 :
      code.endsWith("_NOT_FOUND") ? 404 : 400;
    return reply.status(status).send({ error: code });
  });

  app.get("/health/live", async () => ({ status: "live" }));
  app.get("/health/ready", async () => {
    await options.service.isBootstrapAvailable();
    return { status: "ready" };
  });
  app.get("/api/v1/capabilities", async () => ({
    capabilities: [
      "local-authentication",
      "cookie-sessions",
      "authorization",
      "permission-assignments",
      "restrictions",
      "audit"
    ]
  }));

  app.get("/bootstrap/status", async () => ({
    available: await options.service.isBootstrapAvailable()
  }));

  app.post("/bootstrap/admin", async (request, reply) => {
    const input = bootstrapAdminRequestSchema.parse(request.body);
    const session = await options.service.bootstrapAdmin(input);
    setSessionCookie(reply, session.sessionId, session.expiresAtUtc);
    return session;
  });

  app.post("/auth/login", async (request, reply) => {
    const input = loginRequestSchema.parse(request.body);
    const session = await options.service.login(input);
    setSessionCookie(reply, session.sessionId, session.expiresAtUtc);
    return session;
  });

  app.get("/auth/development-profiles", async () =>
    options.service.listDevelopmentProfiles());

  app.post("/auth/login/development", async (request, reply) => {
    const { actorId } = z.object({ actorId: z.string().min(1) }).parse(request.body);
    const session = await options.service.loginDevelopmentProfile(actorId);
    setSessionCookie(reply, session.sessionId, session.expiresAtUtc);
    return session;
  });

  app.post("/auth/logout", async (request, reply) => {
    const body = z.object({ sessionId: z.string().min(1).optional() })
      .parse(request.body ?? {});
    const sessionId = body.sessionId ?? request.cookies[sessionCookie];
    if (sessionId) await options.service.logout(sessionId);
    reply.clearCookie(sessionCookie, { path: "/" });
    return reply.status(204).send();
  });

  app.get("/auth/sessions/:sessionId", async (request) => {
    const { sessionId } = z.object({ sessionId: z.string().min(1) })
      .parse(request.params);
    return options.service.getSession(sessionId);
  });

  app.get("/auth/me", async (request) => {
    const sessionId = request.cookies[sessionCookie] ??
      request.headers["x-session-id"]?.toString();
    return options.service.getAuthMe(sessionId);
  });

  app.post("/auth/authorize", async (request) => {
    const input = authorizeRequestSchema.parse(request.body);
    const session = await getRequestSession(request, options.service);
    if (input.actorId && input.actorId !== session?.actor.actorId) {
      throw new Error("NOT_AUTHORIZED");
    }
    return options.service.authorize({
      ...input,
      actorId: session?.actor.actorId
    });
  });

  app.post("/api/security/users", async (request) => {
    const input = createUserRequestSchema.parse(request.body);
    const actorId = await requireSessionActor(request, options.service);
    return options.service.createUser(input, actorId);
  });

  app.post("/api/security/development-profiles", async (request) => {
    const input = createUserRequestSchema.parse(request.body);
    const actorId = await requireSessionActor(request, options.service);
    return options.service.createDevelopmentProfile(input, actorId);
  });

  app.post("/api/security/assignments", async (request) => {
    const parsed = permissionAssignmentSchema
      .omit({ assignmentId: true })
      .parse(request.body);
    const actorId = await requireSessionActor(request, options.service);
    return options.service.assignPermission(parsed, actorId);
  });

  app.post("/api/security/restrictions", async (request) => {
    const parsed = restrictionSchema
      .omit({ restrictionId: true })
      .parse(request.body);
    const actorId = await requireSessionActor(request, options.service);
    return options.service.addRestriction(parsed, actorId);
  });

  return app;
}

async function getRequestSession(
  request: {
    cookies: Record<string, string | undefined>;
    headers: Record<string, string | string[] | undefined>;
  },
  service: LocalIamService
) {
  const explicit = request.headers["x-session-id"];
  const sessionId = request.cookies[sessionCookie] ??
    (Array.isArray(explicit) ? explicit[0] : explicit);
  return sessionId ? service.getSession(sessionId) : null;
}

async function requireSessionActor(
  request: {
    cookies: Record<string, string | undefined>;
    headers: Record<string, string | string[] | undefined>;
  },
  service: LocalIamService
): Promise<string> {
  const session = await getRequestSession(request, service);
  if (!session) throw new Error("NOT_AUTHORIZED");
  return session.actor.actorId;
}
