import { requireAuthorization } from "./authorization.js";
import type {
  GameEngineDependencies,
  GameReplay,
  ReplayService,
  RequestContext
} from "./contracts.js";
import { GameNotFoundError } from "./errors.js";
import { projectGame } from "./projection.js";

export function createReplayService(
  dependencies: GameEngineDependencies
): ReplayService {
  const { storage, iam } = dependencies;
  return {
    async getReplay(
      gameId: string,
      context: RequestContext
    ): Promise<GameReplay> {
      await requireAuthorization(iam, context, "read", "game-scoring", {
        type: "game",
        id: gameId
      });
      if (!(await storage.games.getById(gameId))) {
        throw new GameNotFoundError(gameId);
      }
      const [roster, events] = await Promise.all([
        storage.rosters.getGameRoster(gameId),
        storage.gameEvents.read(gameId)
      ]);
      const projected = projectGame(roster, events);
      return {
        gameId,
        eventVersion: projected.eventVersion,
        events,
        frames: projected.frames,
        currentBaseState: projected.baseState,
        currentAlignments: projected.alignments
      };
    }
  };
}
