import { resolve } from "node:path";
import type { PlayerPosition } from "@ll-score/contracts";
import { createJsonlStorage } from "@ll-score/storage-jsonl";

const dataDirectory = process.env.LL_SCORE_DATA_DIR
  ? resolve(process.env.LL_SCORE_DATA_DIR)
  : undefined;
const storage = createJsonlStorage(dataDirectory);
const actorId = "system:all-star-seed";
const createdAtUtc = new Date().toISOString();
const organizationId = "all-star-organization";
const seasonId = "all-star-season-2026";
const positions: PlayerPosition[] = [
  "P", "C", "1B", "2B", "3B", "SS", "LF", "CF", "RF", "BENCH"
];
const teams = [
  { teamId: "all-star-team-one", name: "All Star Team One", prefix: "One" },
  { teamId: "all-star-team-two", name: "All Star Team Two", prefix: "Two" }
];

await storage.initialize();
try {
  await storage.organizations.save(
    {
      organizationId,
      name: "2026 All-Star Game",
      createdAtUtc
    },
    actorId
  );
  await storage.seasons.save(
    {
      seasonId,
      organizationId,
      name: "2026 All-Star Game",
      startsOn: "2026-06-13",
      endsOn: "2026-06-13",
      createdAtUtc
    },
    actorId
  );

  for (const team of teams) {
    await storage.teams.save(
      {
        teamId: team.teamId,
        organizationId,
        name: team.name,
        createdAtUtc
      },
      actorId
    );
    for (let index = 0; index < 10; index += 1) {
      const number = index + 1;
      const personId = `${team.teamId}-person-${number}`;
      const playerId = `${team.teamId}-player-${number}`;
      await storage.people.save(
        {
          personId,
          displayName: `${team.prefix}${number} Placeholder`,
          createdAtUtc
        },
        actorId
      );
      await storage.players.save(
        {
          playerId,
          personId,
          bats: "RIGHT",
          throws: "RIGHT",
          primaryPosition: positions[index],
          createdAtUtc
        },
        actorId
      );
      await storage.memberships.save(
        {
          membershipId: `${team.teamId}-membership-${number}`,
          playerId,
          teamId: team.teamId,
          seasonId,
          membershipType: "TOURNAMENT",
          status: "ACTIVE",
          jerseyNumber: String(number),
          primaryPosition: positions[index],
          joinedOn: "2026-06-13",
          createdAtUtc
        },
        actorId
      );
    }
  }

  process.stdout.write(
    [
      `All-Star data directory: ${storage.paths.root}`,
      "Teams: 2",
      "Players: 20",
      "Games: 0",
      "Game events: 0"
    ].join("\n") + "\n"
  );
} finally {
  await storage.close();
}
