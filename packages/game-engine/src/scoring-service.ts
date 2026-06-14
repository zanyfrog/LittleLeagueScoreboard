import { randomUUID } from "node:crypto";
import type {
  DefensivePositionChange,
  Game,
  GameEvent,
  GameRosterEntry
} from "@ll-score/contracts";
import type { StorageRepositories } from "@ll-score/storage-core";
import { requireAuthorization } from "./authorization.js";
import type {
  ChangePlayerPositionsInput,
  GameEngineDependencies,
  RecordScoringEventInput,
  RequestContext,
  ScoringResult,
  ScoringService
} from "./contracts.js";
import {
  GameNotFoundError,
  PlayerNotOnGameRosterError
} from "./errors.js";
import { projectGame } from "./projection.js";

async function requireGame(
  storage: StorageRepositories,
  gameId: string
): Promise<Game> {
  const game = await storage.games.getById(gameId);
  if (!game) throw new GameNotFoundError(gameId);
  return game;
}

function rosterLabel(entry: GameRosterEntry): string {
  return entry.jerseyNumberSnapshot
    ? `#${entry.jerseyNumberSnapshot} ${entry.displayNameSnapshot}`
    : entry.displayNameSnapshot;
}

async function appendEvent(
  dependencies: GameEngineDependencies,
  gameId: string,
  event: GameEvent,
  expectedVersion: number,
  context: RequestContext
): Promise<ScoringResult> {
  const { storage } = dependencies;
  const eventVersion = await storage.gameEvents.append({
    gameId,
    expectedVersion,
    actorId: context.actorId,
    events: [event]
  });
  await storage.audit.append({
    auditEventId: randomUUID(),
    occurredAtUtc: event.loggedAtUtc,
    actorId: context.actorId,
    action: `game.${event.eventType}`,
    resourceType: "game",
    resourceId: gameId,
    outcome: "ALLOWED",
    metadata: {
      eventId: event.eventId,
      eventOrder: event.eventOrder,
      requestId: context.requestId,
      correlationId: context.correlationId
    }
  });
  const [roster, events] = await Promise.all([
    storage.rosters.getGameRoster(gameId),
    storage.gameEvents.read(gameId)
  ]);
  const projected = projectGame(roster, events);
  return {
    event,
    eventVersion,
    baseState: projected.baseState,
    alignments: projected.alignments
  };
}

export function createScoringService(
  dependencies: GameEngineDependencies
): ScoringService {
  const { storage, iam } = dependencies;
  const now = dependencies.now ?? (() => new Date());

  return {
    async changePlayerPositions(
      input: ChangePlayerPositionsInput,
      context: RequestContext
    ): Promise<ScoringResult> {
      await requireAuthorization(iam, context, "write", "game-scoring", {
        type: "game",
        id: input.gameId
      });
      const game = await requireGame(storage, input.gameId);
      if (game.status === "FINAL") throw new Error("GAME_ALREADY_FINAL");
      if (input.changes.length === 0) throw new Error("POSITION_CHANGES_REQUIRED");
      const uniquePlayers = new Set(
        input.changes.map((change) => change.playerId)
      );
      if (uniquePlayers.size !== input.changes.length) {
        throw new Error("DUPLICATE_PLAYER_POSITION_CHANGE");
      }

      const [roster, events, actualVersion] = await Promise.all([
        storage.rosters.getGameRoster(input.gameId),
        storage.gameEvents.read(input.gameId),
        storage.gameEvents.getVersion(input.gameId)
      ]);
      const expectedVersion = input.expectedVersion ?? actualVersion;
      const current = projectGame(roster, events);
      const positionByPlayer = new Map(
        current.alignments.flatMap((alignment) =>
          alignment.assignments.map((assignment) => [
            assignment.playerId,
            assignment.position
          ] as const)
        )
      );
      const rosterByPlayer = new Map(
        roster.map((entry) => [entry.playerId, entry])
      );
      const validTeams = new Set([game.homeTeamId, game.awayTeamId]);
      const positionChanges: DefensivePositionChange[] = input.changes.map(
        (change) => {
          const entry = rosterByPlayer.get(change.playerId);
          if (!entry || entry.teamId !== change.teamId) {
            throw new PlayerNotOnGameRosterError(
              change.playerId,
              input.gameId
            );
          }
          if (!validTeams.has(change.teamId)) {
            throw new Error("TEAM_NOT_IN_GAME");
          }
          return {
            teamId: change.teamId,
            playerId: change.playerId,
            displayLabel: rosterLabel(entry),
            fromPosition:
              positionByPlayer.get(change.playerId) ?? entry.initialPosition,
            toPosition: change.toPosition,
            reason: change.reason
          };
        }
      );
      const occurredAtUtc = input.occurredAtUtc ?? now().toISOString();
      const event: GameEvent = {
        eventId: randomUUID(),
        gameId: input.gameId,
        eventOrder: expectedVersion + 1,
        eventTimeUtc: occurredAtUtc,
        loggedAtUtc: now().toISOString(),
        eventType: "DefensivePositionChanged",
        actorId: context.actorId,
        payload: {},
        positionChanges,
        runnerMovements: []
      };

      projectGame(roster, [...events, event]);
      return appendEvent(
        dependencies,
        input.gameId,
        event,
        expectedVersion,
        context
      );
    },

    async recordEvent(
      input: RecordScoringEventInput,
      context: RequestContext
    ): Promise<ScoringResult> {
      await requireAuthorization(iam, context, "write", "game-scoring", {
        type: "game",
        id: input.gameId
      });
      const game = await requireGame(storage, input.gameId);
      if (game.status === "FINAL" && !input.allowFinalizedGameEdit) {
        throw new Error("GAME_ALREADY_FINAL");
      }
      const actualVersion = await storage.gameEvents.getVersion(input.gameId);
      const expectedVersion = input.expectedVersion ?? actualVersion;
      const occurredAtUtc = input.occurredAtUtc ?? now().toISOString();
      const event: GameEvent = {
        eventId: randomUUID(),
        gameId: input.gameId,
        eventOrder: expectedVersion + 1,
        eventTimeUtc: occurredAtUtc,
        loggedAtUtc: now().toISOString(),
        eventType: input.eventType,
        actorId: context.actorId,
        payload: input.payload ?? {},
        positionChanges: [],
        runnerMovements: input.runnerMovements ?? [],
        mediaAttachments: input.mediaAttachments,
        reversesEventId: input.reversesEventId,
        correctsEventId: input.correctsEventId,
        correctionNote: input.correctionNote
      };
      return appendEvent(
        dependencies,
        input.gameId,
        event,
        expectedVersion,
        context
      );
    }
  };
}
