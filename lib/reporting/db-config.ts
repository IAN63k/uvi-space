import type { DatabaseConfig } from "@/lib/database-config";

export function sanitizeDbConfig(config: Partial<DatabaseConfig>): DatabaseConfig | null {
  if (!config.server || !config.user || !config.password || !config.database) {
    return null;
  }

  return {
    server: String(config.server).trim(),
    user: String(config.user).trim(),
    password: String(config.password),
    database: String(config.database).trim(),
  };
}
