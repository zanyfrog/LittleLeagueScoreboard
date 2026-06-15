import type {
  BaseState,
  DefensiveAlignment,
  GameEvent,
  GameEventType,
  Game,
  GameRosterEntry,
  IamService,
  Membership,
  PlayerPosition,
  ReplayFrame,
  ReplayMediaAttachment,
  RunnerMovement
} from "@ll-score/contracts";
import type { StorageRepositories } from "@ll-score/storage-core";

export interface RequestContext {
  actorId: string;
  organizationId?: string;
  teamId?: string;
  gameId?: string;
  requestId: string;
  correlationId: string;
  transport: "library" | "http";
}

export interface TeamRosterPlayer {
  membership: Membership;
  playerId: string;
  personId: string;
  displayName: string;
  jerseyNumber?: string;
  primaryPosition: PlayerPosition;
  bats: "LEFT" | "RIGHT" | "SWITCH" | "UNKNOWN";
  throws: "LEFT" | "RIGHT" | "UNKNOWN";
}

export interface TeamRoster {
  teamId: string;
  seasonId?: string;
  teamName: string;
  players: TeamRosterPlayer[];
}

export interface LineupPlayer {
  playerId: string;
  teamId: string;
  displayLabel: string;
  battingOrder?: number;
  isPresent: boolean;
  position: PlayerPosition;
  isBench: boolean;
  isBullpen: boolean;
  isCurrentPitcher: boolean;
  isCurrentCatcher: boolean;
  bats: "LEFT" | "RIGHT" | "SWITCH" | "UNKNOWN";
  throws: "LEFT" | "RIGHT" | "UNKNOWN";
}

export interface GameLineup {
  gameId: string;
  teamId: string;
  teamName: string;
  players: LineupPlayer[];
}

export interface CurrentGameLineups {
  gameId: string;
  eventVersion: number;
  home: GameLineup;
  away: GameLineup;
}

export interface GetTeamRosterInput {
  teamId: string;
  seasonId?: string;
}

export interface GetGameLineupInput {
  gameId: string;
  teamId: string;
}

export interface GetCurrentLineupsInput {
  gameId: string;
}

export interface SetGameRosterInput {
  gameId: string;
  entries: GameRosterEntry[];
}

export interface ChangePlayerPositionsInput {
  gameId: string;
  changes: Array<{
    teamId: string;
    playerId: string;
    toPosition: PlayerPosition;
    reason?: string;
  }>;
  expectedVersion?: number;
  occurredAtUtc?: string;
}

export interface RecordScoringEventInput {
  gameId: string;
  eventType: Extract<
    GameEventType,
    | "GameStarted"
    | "HalfInningStarted"
    | "PlateAppearanceStarted"
    | "PitchRecorded"
    | "ScorekeeperCommentRecorded"
    | "BallPutInPlay"
    | "FieldingActionRecorded"
    | "RunnerMoved"
    | "RunnerOut"
    | "OutCountAdjusted"
    | "RunScored"
    | "PitcherChanged"
    | "EventReversed"
    | "GameFinalized"
  >;
  payload?: Record<string, unknown>;
  runnerMovements?: RunnerMovement[];
  mediaAttachments?: ReplayMediaAttachment[];
  expectedVersion?: number;
  occurredAtUtc?: string;
  reversesEventId?: string;
  correctsEventId?: string;
  correctionNote?: string;
  allowFinalizedGameEdit?: boolean;
}

export interface ScoringResult {
  event: GameEvent;
  eventVersion: number;
  baseState: BaseState;
  alignments: DefensiveAlignment[];
}

export interface GameReplay {
  gameId: string;
  eventVersion: number;
  events: GameEvent[];
  frames: ReplayFrame[];
  currentBaseState: BaseState;
  currentAlignments: DefensiveAlignment[];
}

export interface GameSummary extends Game {
  homeTeamName: string;
  awayTeamName: string;
}

export interface GameService {
  listGames(context: RequestContext): Promise<GameSummary[]>;
  getGame(gameId: string, context: RequestContext): Promise<GameSummary>;
  updateGameDetails(
    gameId: string,
    details: {
      scheduledStartUtc?: string;
      locationName?: string;
    },
    context: RequestContext
  ): Promise<GameSummary>;
  deleteGame(gameId: string, context: RequestContext): Promise<boolean>;
}

export interface RosterService {
  getTeamRoster(
    input: GetTeamRosterInput,
    context: RequestContext
  ): Promise<TeamRoster>;
  getGameLineup(
    input: GetGameLineupInput,
    context: RequestContext
  ): Promise<GameLineup>;
  getCurrentLineups(
    input: GetCurrentLineupsInput,
    context: RequestContext
  ): Promise<CurrentGameLineups>;
  setGameRoster(
    input: SetGameRosterInput,
    context: RequestContext
  ): Promise<void>;
}

export interface ScoringService {
  changePlayerPositions(
    input: ChangePlayerPositionsInput,
    context: RequestContext
  ): Promise<ScoringResult>;
  recordEvent(
    input: RecordScoringEventInput,
    context: RequestContext
  ): Promise<ScoringResult>;
}

export interface ReplayService {
  getReplay(gameId: string, context: RequestContext): Promise<GameReplay>;
}

export interface GameEngine {
  games: GameService;
  rosters: RosterService;
  scoring: ScoringService;
  replay: ReplayService;
}

export interface GameEngineDependencies {
  storage: StorageRepositories;
  iam: Pick<IamService, "authorize">;
  now?: () => Date;
}
