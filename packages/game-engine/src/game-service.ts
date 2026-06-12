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

  async function summarize(gameId: string): Promise<GameSummary> {
    const game = await storage.games.getById(gameId);
    if (!game) throw new GameNotFoundError(gameId);
    const [home, away] = await Promise.all([
      storage.teams.getById(game.homeTeamId),
      storage.teams.getById(game.awayTeamId)
    ]);
    return {
      ...game,
      homeTeamName: home?.name ?? game.homeTeamId,
      awayTeamName: away?.name ?? game.awayTeamId
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
    }
  };
}
