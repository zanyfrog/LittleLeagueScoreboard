import type {
  DefensiveAlignment,
  GameEvent,
  GameProjections
} from "@ll-score/contracts";
import { rm } from "node:fs/promises";
import { basename, join } from "node:path";
import type {
  StorageAdapter,
  TransactionManager
} from "@ll-score/storage-core";
import { DataDirectoryLock } from "./filesystem/directory-lock.js";
import {
  dataDirectoryPaths,
  type DataDirectoryPaths
} from "./filesystem/data-directory.js";
import { WriteQueue } from "./filesystem/write-queue.js";
import { createJsonlCatalogRepositories } from "./repositories/jsonl-catalog-repositories.js";
import { JsonlRosterRepository } from "./repositories/jsonl-roster-repository.js";
import { JsonlAuditRepository } from "./repositories/jsonl-audit-repository.js";
import { JsonlRelationshipRepository } from "./repositories/jsonl-relationship-repository.js";
import { JsonlGameEventStore } from "./event-store/jsonl-game-event-store.js";
import { migrateDataDirectory } from "./migrations/migration-registry.js";
import { buildGameProjections } from "./projections/replay-projection.js";
import { writeGameSnapshots } from "./projections/snapshot-store.js";

export interface JsonlStorageAdapter extends StorageAdapter {
  readonly paths: DataDirectoryPaths;
  rebuildGameProjections(gameId: string): Promise<GameProjections>;
  deleteGameArtifacts(gameId: string): Promise<boolean>;
}

export function createJsonlStorage(root?: string): JsonlStorageAdapter {
  const paths = dataDirectoryPaths(root);
  const queue = new WriteQueue();
  const lock = new DataDirectoryLock(paths.lock);
  const catalog = createJsonlCatalogRepositories(paths.catalog, queue);
  const gameEvents = new JsonlGameEventStore(paths.games, queue);
  const transactions: TransactionManager = {
    execute: (work) => work()
  };
  let initialized = false;

  const rosters = new JsonlRosterRepository(paths.games, queue);
  const audit = new JsonlAuditRepository(paths.audit, queue);

  return {
    paths,
    ...catalog,
    rosters,
    relationships: new JsonlRelationshipRepository(paths.catalog, queue),
    audit,
    gameEvents,
    transactions,
    async initialize() {
      if (initialized) return;
      await migrateDataDirectory(paths);
      await lock.acquire();
      initialized = true;
    },
    async close() {
      if (!initialized) return;
      await lock.release();
      initialized = false;
    },
    async rebuildGameProjections(gameId: string) {
      const events: GameEvent[] = await gameEvents.read(gameId);
      const roster = await rosters.getGameRoster(gameId);
      const initialByTeam = new Map<string, DefensiveAlignment>();
      for (const entry of roster.filter((item) => item.isPresent)) {
        const alignment = initialByTeam.get(entry.teamId) ?? {
          teamId: entry.teamId,
          assignments: []
        };
        alignment.assignments.push({
          playerId: entry.playerId,
          teamId: entry.teamId,
          displayLabel: entry.jerseyNumberSnapshot
            ? `#${entry.jerseyNumberSnapshot} ${entry.displayNameSnapshot}`
            : entry.displayNameSnapshot,
          position: entry.initialPosition
        });
        initialByTeam.set(entry.teamId, alignment);
      }
      const projections = buildGameProjections(
        gameId,
        events,
        [...initialByTeam.values()]
      );
      await writeGameSnapshots(paths.games, projections);
      return projections;
    },
    async deleteGameArtifacts(gameId: string) {
      if (
        !gameId ||
        basename(gameId) !== gameId ||
        gameId === "." ||
        gameId === ".."
      ) {
        throw new Error("Invalid game ID.");
      }
      const deleted = await catalog.games.delete(gameId);
      await audit.deleteForResource(gameId);
      await rm(join(paths.games, gameId), { recursive: true, force: true });
      return deleted;
    }
  };
}
