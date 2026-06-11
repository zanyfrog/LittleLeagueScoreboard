import type {
  Actor,
  PermissionAssignment,
  PermissionSet,
  Restriction,
  Session
} from "@ll-score/contracts";

export interface LocalUser extends Actor {
  passwordHash: string;
  status: "active" | "disabled";
  securityVersion: number;
  createdAtUtc: string;
  createdBy: string;
  developmentProfile: boolean;
}

export interface StoredSession {
  tokenHash: string;
  session: Session;
  revokedAtUtc?: string;
}

export interface AuditEvent {
  eventId: string;
  timestampUtc: string;
  actorId: string;
  action: string;
  targetType: string;
  targetId?: string;
  decision: "allowed" | "denied" | "error";
  reasonCode: string;
  policyVersion: number;
  metadata: Record<string, unknown>;
}

export interface LocalIamState {
  users: Map<string, LocalUser>;
  usersByName: Map<string, LocalUser>;
  permissionSets: Map<string, PermissionSet>;
  assignments: PermissionAssignment[];
  restrictions: Restriction[];
  sessions: Map<string, StoredSession>;
  policyVersion: number;
}

export type StoreRecord =
  | { type: "user"; value: LocalUser }
  | { type: "permission-set"; value: PermissionSet }
  | { type: "assignment"; value: PermissionAssignment }
  | { type: "restriction"; value: Restriction }
  | { type: "session"; value: StoredSession }
  | { type: "policy-version"; value: number };
