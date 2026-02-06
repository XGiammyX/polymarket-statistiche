"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";

interface LeaderboardItem {
  wallet: string;
  followScore: number;
  isFollowable: boolean;
  n: number;
  wins: number;
  alphaz: number;
  hedgeRate: number;
  lateSnipingRate: number;
  lastTradeAt: string | null;
}

interface HealthData {
  counts: { markets: number; resolutions: number; trades: number };
  backlog: { pending: number; coolingDown: number };
  lastComputeAt: string | null;
}

export default function Home() {
  const [threshold, setThreshold] = useState("0.02");
  const [minN, setMinN] = useState("20");
  const [onlyFollowable, setOnlyFollowable] = useState(false);
  const [sort, setSort] = useState("followScore");
  const [items, setItems] = useState<LeaderboardItem[]>([]);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [health, setHealth] = useState<HealthData | null>(null);

  const fetchLeaderboard = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        threshold,
        minN,
        sort,
        limit: "100",
        ...(onlyFollowable ? { onlyFollowable: "true" } : {}),
      });
      const res = await fetch(`/api/leaderboard?${params}`);
      const json = await res.json();
      if (!json.ok) throw new Error(json.error ?? "Unknown error");
      setItems(json.items ?? []);
      setUpdatedAt(json.updatedAt ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [threshold, minN, sort, onlyFollowable]);

  useEffect(() => {
    fetchLeaderboard();
  }, [fetchLeaderboard]);

  useEffect(() => {
    fetch("/api/health")
      .then((r) => r.json())
      .then((j) => {
        if (j.ok) setHealth(j);
      })
      .catch(() => {});
  }, []);

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100">
      <header className="border-b border-gray-800 px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <h1 className="text-xl font-bold">Polymarket Statistiche</h1>
          <div className="flex gap-3 text-sm">
            <Link href="/signals" className="text-gray-400 hover:text-gray-200">
              Signals
            </Link>
            <Link href="/positions" className="text-gray-400 hover:text-gray-200">
              Positions
            </Link>
            <Link href="/debug" className="text-gray-400 hover:text-gray-200">
              Debug
            </Link>
            <Link
              href="/api/health"
              className="text-gray-400 hover:text-gray-200"
            >
              Health
            </Link>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-6">
        {/* Health summary */}
        {health && (
          <div className="flex flex-wrap gap-4 mb-6 text-xs text-gray-500">
            <span>
              Markets: <strong className="text-gray-300">{health.counts.markets}</strong>
            </span>
            <span>
              Resolutions: <strong className="text-gray-300">{health.counts.resolutions}</strong>
            </span>
            <span>
              Trades: <strong className="text-gray-300">{health.counts.trades.toLocaleString()}</strong>
            </span>
            <span>
              Backlog: <strong className="text-gray-300">{health.backlog.pending}</strong>
            </span>
            {health.lastComputeAt && (
              <span>
                Last compute:{" "}
                <strong className="text-gray-300">
                  {new Date(health.lastComputeAt).toLocaleString()}
                </strong>
              </span>
            )}
          </div>
        )}

        {/* Filters */}
        <div className="flex flex-wrap gap-3 items-end mb-5">
          <label className="flex flex-col text-sm">
            <span className="text-gray-400 mb-1">Threshold</span>
            <select
              className="bg-gray-800 rounded px-3 py-1.5 text-sm"
              value={threshold}
              onChange={(e) => setThreshold(e.target.value)}
            >
              <option value="0.05">0.05</option>
              <option value="0.02">0.02</option>
              <option value="0.01">0.01</option>
            </select>
          </label>
          <label className="flex flex-col text-sm">
            <span className="text-gray-400 mb-1">Min N</span>
            <input
              className="bg-gray-800 rounded px-3 py-1.5 w-20 text-sm"
              value={minN}
              onChange={(e) => setMinN(e.target.value)}
            />
          </label>
          <label className="flex flex-col text-sm">
            <span className="text-gray-400 mb-1">Sort</span>
            <select
              className="bg-gray-800 rounded px-3 py-1.5 text-sm"
              value={sort}
              onChange={(e) => setSort(e.target.value)}
            >
              <option value="followScore">Follow Score</option>
              <option value="alphaz">Alpha Z</option>
              <option value="wins">Wins</option>
              <option value="n">N trades</option>
            </select>
          </label>
          <label className="flex items-center gap-2 text-sm cursor-pointer pt-5">
            <input
              type="checkbox"
              className="accent-blue-500"
              checked={onlyFollowable}
              onChange={(e) => setOnlyFollowable(e.target.checked)}
            />
            <span className="text-gray-400">Solo Followable</span>
          </label>
        </div>

        {updatedAt && (
          <p className="text-xs text-gray-600 mb-3">
            Last compute: {new Date(updatedAt).toLocaleString()} — {items.length} results
          </p>
        )}

        {/* Error */}
        {error && (
          <div className="bg-red-950 border border-red-800 text-red-300 rounded p-3 text-sm mb-4">
            {error}
          </div>
        )}

        {/* Table */}
        {loading ? (
          <p className="text-gray-500 text-sm">Loading...</p>
        ) : items.length === 0 ? (
          <p className="text-gray-500 text-sm">
            Nessun risultato. Esegui sync + compute prima.
          </p>
        ) : (
          <div className="overflow-auto">
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-gray-950">
                <tr className="text-left text-gray-400 border-b border-gray-800">
                  <th className="py-2 px-2">#</th>
                  <th className="py-2 px-2">Wallet</th>
                  <th className="py-2 px-2 text-right">Follow</th>
                  <th className="py-2 px-2 text-center">OK</th>
                  <th className="py-2 px-2 text-right">N</th>
                  <th className="py-2 px-2 text-right">Wins</th>
                  <th className="py-2 px-2 text-right">AlphaZ</th>
                  <th className="py-2 px-2 text-right">Hedge%</th>
                  <th className="py-2 px-2 text-right">Late%</th>
                  <th className="py-2 px-2">Last Trade</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item, i) => (
                  <tr
                    key={item.wallet}
                    className="border-b border-gray-800/50 hover:bg-gray-800/30"
                  >
                    <td className="py-1.5 px-2 text-gray-600">{i + 1}</td>
                    <td className="py-1.5 px-2 font-mono">
                      <Link
                        href={`/wallet/${item.wallet}`}
                        className="text-blue-400 hover:underline"
                      >
                        {item.wallet.slice(0, 6)}...{item.wallet.slice(-4)}
                      </Link>
                    </td>
                    <td className="py-1.5 px-2 text-right font-semibold text-blue-400">
                      {Number(item.followScore).toFixed(1)}
                    </td>
                    <td className="py-1.5 px-2 text-center">
                      {item.isFollowable ? (
                        <span className="text-green-400">Y</span>
                      ) : (
                        <span className="text-gray-600">N</span>
                      )}
                    </td>
                    <td className="py-1.5 px-2 text-right">{item.n}</td>
                    <td className="py-1.5 px-2 text-right">{item.wins}</td>
                    <td className="py-1.5 px-2 text-right">
                      {Number(item.alphaz).toFixed(2)}
                    </td>
                    <td className="py-1.5 px-2 text-right">
                      {(Number(item.hedgeRate) * 100).toFixed(1)}%
                    </td>
                    <td className="py-1.5 px-2 text-right">
                      {(Number(item.lateSnipingRate) * 100).toFixed(1)}%
                    </td>
                    <td className="py-1.5 px-2 text-gray-500">
                      {item.lastTradeAt
                        ? new Date(item.lastTradeAt).toLocaleDateString()
                        : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </div>
  );
}
