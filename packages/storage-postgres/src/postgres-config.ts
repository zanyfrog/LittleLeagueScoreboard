export interface PostgresStorageConfig {
  connectionString: string;
  applicationName?: string;
  statementTimeoutMs?: number;
  sslMode?: "disable" | "require" | "verify-full";
}

export function validatePostgresStorageConfig(
  config: PostgresStorageConfig
): PostgresStorageConfig {
  if (!config.connectionString.trim()) {
    throw new Error("PostgreSQL connectionString is required");
  }
  return config;
}
