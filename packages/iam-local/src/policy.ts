import type { PermissionSet } from "@ll-score/contracts";

export const BUILTIN_PERMISSION_SETS: PermissionSet[] = [
  {
    key: "Public",
    version: 1,
    name: "Public",
    active: true,
    assignableScopes: ["application"],
    rules: [
      { action: "read", resource: "published-game", effect: "allow" },
      { action: "read", resource: "published-replay", effect: "allow" }
    ]
  },
  {
    key: "Authenticated",
    version: 1,
    name: "Authenticated",
    active: true,
    assignableScopes: ["application"],
    rules: [{ action: "read", resource: "own-profile", effect: "allow" }]
  },
  {
    key: "Player",
    version: 1,
    name: "Player",
    active: true,
    assignableScopes: ["team", "season", "team-season"],
    rules: [
      { action: "read", resource: "team-game", effect: "allow" },
      { action: "read", resource: "own-player-profile", effect: "allow" }
    ]
  },
  {
    key: "Parent/Guardian",
    version: 1,
    name: "Parent or Guardian",
    active: true,
    assignableScopes: ["team", "player"],
    rules: [
      { action: "read", resource: "team-game", effect: "allow" },
      { action: "read", resource: "linked-player-detail", effect: "allow" },
      { action: "create", resource: "media-upload", effect: "allow" }
    ]
  },
  {
    key: "Scorer",
    version: 1,
    name: "Scorer",
    active: true,
    assignableScopes: ["team", "game"],
    rules: [
      { action: "*", resource: "game-scoring", effect: "allow" },
      { action: "create", resource: "media-upload", effect: "allow" }
    ]
  },
  {
    key: "Coach",
    version: 1,
    name: "Coach",
    active: true,
    assignableScopes: ["team", "team-season"],
    rules: [
      { action: "read", resource: "team-data", effect: "allow" },
      { action: "approve", resource: "game-publication", effect: "allow" },
      { action: "approve", resource: "media", effect: "allow" },
      { action: "override", resource: "pitch-limit", effect: "allow" }
    ]
  },
  {
    key: "Team Admin",
    version: 1,
    name: "Team Administrator",
    active: true,
    assignableScopes: ["team", "team-season"],
    rules: [
      { action: "*", resource: "team-data", effect: "allow" },
      { action: "assign", resource: "team-permission", effect: "allow" },
      { action: "approve", resource: "media", effect: "allow" }
    ]
  },
  {
    key: "Platform Admin",
    version: 1,
    name: "Platform Administrator",
    active: true,
    assignableScopes: ["application"],
    rules: [{ action: "*", resource: "*", effect: "allow" }]
  },
  {
    key: "Security Admin",
    version: 1,
    name: "Security Administrator",
    active: true,
    assignableScopes: ["application", "organization"],
    rules: [{ action: "*", resource: "security", effect: "allow" }]
  }
];

export const TEAM_ADMIN_ASSIGNABLE = new Set([
  "Player",
  "Parent/Guardian",
  "Scorer",
  "Coach"
]);
