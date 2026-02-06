"use client";

import { useState, useCallback } from "react";
import Navbar from "@/components/Navbar";

interface StatusData {
  counts: { markets: number; resolutions: number; trades: number };
  backlog: { pending: number; coolingDown: number };
  etl: { lastSyncAt: string | null; lastComputeAt: string | null; marketsOffset: string };
  recentRuns: Array<{
    id: string;
    job: string;
    started_at: string;
    finished_at: string | null;
    status: string;
    duration_sec: number | null;
    error_preview: string | null;
  }>;
  failedBackfill: Array<{
    condition_id: string;
    next_offset: number;
    fail_count: number;
    last_error: string | null;
    next_retry_at: string | null;
  }>;
}

export default function AdminPage() {
  const [secret, setSecret] = useState(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("admin_secret") ?? "";
    }
    return "";
  });
  const [status, setStatus] = useState<StatusData | null>(null);
  const [loading, setLoading] = useState<string | null>(null);
  const [lastResult, setLastResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const saveSecret = (v: string) => {
    setSecret(v);
    if (typeof window !== "undefined") {
      localStorage.setItem("admin_secret", v);
    }
  };

  const headers = useCallback(
    () => ({ Authorization: `Bearer ${secret}` }),
    [secret]
  );

  const fetchStatus = useCallback(async () => {
    setLoading("status");
    setError(null);
    try {
      const res = await fetch("/api/admin/status", { headers: headers() });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error ?? "Failed");
      setStatus(json);
      setLastResult(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(null);
    }
  }, [headers]);

  const runAction = useCallback(
    async (path: string, label: string) => {
      setLoading(label);
      setError(null);
      setLastResult(null);
      try {
        const res = await fetch(path, {
          method: "POST",
          headers: headers(),
        });
        const json = await res.json();
        if (!json.ok) throw new Error(json.error ?? "Failed");
        setLastResult(JSON.stringify(json.result ?? json, null, 2));
        await fetchStatus();
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        setLoading(null);
      }
    },
    [headers, fetchStatus]
  );

  return (
    <>
      <head>
        <meta name="robots" content="noindex, nofollow" />
      </head>
      <div className="min-h-screen bg-gray-950 text-gray-100">
        <Navbar />
        <main className="max-w-6xl mx-auto px-6 py-6 space-y-6">
          <div>
            <h2 className="text-xl font-bold mb-1">Admin Panel</h2>
            <p className="text-sm text-gray-400">
              Gestione ETL: trigger sync/compute manualmente, monitoraggio stato, log esecuzioni.
              Inserisci l&apos;Admin Secret per autenticarti.
            </p>
          </div>
          {/* Secret input */}
          <div className="flex items-end gap-3">
            <label className="flex flex-col text-sm">
              <span className="text-gray-400 mb-1">Admin Secret</span>
              <input
                type="password"
                className="bg-gray-800 rounded px-3 py-1.5 w-64 text-sm"
                value={secret}
                onChange={(e) => saveSecret(e.target.value)}
                placeholder="Enter ADMIN_SECRET"
              />
            </label>
            <button
              className="bg-blue-600 hover:bg-blue-700 px-4 py-1.5 rounded text-sm font-medium disabled:opacity-50"
              onClick={fetchStatus}
              disabled={!secret || loading !== null}
            >
              {loading === "status" ? "Loading..." : "Refresh Status"}
            </button>
          </div>

          {/* Action buttons */}
          <div className="flex flex-wrap gap-3">
            <a
              href="/admin/watchlist"
              className="bg-gray-700 hover:bg-gray-600 px-4 py-1.5 rounded text-sm font-medium"
            >
              Watchlist →
            </a>
            <button
              className="bg-green-700 hover:bg-green-600 px-4 py-1.5 rounded text-sm font-medium disabled:opacity-50"
              onClick={() => runAction("/api/admin/run-sync", "sync")}
              disabled={!secret || loading !== null}
            >
              {loading === "sync" ? "Running..." : "Run Sync"}
            </button>
            <button
              className="bg-purple-700 hover:bg-purple-600 px-4 py-1.5 rounded text-sm font-medium disabled:opacity-50"
              onClick={() => runAction("/api/admin/run-compute", "compute")}
              disabled={!secret || loading !== null}
            >
              {loading === "compute" ? "Running..." : "Run Compute"}
            </button>
            <button
              className="bg-yellow-700 hover:bg-yellow-600 px-4 py-1.5 rounded text-sm font-medium disabled:opacity-50"
              onClick={() => runAction("/api/admin/reset-market-offset", "reset")}
              disabled={!secret || loading !== null}
            >
              {loading === "reset" ? "Resetting..." : "Reset Market Offset"}
            </button>
          </div>

          {error && (
            <div className="bg-red-950 border border-red-800 text-red-300 rounded p-3 text-sm">
              {error}
            </div>
          )}

          {lastResult && (
            <pre className="bg-gray-800 text-gray-200 rounded p-3 text-xs overflow-auto max-h-60">
              {lastResult}
            </pre>
          )}

          {/* Status display */}
          {status && (
            <>
              {/* Counts + ETL state */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <StatCard label="Markets" value={status.counts.markets} />
                <StatCard label="Resolutions" value={status.counts.resolutions} />
                <StatCard label="Trades" value={status.counts.trades.toLocaleString()} />
                <StatCard label="Backlog Pending" value={status.backlog.pending} />
                <StatCard label="Cooling Down" value={status.backlog.coolingDown} />
                <StatCard label="Markets Offset" value={status.etl.marketsOffset} />
                <StatCard
                  label="Last Sync"
                  value={
                    status.etl.lastSyncAt
                      ? new Date(status.etl.lastSyncAt).toLocaleString()
                      : "—"
                  }
                />
                <StatCard
                  label="Last Compute"
                  value={
                    status.etl.lastComputeAt
                      ? new Date(status.etl.lastComputeAt).toLocaleString()
                      : "—"
                  }
                />
              </div>

              {/* Recent ETL runs */}
              <section>
                <h2 className="text-sm font-semibold text-gray-400 mb-2">
                  Recent ETL Runs
                </h2>
                <div className="overflow-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="text-left text-gray-500 border-b border-gray-800">
                        <th className="py-1.5 px-2">Job</th>
                        <th className="py-1.5 px-2">Started</th>
                        <th className="py-1.5 px-2 text-right">Duration</th>
                        <th className="py-1.5 px-2">Status</th>
                        <th className="py-1.5 px-2">Error</th>
                      </tr>
                    </thead>
                    <tbody>
                      {status.recentRuns.map((r) => (
                        <tr
                          key={r.id}
                          className="border-b border-gray-800/50"
                        >
                          <td className="py-1 px-2 font-mono">{r.job}</td>
                          <td className="py-1 px-2 text-gray-400">
                            {new Date(r.started_at).toLocaleString()}
                          </td>
                          <td className="py-1 px-2 text-right">
                            {r.duration_sec != null ? `${r.duration_sec}s` : "—"}
                          </td>
                          <td className="py-1 px-2">
                            <StatusBadge status={r.status} />
                          </td>
                          <td className="py-1 px-2 text-red-400 truncate max-w-[200px]">
                            {r.error_preview || ""}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>

              {/* Failed backfill */}
              {status.failedBackfill.length > 0 && (
                <section>
                  <h2 className="text-sm font-semibold text-gray-400 mb-2">
                    Trade Backfill Errors
                  </h2>
                  <div className="overflow-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="text-left text-gray-500 border-b border-gray-800">
                          <th className="py-1.5 px-2">Condition ID</th>
                          <th className="py-1.5 px-2 text-right">Offset</th>
                          <th className="py-1.5 px-2 text-right">Fails</th>
                          <th className="py-1.5 px-2">Next Retry</th>
                          <th className="py-1.5 px-2">Error</th>
                        </tr>
                      </thead>
                      <tbody>
                        {status.failedBackfill.map((r) => (
                          <tr
                            key={r.condition_id}
                            className="border-b border-gray-800/50"
                          >
                            <td className="py-1 px-2 font-mono truncate max-w-[160px]">
                              {r.condition_id}
                            </td>
                            <td className="py-1 px-2 text-right">
                              {r.next_offset}
                            </td>
                            <td className="py-1 px-2 text-right text-red-400">
                              {r.fail_count}
                            </td>
                            <td className="py-1 px-2 text-gray-400">
                              {r.next_retry_at
                                ? new Date(r.next_retry_at).toLocaleString()
                                : "—"}
                            </td>
                            <td className="py-1 px-2 text-red-400 truncate max-w-[200px]">
                              {r.last_error || ""}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </section>
              )}
            </>
          )}
        </main>
      </div>
    </>
  );
}

function StatCard({
  label,
  value,
}: {
  label: string;
  value: string | number;
}) {
  return (
    <div className="bg-gray-900 rounded-lg p-3">
      <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-1">
        {label}
      </p>
      <p className="text-sm font-semibold text-gray-100">{value}</p>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    success: "text-green-400 bg-green-900/40",
    partial: "text-yellow-400 bg-yellow-900/40",
    error: "text-red-400 bg-red-900/40",
    running: "text-blue-400 bg-blue-900/40",
    skipped: "text-gray-400 bg-gray-800",
  };
  const cls = colors[status] ?? colors.skipped;
  return (
    <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${cls}`}>
      {status}
    </span>
  );
}
