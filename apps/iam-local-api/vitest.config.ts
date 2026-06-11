import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@ll-score/contracts": fileURLToPath(
        new URL("../../packages/contracts/src/index.ts", import.meta.url)
      ),
      "@ll-score/iam-local": fileURLToPath(
        new URL("../../packages/iam-local/src/index.ts", import.meta.url)
      )
    }
  }
});
