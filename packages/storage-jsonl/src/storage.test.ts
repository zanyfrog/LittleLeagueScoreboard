import { randomUUID } from "node:crypto";
import { appendFile, mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type { GameEvent } from "@ll-score/contracts";
import {
  DataDirectoryLockedError,
  StreamVersionConflictError
} from "@ll-score/storage-core";
import { createBackup } from "./backup/create-backup.js";
import { restoreBackup } from "./backup/restore-backup.js";
import { createJsonlStorage } from "./create-jsonl-storage.js";
import { recoverIncompleteFinalLine } from "./recovery/recover-interrupted-write.js";
import { validateDataDirectory } from "./recovery/validate-data-directory.js";

const utc = "2026-06-11T12:00:00.000Z";

function positionEvent(
  gameId: string,
  eventOrder: number,
  changes: GameEvent["positionChanges"]
): GameEvent {
  return {
    eventId: randomUUID(),
    gameId,
    eventOrder,
    eventTimeUtc: utc,
    loggedAtUtc: utc,
    eventType: "DefensivePositionChanged",
    actorId: "scorer-1",
    payload: {},
    positionChanges: changes,
    runnerMovements: []
  };
}

describe("JSONL storage", () => {
  it("stores events and rebuilds bench, bullpen, and field replay state", async () => {
    const root = await mkdtemp(join(tmpdir(), "ll-score-storage-"));
    const storage = createJsonlStorage(root);
    await storage.initialize();
    try {
      const gameId = randomUUID();
      await storage.rosters.replaceGameRoster(
        gameId,
        [
          {
            gameId,
            teamId: "team-a",
            playerId: "player-4",
            displayNameSnapshot: "Drew",
            jerseyNumberSnapshot: "4",
            teamNameSnapshot: "Falcons",
            initialPosition: "C",
            isPresent: true
          }
        ],
        "scorer-1"
      );
      const events = [
        positionEvent(gameId, 1, [
          {
            teamId: "team-a",
            playerId: "player-1",
            displayLabel: "#1 Alex",
            fromPosition: "UNKNOWN",
            toPosition: "BENCH"
          },
          {
            teamId: "team-a",
            playerId: "player-2",
            displayLabel: "#2 Sam",
            fromPosition: "UNKNOWN",
            toPosition: "RF"
          },
          {
            teamId: "team-a",
            playerId: "player-3",
            displayLabel: "#3 Lee",
            fromPosition: "UNKNOWN",
            toPosition: "BULLPEN"
          }
        ]),
        positionEvent(gameId, 2, [
          {
            teamId: "team-a",
            playerId: "player-1",
            displayLabel: "#1 Alex",
            fromPosition: "BENCH",
            toPosition: "RF"
          },
          {
            teamId: "team-a",
            playerId: "player-2",
            displayLabel: "#2 Sam",
            fromPosition: "RF",
            toPosition: "BENCH"
          }
        ])
      ];
      await storage.gameEvents.append({
        gameId,
        expectedVersion: 0,
        actorId: "scorer-1",
        events
      });

      const projections = await storage.rebuildGameProjections(gameId);
      const assignments = projections.alignments[0]?.assignments ?? [];
      expect(assignments).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ playerId: "player-1", position: "RF" }),
          expect.objectContaining({ playerId: "player-2", position: "BENCH" }),
          expect.objectContaining({
            playerId: "player-3",
            position: "BULLPEN"
          }),
          expect.objectContaining({ playerId: "player-4", position: "C" })
        ])
      );
      expect(projections.replayFrames[1]?.alignmentsBefore[0]?.assignments).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ playerId: "player-1", position: "BENCH" }),
          expect.objectContaining({ playerId: "player-2", position: "RF" })
        ])
      );
    } finally {
      await storage.close();
    }
  });

  it("rejects stale stream versions", async () => {
    const root = await mkdtemp(join(tmpdir(), "ll-score-storage-"));
    const storage = createJsonlStorage(root);
    await storage.initialize();
    try {
      const gameId = randomUUID();
      await storage.gameEvents.append({
        gameId,
        expectedVersion: 0,
        actorId: "scorer-1",
        events: [positionEvent(gameId, 1, [])]
      });
      await expect(
        storage.gameEvents.append({
          gameId,
          expectedVersion: 0,
          actorId: "scorer-1",
          events: [positionEvent(gameId, 1, [])]
        })
      ).rejects.toBeInstanceOf(StreamVersionConflictError);
    } finally {
      await storage.close();
    }
  });

  it("prevents a second writer from owning the data directory", async () => {
    const root = await mkdtemp(join(tmpdir(), "ll-score-storage-"));
    const first = createJsonlStorage(root);
    const second = createJsonlStorage(root);
    await first.initialize();
    try {
      await expect(second.initialize()).rejects.toBeInstanceOf(
        DataDirectoryLockedError
      );
    } finally {
      await first.close();
    }
  });

  it("detects checksum corruption", async () => {
    const root = await mkdtemp(join(tmpdir(), "ll-score-storage-"));
    const storage = createJsonlStorage(root);
    await storage.initialize();
    const gameId = randomUUID();
    try {
      await storage.gameEvents.append({
        gameId,
        expectedVersion: 0,
        actorId: "scorer-1",
        events: [positionEvent(gameId, 1, [])]
      });
    } finally {
      await storage.close();
    }
    const eventsPath = join(root, "games", gameId, "events.jsonl");
    const contents = await readFile(eventsPath, "utf8");
    await appendFile(eventsPath, contents.replace("scorer-1", "scorer-2"));
    const validation = await validateDataDirectory(root);
    expect(validation.valid).toBe(false);
  });

  it("quarantines an incomplete final line", async () => {
    const root = await mkdtemp(join(tmpdir(), "ll-score-storage-"));
    const storage = createJsonlStorage(root);
    await storage.initialize();
    const gameId = randomUUID();
    try {
      await storage.gameEvents.append({
        gameId,
        expectedVersion: 0,
        actorId: "scorer-1",
        events: [positionEvent(gameId, 1, [])]
      });
    } finally {
      await storage.close();
    }
    const eventsPath = join(root, "games", gameId, "events.jsonl");
    await appendFile(eventsPath, "{\"partial\":");
    const result = await recoverIncompleteFinalLine(
      eventsPath,
      join(root, "recovery")
    );
    expect(result.recovered).toBe(true);
    expect((await validateDataDirectory(root)).valid).toBe(true);
  });

  it("backs up and restores authoritative data", async () => {
    const root = await mkdtemp(join(tmpdir(), "ll-score-storage-"));
    const storage = createJsonlStorage(root);
    await storage.initialize();
    await storage.teams.save(
      {
        teamId: "team-a",
        organizationId: "organization-a",
        name: "Falcons",
        createdAtUtc: utc
      },
      "admin-1"
    );
    await storage.close();

    const backupPath = await createBackup(
      root,
      join(root, "backups"),
      "before-change"
    );
    const changed = createJsonlStorage(root);
    await changed.initialize();
    await changed.teams.save(
      {
        teamId: "team-a",
        organizationId: "organization-a",
        name: "Changed Name",
        createdAtUtc: utc
      },
      "admin-1"
    );
    await changed.close();

    await restoreBackup(backupPath, root);
    const restored = createJsonlStorage(root);
    await restored.initialize();
    try {
      expect((await restored.teams.getById("team-a"))?.name).toBe("Falcons");
    } finally {
      await restored.close();
    }
  });

  it("persists a game-specific batting order across restart", async () => {
    const root = await mkdtemp(join(tmpdir(), "ll-score-storage-"));
    const first = createJsonlStorage(root);
    await first.initialize();
    await first.rosters.replaceGameRoster(
      "game-lineup",
      [
        {
          gameId: "game-lineup",
          teamId: "team-a",
          playerId: "player-2",
          displayNameSnapshot: "Second Player",
          teamNameSnapshot: "Falcons",
          battingOrder: 1,
          initialPosition: "C",
          isPresent: true
        },
        {
          gameId: "game-lineup",
          teamId: "team-a",
          playerId: "player-1",
          displayNameSnapshot: "First Player",
          teamNameSnapshot: "Falcons",
          battingOrder: 2,
          initialPosition: "P",
          isPresent: true
        }
      ],
      "scorer-1"
    );
    await first.close();

    const reopened = createJsonlStorage(root);
    await reopened.initialize();
    try {
      const saved = await reopened.rosters.getGameRoster("game-lineup");
      expect(
        [...saved]
          .sort((left, right) =>
            (left.battingOrder ?? 0) - (right.battingOrder ?? 0)
          )
          .map((entry) => entry.playerId)
      ).toEqual(["player-2", "player-1"]);
    } finally {
      await reopened.close();
    }
  });
});
