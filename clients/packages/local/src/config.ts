/**
 * Service configuration from the environment. Fails fast with a clear message
 * if something required is missing — better at boot than mid-flush.
 */
export interface ServiceConfig {
  readonly port: number;
  readonly dbPath: string;
  readonly polar: {
    readonly token: string;
    readonly server: "production" | "sandbox";
    readonly organizationId?: string;
  };
  readonly flushIntervalMillis: number;
}

const int = (value: string | undefined, fallback: number): number => {
  const n = value === undefined ? fallback : Number(value);
  return Number.isFinite(n) ? n : fallback;
};

export const configFromEnv = (env: Record<string, string | undefined> = process.env): ServiceConfig => {
  const token = env.POLAR_ACCESS_TOKEN;
  if (!token) throw new Error("POLAR_ACCESS_TOKEN is required");

  const server = env.POLAR_SERVER ?? "production";
  if (server !== "production" && server !== "sandbox") {
    throw new Error(`POLAR_SERVER must be "production" or "sandbox" (got "${server}")`);
  }

  return {
    port: int(env.LOCAL_PORT, 8787),
    dbPath: env.LOCAL_DB_PATH ?? "local.db",
    polar: {
      token,
      server,
      ...(env.POLAR_ORG_ID ? { organizationId: env.POLAR_ORG_ID } : {}),
    },
    flushIntervalMillis: int(env.LOCAL_FLUSH_INTERVAL_MS, 5000),
  };
};
