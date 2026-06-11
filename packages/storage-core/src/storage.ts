import type {
  AuditRepository,
  GameRepository,
  MembershipRepository,
  OrganizationRepository,
  PersonRepository,
  PlayerRepository,
  RelationshipRepository,
  RosterRepository,
  SeasonRepository,
  TeamRepository
} from "./repositories/index.js";
import type { GameEventStore } from "./event-store/game-event-store.js";
import type { TransactionManager } from "./transaction/transaction-manager.js";

export interface StorageRepositories {
  people: PersonRepository;
  players: PlayerRepository;
  organizations: OrganizationRepository;
  seasons: SeasonRepository;
  teams: TeamRepository;
  memberships: MembershipRepository;
  games: GameRepository;
  rosters: RosterRepository;
  relationships: RelationshipRepository;
  audit: AuditRepository;
  gameEvents: GameEventStore;
  transactions: TransactionManager;
}

export interface StorageAdapter extends StorageRepositories {
  initialize(): Promise<void>;
  close(): Promise<void>;
}
