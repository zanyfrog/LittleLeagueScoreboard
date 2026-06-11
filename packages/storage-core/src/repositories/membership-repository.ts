import type { Membership } from "@ll-score/contracts";
import type { Repository } from "./repository.js";

export interface MembershipRepository extends Repository<Membership> {
  listForPlayer(playerId: string): Promise<Membership[]>;
  listForTeam(teamId: string, seasonId?: string): Promise<Membership[]>;
}
