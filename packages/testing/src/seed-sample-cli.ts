import { resolve } from "node:path";
import { createJsonlStorage } from "@ll-score/storage-jsonl";
import { loadSampleLeague } from "./load-sample-league.js";

const dataDirectory = process.env.LL_SCORE_DATA_DIR
  ? resolve(process.env.LL_SCORE_DATA_DIR)
  : undefined;
const storage = createJsonlStorage(dataDirectory);

await storage.initialize();
try {
  const result = await loadSampleLeague(storage);
  process.stdout.write(
    [
      `Sample data directory: ${storage.paths.root}`,
      `Teams: ${result.teamCount}`,
      `Players: ${result.playerCount}`,
      `Games: ${result.gameCount}`,
      `Game roster entries: ${result.rosterEntryCount}`
    ].join("\n") + "\n"
  );
} finally {
  await storage.close();
}
