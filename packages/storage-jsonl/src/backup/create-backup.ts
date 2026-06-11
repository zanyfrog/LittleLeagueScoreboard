import { cp, mkdir, readdir } from "node:fs/promises";
import { join } from "node:path";

export async function createBackup(
  dataRoot: string,
  backupsPath: string,
  name = new Date().toISOString().replace(/[:.]/g, "-")
): Promise<string> {
  await mkdir(backupsPath, { recursive: true });
  const destination = join(backupsPath, name);
  await mkdir(destination);
  for (const entry of await readdir(dataRoot, { withFileTypes: true })) {
    if (entry.name === "backups" || entry.name === ".writer.lock") continue;
    await cp(join(dataRoot, entry.name), join(destination, entry.name), {
      recursive: entry.isDirectory(),
      errorOnExist: true
    });
  }
  return destination;
}
