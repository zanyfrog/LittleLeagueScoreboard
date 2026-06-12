import { randomUUID } from "node:crypto";
import type {
  Game,
  GameRosterEntry,
  PlayerPosition
} from "@ll-score/contracts";
import type { StorageRepositories } from "@ll-score/storage-core";
import { requireAuthorization } from "./authorization.js";
import type {
  CurrentGameLineups,
  GameEngineDependencies,
  GameLineup,
  GetCurrentLineupsInput,
  GetGameLineupInput,
  GetTeamRosterInput,
  LineupPlayer,
  RequestContext,
  RosterService,
  SetGameRosterInput,
  TeamRoster
} from "./contracts.js";
import { GameNotFoundError, TeamNotFoundError } from "./errors.js";
import { projectGame } from "./projection.js";

function displayLabel(entry: GameRosterEntry): string {
  return entry.jerseyNumberSnapshot
    ? `#${entry.jerseyNumberSnapshot} ${entry.displayNameSnapshot}`
    : entry.displayNameSnapshot;
}

function lineupPlayer(
  entry: GameRosterEntry,
  position: PlayerPosition
): LineupPlayer {
  return {
    playerId: entry.playerId,
    teamId: entry.teamId,
    displayLabel: displayLabel(entry),
    battingOrder: entry.battingOrder,
    isPresent: entry.isPresent,
    position,
    isBench: position === "BENCH",
    isBullpen: position === "BULLPEN",
    isCurrentPitcher: position === "P",
    isCurrentCatcher: position === "C"
  };
}

async function requireGame(
  storage: StorageRepositories,
  gameId: string
): Promise<Game> {
  const game = await storage.games.getById(gameId);
  if (!game) throw new GameNotFoundError(gameId);
  return game;
}

async function buildLineup(
  storage: StorageRepositories,
  gameId: string,
  teamId: string,
  current: boolean
): Promise<GameLineup> {
  const [team, roster, events] = await Promise.all([
    storage.teams.getById(teamId),
    storage.rosters.getGameRoster(gameId),
    current ? storage.gameEvents.read(gameId) : Promise.resolve([])
  ]);
  if (!team) throw new TeamNotFoundError(teamId);
  const entries = roster.filter((entry) => entry.teamId === teamId);
  const alignment = current
    ? projectGame(roster, events).alignments.find(
        (item) => item.teamId === teamId
      )
    : undefined;
  const positions = new Map(
    alignment?.assignments.map((assignment) => [
      assignment.playerId,
      assignment.position
    ]) ?? []
  );
  return {
    gameId,
    teamId,
    teamName: team.name,
    players: entries
      .map((entry) =>
        lineupPlayer(
          entry,
          positions.get(entry.playerId) ?? entry.initialPosition
        )
      )
      .sort(
        (left, right) =>
          (left.battingOrder ?? Number.MAX_SAFE_INTEGER) -
          (right.battingOrder ?? Number.MAX_SAFE_INTEGER)
      )
  };
}

export function createRosterService(
  dependencies: GameEngineDependencies
): RosterService {
  const { storage, iam } = dependencies;

  return {
    async getTeamRoster(
      input: GetTeamRosterInput,
      context: RequestContext
    ): Promise<TeamRoster> {
      await requireAuthorization(iam, context, "read", "team-data", {
        type: "team",
        id: input.teamId
      });
      const team = await storage.teams.getById(input.teamId);
      if (!team) throw new TeamNotFoundError(input.teamId);
      const memberships = await storage.memberships.listForTeam(
        input.teamId,
        input.seasonId
      );
      const players = await Promise.all(
        memberships
          .filter((membership) => membership.status === "ACTIVE")
          .map(async (membership) => {
            const player = await storage.players.getById(membership.playerId);
            const person = player
              ? await storage.people.getById(player.personId)
              : null;
            return {
              membership,
              playerId: membership.playerId,
              personId: player?.personId ?? "",
              displayName: person?.displayName ?? membership.playerId,
              jerseyNumber: membership.jerseyNumber,
              primaryPosition:
                membership.primaryPosition ??
                player?.primaryPosition ??
                ("UNKNOWN" as const)
            };
          })
      );
      return {
        teamId: team.teamId,
        seasonId: input.seasonId,
        teamName: team.name,
        players
      };
    },

    async getGameLineup(
      input: GetGameLineupInput,
      context: RequestContext
    ): Promise<GameLineup> {
      await requireAuthorization(iam, context, "read", "game-scoring", {
        type: "game",
        id: input.gameId
      });
      const game = await requireGame(storage, input.gameId);
      if (
        input.teamId !== game.homeTeamId &&
        input.teamId !== game.awayTeamId
      ) {
        throw new TeamNotFoundError(input.teamId);
      }
      return buildLineup(storage, input.gameId, input.teamId, false);
    },

    async getCurrentLineups(
      input: GetCurrentLineupsInput,
      context: RequestContext
    ): Promise<CurrentGameLineups> {
      await requireAuthorization(iam, context, "read", "game-scoring", {
        type: "game",
        id: input.gameId
      });
      const game = await requireGame(storage, input.gameId);
      const [home, away, eventVersion] = await Promise.all([
        buildLineup(storage, input.gameId, game.homeTeamId, true),
        buildLineup(storage, input.gameId, game.awayTeamId, true),
        storage.gameEvents.getVersion(input.gameId)
      ]);
      return { gameId: input.gameId, eventVersion, home, away };
    },

    async setGameRoster(
      input: SetGameRosterInput,
      context: RequestContext
    ): Promise<void> {
      await requireAuthorization(iam, context, "write", "game-scoring", {
        type: "game",
        id: input.gameId
      });
      const game = await requireGame(storage, input.gameId);
      const validTeams = new Set([game.homeTeamId, game.awayTeamId]);
      if (
        input.entries.some(
          (entry) =>
            entry.gameId !== input.gameId || !validTeams.has(entry.teamId)
        )
      ) {
        throw new Error("INVALID_GAME_ROSTER");
      }
      if (
        new Set(input.entries.map((entry) => entry.playerId)).size !==
        input.entries.length
      ) {
        throw new Error("DUPLICATE_GAME_ROSTER_PLAYER");
      }
      projectGame(input.entries, []);
      await storage.rosters.replaceGameRoster(
        input.gameId,
        input.entries,
        context.actorId
      );
      await storage.audit.append({
        auditEventId: randomUUID(),
        occurredAtUtc: new Date().toISOString(),
        actorId: context.actorId,
        action: "game.roster.replace",
        resourceType: "game",
        resourceId: input.gameId,
        outcome: "ALLOWED",
        metadata: {
          playerCount: input.entries.length,
          requestId: context.requestId,
          correlationId: context.correlationId
        }
      });
    }
  };
}
