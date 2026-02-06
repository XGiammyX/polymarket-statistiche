import { query } from "./db";

export async function tryAdvisoryLock(lockKey: number): Promise<boolean> {
  const res = await query("SELECT pg_try_advisory_lock($1) AS locked", [lockKey]);
  return res.rows[0]?.locked === true;
}

export async function unlockAdvisoryLock(lockKey: number): Promise<void> {
  await query("SELECT pg_advisory_unlock($1)", [lockKey]);
}

