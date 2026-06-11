import { mkdir, readFile } from "node:fs/promises";
import type { DataDirectoryPaths } from "../filesystem/data-directory.js";
import { writeJsonAtomically } from "../filesystem/atomic-file.js";

export interface DataManifest {
  storageFormat: "ll-score-jsonl";
  schemaVersion: number;
  createdAtUtc: string;
  updatedAtUtc: string;
}

export async function initializeVersionOne(
  paths: DataDirectoryPaths
): Promise<DataManifest> {
  await Promise.all(
    [
      paths.root,
      paths.catalog,
      paths.games,
      paths.audit,
      paths.imports,
      paths.exports,
      paths.backups,
      paths.recovery
    ].map((path) => mkdir(path, { recursive: true }))
  );

  try {
    return JSON.parse(await readFile(paths.manifest, "utf8")) as DataManifest;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }

  const now = new Date().toISOString();
  const manifest: DataManifest = {
    storageFormat: "ll-score-jsonl",
    schemaVersion: 1,
    createdAtUtc: now,
    updatedAtUtc: now
  };
  await writeJsonAtomically(paths.manifest, manifest);
  return manifest;
}
