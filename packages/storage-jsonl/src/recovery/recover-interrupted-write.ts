import { randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { basename, join } from "node:path";

export interface RecoveryResult {
  recovered: boolean;
  quarantinedPath?: string;
}

export async function recoverIncompleteFinalLine(
  jsonlPath: string,
  recoveryPath: string
): Promise<RecoveryResult> {
  const contents = await readFile(jsonlPath, "utf8");
  const lines = contents.split(/\r?\n/);
  if (lines.at(-1) === "") lines.pop();
  const finalLine = lines.at(-1);
  if (!finalLine) return { recovered: false };

  try {
    JSON.parse(finalLine);
    return { recovered: false };
  } catch {
    lines.pop();
    await mkdir(recoveryPath, { recursive: true });
    const quarantinedPath = join(
      recoveryPath,
      `${basename(jsonlPath)}.${randomUUID()}.incomplete`
    );
    await writeFile(quarantinedPath, `${finalLine}\n`, "utf8");
    await writeFile(
      jsonlPath,
      lines.length > 0 ? `${lines.join("\n")}\n` : "",
      { encoding: "utf8", flush: true }
    );
    return { recovered: true, quarantinedPath };
  }
}
