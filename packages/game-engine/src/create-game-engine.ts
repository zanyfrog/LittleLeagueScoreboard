import type {
  GameEngine,
  GameEngineDependencies
} from "./contracts.js";
import { createGameService } from "./game-service.js";
import { createReplayService } from "./replay-service.js";
import { createRosterService } from "./roster-service.js";
import { createScoringService } from "./scoring-service.js";

export function createGameEngine(
  dependencies: GameEngineDependencies
): GameEngine {
  return {
    games: createGameService(dependencies),
    rosters: createRosterService(dependencies),
    scoring: createScoringService(dependencies),
    replay: createReplayService(dependencies)
  };
}
