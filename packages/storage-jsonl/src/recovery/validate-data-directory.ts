import { readdir } from "node:fs/promises";
import { join } from "node:path";
import { readVerifiedTransactions } from "../filesystem/jsonl-stream.js";

export interface DataValidationResult {
  valid: boolean;
  checkedFiles: string[];
  errors: Array<{ path: string; message: string }>;
}

async function findJsonlFiles(path: string): Promise<string[]> {
  let entries;
  try {
    entries = await readdir(path, { withFileTypes: true });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw error;
  }
  const files: string[] = [];
  for (const entry of entries) {
    const child = join(path, entry.name);
    if (entry.isDirectory()) files.push(...(await findJsonlFiles(child)));
    if (entry.isFile() && entry.name.endsWith(".jsonl")) files.push(child);
  }
  return files;
}

export async function validateDataDirectory(
  root: string
): Promise<DataValidationResult> {
  const checkedFiles = await findJsonlFiles(root);
  const errors: Array<{ path: string; message: string }> = [];
  for (const path of checkedFiles) {
    try {
      await readVerifiedTransactions(path);
    } catch (error) {
      errors.push({
        path,
        message: error instanceof Error ? error.message : String(error)
      });
    }
  }
  return { valid: errors.length === 0, checkedFiles, errors };
}
