import { query } from "./db";

/**
 * Try to acquire an advisory lock. If a lock has been held for more than
 * MAX_LOCK_AGE_MS, we force-release it first (prevents stuck locks from
 * serverless timeouts where the session stays alive in the pool).
 */
const MAX_LOCK_AGE_MS = 120_000; // 2 minutes

export async function tryAdvisoryLock(lockKey: number): Promise<boolean> {
  // First, try to release stale locks held by idle sessions (safety net)
  try {
    await query(
      `SELECT pg_terminate_backend(pid)
       FROM pg_locks l
       JOIN pg_stat_activity a ON a.pid = l.pid
       WHERE l.locktype = 'advisory'
         AND l.objid = $1
         AND a.state = 'idle'
         AND a.query_start < NOW() - make_interval(secs => $2)`,
      [lockKey, MAX_LOCK_AGE_MS / 1000]
    );
  } catch { /* best effort */ }

  const res = await query("SELECT pg_try_advisory_lock($1) AS locked", [lockKey]);
  return res.rows[0]?.locked === true;
}

export async function unlockAdvisoryLock(lockKey: number): Promise<void> {
  await query("SELECT pg_advisory_unlock($1)", [lockKey]);
}

