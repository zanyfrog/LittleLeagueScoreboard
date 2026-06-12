import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@ll-score/contracts": fileURLToPath(
        new URL("../contracts/src/index.ts", import.meta.url)
      ),
      "@ll-score/storage-core": fileURLToPath(
        new URL("../storage-core/src/index.ts", import.meta.url)
      ),
      "@ll-score/storage-jsonl": fileURLToPath(
        new URL("../storage-jsonl/src/index.ts", import.meta.url)
      )
    }
  }
});
