import { z } from "zod";

export const scopeTypeSchema = z.enum([
  "application",
  "organization",
  "team",
  "season",
  "team-season",
  "game",
  "player"
]);
export type ScopeType = z.infer<typeof scopeTypeSchema>;

export const scopeSchema = z.object({
  type: scopeTypeSchema,
  id: z.string().min(1)
});
export type Scope = z.infer<typeof scopeSchema>;

export const actorSchema = z.object({
  actorId: z.string().min(1),
  username: z.string().min(1),
  displayName: z.string().min(1),
  actorType: z.literal("user").default("user")
});
export type Actor = z.infer<typeof actorSchema>;

export const permissionEffectSchema = z.enum(["allow", "deny"]);
export type PermissionEffect = z.infer<typeof permissionEffectSchema>;

export const permissionRuleSchema = z.object({
  action: z.string().min(1),
  resource: z.string().min(1),
  effect: permissionEffectSchema,
  fields: z.array(z.string().min(1)).optional()
});
export type PermissionRule = z.infer<typeof permissionRuleSchema>;

export const permissionSetSchema = z.object({
  key: z.string().min(1),
  version: z.number().int().positive(),
  name: z.string().min(1),
  rules: z.array(permissionRuleSchema),
  assignableScopes: z.array(scopeTypeSchema),
  active: z.boolean()
});
export type PermissionSet = z.infer<typeof permissionSetSchema>;

export const permissionAssignmentSchema = z.object({
  assignmentId: z.string().uuid(),
  actorId: z.string().min(1),
  permissionSetKey: z.string().min(1),
  scope: scopeSchema,
  effectiveStartUtc: z.string().datetime(),
  effectiveEndUtc: z.string().datetime().optional(),
  status: z.enum(["active", "revoked"]),
  grantedBy: z.string().min(1)
});
export type PermissionAssignment = z.infer<typeof permissionAssignmentSchema>;

export const restrictionSchema = z.object({
  restrictionId: z.string().uuid(),
  actorId: z.string().min(1),
  action: z.string().min(1),
  resource: z.string().min(1),
  scope: scopeSchema.optional(),
  reason: z.string().min(1),
  effectiveStartUtc: z.string().datetime(),
  effectiveEndUtc: z.string().datetime().optional(),
  status: z.enum(["active", "revoked"]),
  createdBy: z.string().min(1)
});
export type Restriction = z.infer<typeof restrictionSchema>;

export const authorizeRequestSchema = z.object({
  actorId: z.string().min(1).optional(),
  action: z.string().min(1),
  resource: z.string().min(1),
  scope: scopeSchema.optional(),
  fields: z.array(z.string().min(1)).default([]),
  context: z.record(z.unknown()).default({})
});
export type AuthorizeRequest = z.infer<typeof authorizeRequestSchema>;

export const fieldDecisionSchema = z.object({
  field: z.string(),
  access: z.enum(["allow", "deny", "mask", "omit"])
});
export type FieldDecision = z.infer<typeof fieldDecisionSchema>;

export const authorizeDecisionSchema = z.object({
  decision: z.enum(["allow", "deny", "partial"]),
  reasonCode: z.string().min(1),
  fields: z.array(fieldDecisionSchema),
  policyVersion: z.number().int().nonnegative(),
  actorSecurityVersion: z.number().int().nonnegative(),
  expiresAtUtc: z.string().datetime()
});
export type AuthorizeDecision = z.infer<typeof authorizeDecisionSchema>;

export const loginRequestSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(12)
});
export type LoginRequest = z.infer<typeof loginRequestSchema>;

export const developmentProfileSchema = z.object({
  actorId: z.string().min(1),
  username: z.string().min(1),
  displayName: z.string().min(1)
});
export type DevelopmentProfile = z.infer<typeof developmentProfileSchema>;

export const bootstrapAdminRequestSchema = z.object({
  username: z.string().min(3),
  password: z.string().min(12),
  displayName: z.string().min(1)
});
export type BootstrapAdminRequest = z.infer<typeof bootstrapAdminRequestSchema>;

export const createUserRequestSchema = bootstrapAdminRequestSchema.extend({
  permissionSetKey: z.string().min(1).optional(),
  scope: scopeSchema.optional()
});
export type CreateUserRequest = z.infer<typeof createUserRequestSchema>;

export const sessionSchema = z.object({
  sessionId: z.string().uuid(),
  actor: actorSchema,
  createdAtUtc: z.string().datetime(),
  expiresAtUtc: z.string().datetime(),
  securityVersion: z.number().int().nonnegative(),
  policyVersion: z.number().int().nonnegative()
});
export type Session = z.infer<typeof sessionSchema>;

export const authMeSchema = z.object({
  actor: actorSchema.nullable(),
  session: sessionSchema.nullable(),
  roles: z.array(z.string()),
  scopes: z.array(scopeSchema),
  uiClaims: z.record(z.unknown()),
  policyVersion: z.number().int().nonnegative()
});
export type AuthMe = z.infer<typeof authMeSchema>;

export interface IamService {
  isBootstrapAvailable(): Promise<boolean>;
  bootstrapAdmin(input: BootstrapAdminRequest): Promise<Session>;
  login(input: LoginRequest): Promise<Session>;
  listDevelopmentProfiles(): Promise<DevelopmentProfile[]>;
  loginDevelopmentProfile(actorId: string): Promise<Session>;
  logout(sessionId: string): Promise<void>;
  getSession(sessionId: string): Promise<Session | null>;
  getAuthMe(sessionId?: string): Promise<AuthMe>;
  authorize(input: AuthorizeRequest): Promise<AuthorizeDecision>;
  createUser(input: CreateUserRequest, actorId: string): Promise<Actor>;
  assignPermission(
    assignment: Omit<PermissionAssignment, "assignmentId">,
    actorId: string
  ): Promise<PermissionAssignment>;
  addRestriction(
    restriction: Omit<Restriction, "restrictionId">,
    actorId: string
  ): Promise<Restriction>;
}
