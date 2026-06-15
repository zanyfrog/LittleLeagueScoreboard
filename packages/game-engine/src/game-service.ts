import { requireAuthorization } from "./authorization.js";
import type {
  GameEngineDependencies,
  GameService,
  GameSummary,
  RequestContext
} from "./contracts.js";
import { GameNotFoundError } from "./errors.js";

export function createGameService(
  dependencies: GameEngineDependencies
): GameService {
  const { storage, iam } = dependencies;
  const now = dependencies.now ?? (() => new Date());

  async function summarize(gameId: string): Promise<GameSummary> {
    const game = await storage.games.getById(gameId);
    if (!game) throw new GameNotFoundError(gameId);
    const [home, away, roster] = await Promise.all([
      storage.teams.getById(game.homeTeamId),
      storage.teams.getById(game.awayTeamId),
      storage.rosters.getGameRoster(gameId)
    ]);
    const rosterTeamName = (teamId: string) =>
      roster.find((entry) => entry.teamId === teamId)?.teamNameSnapshot;
    return {
      ...game,
      homeTeamName:
        game.status === "SCHEDULED"
          ? home?.name ?? game.homeTeamId
          : rosterTeamName(game.homeTeamId) ?? home?.name ?? game.homeTeamId,
      awayTeamName:
        game.status === "SCHEDULED"
          ? away?.name ?? game.awayTeamId
          : rosterTeamName(game.awayTeamId) ?? away?.name ?? game.awayTeamId
    };
  }

  return {
    async listGames(context: RequestContext): Promise<GameSummary[]> {
      await requireAuthorization(iam, context, "read", "game-scoring", {
        type: "application",
        id: "little-league-scoreboard"
      });
      return Promise.all(
        (await storage.games.list()).map((game) => summarize(game.gameId))
      );
    },
    async getGame(
      gameId: string,
      context: RequestContext
    ): Promise<GameSummary> {
      await requireAuthorization(iam, context, "read", "game-scoring", {
        type: "game",
        id: gameId
      });
      return summarize(gameId);
    },
    async updateGameDetails(
      gameId,
      details,
      context
    ): Promise<GameSummary> {
      await requireAuthorization(iam, context, "update", "game-scoring", {
        type: "game",
        id: gameId
      });
      const game = await storage.games.getById(gameId);
      if (!game) throw new GameNotFoundError(gameId);
      await storage.games.save(
        {
          ...game,
          scheduledStartUtc: details.scheduledStartUtc,
          locationName: details.locationName,
          updatedAtUtc: now().toISOString()
        },
        context.actorId
      );
      return summarize(gameId);
    },
    async deleteGame(
      gameId: string,
      context: RequestContext
    ): Promise<boolean> {
      await requireAuthorization(iam, context, "delete", "game-scoring", {
        type: "game",
        id: gameId
      });
      if (!(await storage.games.getById(gameId))) {
        throw new GameNotFoundError(gameId);
      }
      return storage.deleteGameArtifacts(gameId);
    }
  };
}
