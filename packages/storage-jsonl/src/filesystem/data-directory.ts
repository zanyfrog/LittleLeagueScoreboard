import { homedir } from "node:os";
import { join } from "node:path";

export interface DataDirectoryPaths {
  root: string;
  manifest: string;
  catalog: string;
  games: string;
  audit: string;
  imports: string;
  exports: string;
  backups: string;
  recovery: string;
  lock: string;
}

export function defaultDataDirectory(): string {
  const localAppData =
    process.env.LOCALAPPDATA ?? join(homedir(), ".little-league-scoreboard");
  return join(localAppData, "LittleLeagueScoreboard", "data");
}

export function dataDirectoryPaths(root = defaultDataDirectory()): DataDirectoryPaths {
  return {
    root,
    manifest: join(root, "manifest.json"),
    catalog: join(root, "catalog"),
    games: join(root, "games"),
    audit: join(root, "audit"),
    imports: join(root, "imports"),
    exports: join(root, "exports"),
    backups: join(root, "backups"),
    recovery: join(root, "recovery"),
    lock: join(root, ".writer.lock")
  };
}
