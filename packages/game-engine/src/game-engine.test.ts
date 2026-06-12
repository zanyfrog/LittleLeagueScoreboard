import { randomUUID } from "node:crypto";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { LocalIamService } from "@ll-score/iam-local";
import { createJsonlStorage } from "@ll-score/storage-jsonl";
import { createGameEngine } from "./create-game-engine.js";
import { NotAuthorizedError } from "./errors.js";
import type { RequestContext } from "./contracts.js";

const now = "2026-06-11T12:00:00.000Z";

function context(actorId: string): RequestContext {
  return {
    actorId,
    requestId: randomUUID(),
    correlationId: randomUUID(),
    transport: "library"
  };
}

describe("Game Engine with JSONL and local I-AM", () => {
  it("authorizes roster, position, scoring, and replay workflows", async () => {
    const root = await mkdtemp(join(tmpdir(), "ll-score-engine-"));
    const iam = new LocalIamService({
      recordsPath: join(root, "iam", "records.jsonl"),
      auditPath: join(root, "iam", "audit.jsonl"),
      now: () => new Date(now)
    });
    await iam.initialize();
    const adminSession = await iam.bootstrapAdmin({
      username: "admin",
      password: "a-secure-admin-password",
      displayName: "Administrator"
    });
    const storage = createJsonlStorage(join(root, "game-data"));
    await storage.initialize();
    try {
      await storage.organizations.save(
        {
          organizationId: "org-1",
          name: "Little League",
          createdAtUtc: now
        },
        adminSession.actor.actorId
      );
      await storage.seasons.save(
        {
          seasonId: "season-1",
          organizationId: "org-1",
          name: "2026",
          startsOn: "2026-03-01",
          endsOn: "2026-08-31",
          createdAtUtc: now
        },
        adminSession.actor.actorId
      );
      for (const team of [
        { teamId: "home", name: "Falcons" },
        { teamId: "away", name: "Bears" }
      ]) {
        await storage.teams.save(
          {
            ...team,
            organizationId: "org-1",
            createdAtUtc: now
          },
          adminSession.actor.actorId
        );
      }
      for (const player of [
        { playerId: "p1", personId: "person-1", name: "Alex" },
        { playerId: "p2", personId: "person-2", name: "Sam" },
        { playerId: "p3", personId: "person-3", name: "Lee" }
      ]) {
        await storage.people.save(
          {
            personId: player.personId,
            displayName: player.name,
            createdAtUtc: now
          },
          adminSession.actor.actorId
        );
        await storage.players.save(
          {
            playerId: player.playerId,
            personId: player.personId,
            bats: "UNKNOWN",
            throws: "UNKNOWN",
            createdAtUtc: now
          },
          adminSession.actor.actorId
        );
        await storage.memberships.save(
          {
            membershipId: `membership-${player.playerId}`,
            playerId: player.playerId,
            teamId: player.playerId === "p3" ? "away" : "home",
            seasonId: "season-1",
            membershipType: "REGULAR",
            status: "ACTIVE",
            jerseyNumber: player.playerId.slice(1),
            joinedOn: "2026-03-01",
            createdAtUtc: now
          },
          adminSession.actor.actorId
        );
      }
      await storage.games.save(
        {
          gameId: "game-1",
          homeTeamId: "home",
          awayTeamId: "away",
          timezoneName: "America/New_York",
          status: "IN_PROGRESS",
          createdAtUtc: now
        },
        adminSession.actor.actorId
      );

      const engine = createGameEngine({ storage, iam, now: () => new Date(now) });
      const adminContext = context(adminSession.actor.actorId);
      await engine.rosters.setGameRoster(
        {
          gameId: "game-1",
          entries: [
            {
              gameId: "game-1",
              teamId: "home",
              playerId: "p1",
              membershipId: "membership-p1",
              displayNameSnapshot: "Alex",
              jerseyNumberSnapshot: "1",
              teamNameSnapshot: "Falcons",
              battingOrder: 1,
              initialPosition: "BENCH",
              isPresent: true
            },
            {
              gameId: "game-1",
              teamId: "home",
              playerId: "p2",
              membershipId: "membership-p2",
              displayNameSnapshot: "Sam",
              jerseyNumberSnapshot: "2",
              teamNameSnapshot: "Falcons",
              battingOrder: 2,
              initialPosition: "RF",
              isPresent: true
            },
            {
              gameId: "game-1",
              teamId: "away",
              playerId: "p3",
              membershipId: "membership-p3",
              displayNameSnapshot: "Lee",
              jerseyNumberSnapshot: "3",
              teamNameSnapshot: "Bears",
              battingOrder: 1,
              initialPosition: "BULLPEN",
              isPresent: true
            }
          ]
        },
        adminContext
      );

      const teamRoster = await engine.rosters.getTeamRoster(
        { teamId: "home", seasonId: "season-1" },
        adminContext
      );
      expect(teamRoster.players.map((player) => player.displayName)).toEqual([
        "Alex",
        "Sam"
      ]);

      await engine.scoring.changePlayerPositions(
        {
          gameId: "game-1",
          changes: [
            { teamId: "home", playerId: "p1", toPosition: "RF" },
            { teamId: "home", playerId: "p2", toPosition: "BENCH" }
          ]
        },
        adminContext
      );
      await engine.scoring.recordEvent(
        {
          gameId: "game-1",
          eventType: "RunnerMoved",
          runnerMovements: [
            {
              runnerId: "p1",
              from: "BATTER",
              to: "FIRST",
              outcome: "SAFE",
              reason: "single"
            }
          ]
        },
        adminContext
      );

      const lineups = await engine.rosters.getCurrentLineups(
        { gameId: "game-1" },
        adminContext
      );
      expect(
        lineups.home.players.find((player) => player.playerId === "p1")
          ?.position
      ).toBe("RF");
      expect(
        lineups.home.players.find((player) => player.playerId === "p2")
          ?.position
      ).toBe("BENCH");
      expect(lineups.away.players[0]?.position).toBe("BULLPEN");

      const replay = await engine.replay.getReplay("game-1", adminContext);
      expect(replay.eventVersion).toBe(2);
      expect(replay.frames).toHaveLength(2);
      expect(replay.currentBaseState.first?.runnerId).toBe("p1");
      expect((await storage.audit.list("game-1"))).toHaveLength(3);

      await expect(
        engine.replay.getReplay("game-1", context("unknown-actor"))
      ).rejects.toBeInstanceOf(NotAuthorizedError);
    } finally {
      await storage.close();
    }
  });
});
