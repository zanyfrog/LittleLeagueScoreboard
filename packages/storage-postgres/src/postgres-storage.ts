import {
  StorageNotConfiguredError,
  type StorageAdapter
} from "@ll-score/storage-core";
import type { PostgresStorageConfig } from "./postgres-config.js";

export function createPostgresStorage(
  _config: PostgresStorageConfig
): StorageAdapter {
  throw new StorageNotConfiguredError("PostgreSQL");
}
