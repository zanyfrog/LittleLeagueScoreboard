import type { StorageRepositories } from "@ll-score/storage-core";
import { createSampleLeague, type SampleLeague } from "./sample-league.js";

export interface LoadSampleLeagueResult {
  organizationId: string;
  seasonId: string;
  teamCount: number;
  playerCount: number;
  gameCount: number;
  rosterEntryCount: number;
}

export async function loadSampleLeague(
  storage: StorageRepositories,
  actorId = "system:sample-seed",
  sample: SampleLeague = createSampleLeague()
): Promise<LoadSampleLeagueResult> {
  await storage.organizations.save(sample.organization, actorId);
  await storage.seasons.save(sample.season, actorId);
  for (const team of sample.teams) {
    await storage.teams.save(team, actorId);
  }
  for (const person of sample.people) {
    await storage.people.save(person, actorId);
  }
  for (const player of sample.players) {
    await storage.players.save(player, actorId);
  }
  for (const membership of sample.memberships) {
    await storage.memberships.save(membership, actorId);
  }
  for (const game of sample.games) {
    await storage.games.save(game, actorId);
    await storage.rosters.replaceGameRoster(
      game.gameId,
      [...(sample.gameRosters.get(game.gameId) ?? [])],
      actorId
    );
  }

  return {
    organizationId: sample.organization.organizationId,
    seasonId: sample.season.seasonId,
    teamCount: sample.teams.length,
    playerCount: sample.players.length,
    gameCount: sample.games.length,
    rosterEntryCount: [...sample.gameRosters.values()].reduce(
      (count, roster) => count + roster.length,
      0
    )
  };
}
