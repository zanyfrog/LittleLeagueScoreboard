import type { Game } from "@ll-score/contracts";
import type { Repository } from "./repository.js";

export interface GameRepository extends Repository<Game> {}
