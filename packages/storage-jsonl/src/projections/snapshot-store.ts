import { join } from "node:path";
import type { GameProjections } from "@ll-score/contracts";
import { writeJsonAtomically } from "../filesystem/atomic-file.js";

export async function writeGameSnapshots(
  gamesPath: string,
  projections: GameProjections
): Promise<void> {
  const snapshotPath = join(gamesPath, projections.gameId, "snapshots");
  await Promise.all([
    writeJsonAtomically(
      join(snapshotPath, "current-base-state.json"),
      projections.baseState
    ),
    writeJsonAtomically(
      join(snapshotPath, "defensive-alignment.json"),
      projections.alignments
    ),
    writeJsonAtomically(
      join(snapshotPath, "current-lineups.json"),
      projections.alignments
    ),
    writeJsonAtomically(
      join(snapshotPath, "replay-frames.json"),
      projections.replayFrames
    ),
    writeJsonAtomically(join(snapshotPath, "statistics.json"), {}),
    writeJsonAtomically(join(snapshotPath, "current-game-state.json"), {
      gameId: projections.gameId,
      eventVersion: projections.eventVersion,
      updatedAtUtc: projections.updatedAtUtc
    })
  ]);
}
