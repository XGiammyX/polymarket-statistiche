/**
 * env.ts — Accesso centralizzato alle variabili d'ambiente.
 *
 * Variabili richieste:
 *   DATABASE_URL   — Connection string PostgreSQL (Neon)
 *   SEED_SECRET    — Secret per l'endpoint /api/db/seed (inizializzazione DB)
 *   CRON_SECRET    — Secret usato da Vercel Cron per autenticare le chiamate ai job
 *   ADMIN_SECRET   — Secret per le API admin (/api/admin/*)
 *
 * Tutte le funzioni lanciano un errore se la variabile manca e non c'è fallback.
 */
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
