import { cp, mkdir, rename, rm } from "node:fs/promises";
import { dirname } from "node:path";
import { randomUUID } from "node:crypto";

export async function restoreBackup(
  backupPath: string,
  dataRoot: string
): Promise<void> {
  const parent = dirname(dataRoot);
  const staging = `${dataRoot}.restore.${randomUUID()}`;
  const previous = `${dataRoot}.previous.${randomUUID()}`;
  await mkdir(parent, { recursive: true });
  await cp(backupPath, staging, { recursive: true, errorOnExist: true });
  await rename(dataRoot, previous);
  try {
    await rename(staging, dataRoot);
    await rm(previous, { recursive: true, force: true });
  } catch (error) {
    await rename(previous, dataRoot);
    await rm(staging, { recursive: true, force: true });
    throw error;
  }
}
