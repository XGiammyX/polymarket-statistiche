export function getEnv(key: string, fallback?: string): string {
  const value = process.env[key] ?? fallback;
  if (value === undefined) {
    throw new Error(`Missing env variable: ${key}`);
  }
  return value;
}

export function getDatabaseUrl(): string {
  return getEnv("DATABASE_URL");
}

export function getSeedSecret(): string {
  return getEnv("SEED_SECRET");
}

export function getCronSecret(): string {
  return getEnv("CRON_SECRET");
}

export function getAdminSecret(): string {
  return getEnv("ADMIN_SECRET");
}

export const IS_PROD = process.env.VERCEL_ENV === "production";
