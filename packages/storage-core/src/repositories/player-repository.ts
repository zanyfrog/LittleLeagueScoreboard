import type { PlayerProfile } from "@ll-score/contracts";
import type { Repository } from "./repository.js";

export interface PlayerRepository extends Repository<PlayerProfile> {}
