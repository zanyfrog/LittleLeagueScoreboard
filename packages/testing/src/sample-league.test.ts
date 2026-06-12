import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { createJsonlStorage } from "@ll-score/storage-jsonl";
import { loadSampleLeague } from "./load-sample-league.js";
import { createSampleLeague } from "./sample-league.js";

describe("sample league", () => {
  it("contains six teams with eleven unique players each", () => {
    const sample = createSampleLeague();
    expect(sample.teams).toHaveLength(6);
    expect(sample.players).toHaveLength(66);
    expect(sample.people).toHaveLength(66);
    expect(sample.memberships).toHaveLength(66);
    expect(new Set(sample.players.map((player) => player.playerId)).size).toBe(
      66
    );

    for (const team of sample.teams) {
      expect(
        sample.memberships.filter(
          (membership) => membership.teamId === team.teamId
        )
      ).toHaveLength(11);
    }
  });

  it("creates three games with complete 22-player roster snapshots", () => {
    const sample = createSampleLeague();
    expect(sample.games).toHaveLength(3);
    expect(
      new Set(
        sample.games.flatMap((game) => [game.homeTeamId, game.awayTeamId])
      ).size
    ).toBe(6);
    for (const game of sample.games) {
      const roster = sample.gameRosters.get(game.gameId) ?? [];
      expect(roster).toHaveLength(22);
      expect(
        roster.filter((entry) => entry.teamId === game.homeTeamId)
      ).toHaveLength(11);
      expect(
        roster.filter((entry) => entry.teamId === game.awayTeamId)
      ).toHaveLength(11);
    }
  });

  it("loads the complete dataset into JSONL storage", async () => {
    const root = await mkdtemp(join(tmpdir(), "ll-score-sample-"));
    const storage = createJsonlStorage(root);
    await storage.initialize();
    try {
      const result = await loadSampleLeague(storage);
      expect(result).toMatchObject({
        teamCount: 6,
        playerCount: 66,
        gameCount: 3,
        rosterEntryCount: 66
      });
      expect(await storage.teams.list()).toHaveLength(6);
      expect(await storage.players.list()).toHaveLength(66);
      expect(await storage.memberships.list()).toHaveLength(66);
      expect(await storage.games.list()).toHaveLength(3);
      for (const game of await storage.games.list()) {
        expect(await storage.rosters.getGameRoster(game.gameId)).toHaveLength(
          22
        );
      }
    } finally {
      await storage.close();
    }
  });
});
