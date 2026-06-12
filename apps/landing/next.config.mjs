const nextConfig = {
  transpilePackages: [
    "@ll-score/contracts",
    "@ll-score/game-engine",
    "@ll-score/storage-core",
    "@ll-score/storage-jsonl",
    "@ll-score/iam-local",
    "@ll-score/scoreboard",
    "@ll-score/rosters",
    "@ll-score/base-runners",
    "@ll-score/field-diagram"
  ],
  webpack(config) {
    config.resolve.extensionAlias = {
      ".js": [".ts", ".tsx", ".js"],
      ".mjs": [".mts", ".mjs"],
      ".cjs": [".cts", ".cjs"]
    };
    return config;
  }
};

export default nextConfig;
