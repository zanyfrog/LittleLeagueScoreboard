import type { DataDirectoryPaths } from "../filesystem/data-directory.js";
import {
  initializeVersionOne,
  type DataManifest
} from "./v1-initialize.js";

export const currentSchemaVersion = 1;

export async function migrateDataDirectory(
  paths: DataDirectoryPaths
): Promise<DataManifest> {
  const manifest = await initializeVersionOne(paths);
  if (manifest.schemaVersion > currentSchemaVersion) {
    throw new Error(
      `Data schema ${manifest.schemaVersion} is newer than supported schema ${currentSchemaVersion}`
    );
  }
  return manifest;
}
