"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";

interface Signal {
  wallet: string;
  ts: string;
  conditionId: string;
  entryPrice: number;
  currentPrice: number | null;
  size: number;
  outcomeIndex: number;
  netShares: number | null;
  question: string | null;
  slug: string | null;
  endDate: string | null;
  closed: boolean | null;
}

export default function SignalsPage() {
  const [threshold, setThreshold] = useState("0.02");
  const [hours, setHours] = useState("72");
  const [onlyFollowable, setOnlyFollowable] = useState(true);
  const [activeOnly, setActiveOnly] = useState(true);
  const [signals, setSignals] = useState<Signal[]>([]);
  const [lastSync, setLastSync] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchSignals = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        threshold,
        hours,
        limit: "200",
        onlyFollowable: onlyFollowable ? "true" : "false",
        activeOnly: activeOnly ? "true" : "false",
      });
      const res = await fetch(`/api/signals?${params}`);
      const json = await res.json();
      if (!json.ok) throw new Error(json.error ?? "Unknown error");
      setSignals(json.signals ?? []);
      setLastSync(json.lastLiveSyncAt ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [threshold, hours, onlyFollowable, activeOnly]);

  useEffect(() => {
    fetchSignals();
  }, [fetchSignals]);

  function timeAgo(iso: string): string {
    const diff = Date.now() - new Date(iso).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
  }

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100">
      <header className="border-b border-gray-800 px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <Link href="/" className="text-xl font-bold hover:text-blue-400">
            Polymarket Statistiche
          </Link>
          <div className="flex gap-3 text-sm">
            <Link href="/" className="text-gray-400 hover:text-gray-200">
              Leaderboard
            </Link>
            <Link href="/signals" className="text-blue-400 font-semibold">
              Signals
            </Link>
            <Link href="/positions" className="text-gray-400 hover:text-gray-200">
              Positions
            </Link>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-6">
        <h2 className="text-lg font-bold mb-1">Live Signals</h2>
        <p className="text-xs text-gray-500 mb-4">
          Recent low-probability BUY trades from followable wallets.
          {lastSync && (
            <> Last live sync: <strong className="text-gray-400">{new Date(lastSync).toLocaleString()}</strong></>
          )}
        </p>

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
            <span className="text-gray-400 mb-1">Timeframe</span>
            <select
              className="bg-gray-800 rounded px-3 py-1.5 text-sm"
              value={hours}
              onChange={(e) => setHours(e.target.value)}
            >
              <option value="24">24h</option>
              <option value="72">72h</option>
              <option value="168">7d</option>
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
          <label className="flex items-center gap-2 text-sm cursor-pointer pt-5">
            <input
              type="checkbox"
              className="accent-green-500"
              checked={activeOnly}
              onChange={(e) => setActiveOnly(e.target.checked)}
            />
            <span className="text-gray-400">Solo Attivi (posizione aperta)</span>
          </label>
        </div>

        {error && (
          <div className="bg-red-950 border border-red-800 text-red-300 rounded p-3 text-sm mb-4">
            {error}
          </div>
        )}

        {loading ? (
          <p className="text-gray-500 text-sm">Loading...</p>
        ) : signals.length === 0 ? (
          <p className="text-gray-500 text-sm">
            Nessun segnale trovato. Esegui sync-live prima.
          </p>
        ) : (
          <div className="overflow-auto">
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-gray-950">
                <tr className="text-left text-gray-400 border-b border-gray-800">
                  <th className="py-2 px-2">When</th>
                  <th className="py-2 px-2">Wallet</th>
                  <th className="py-2 px-2 text-right">Entry</th>
                  <th className="py-2 px-2 text-right">Now</th>
                  <th className="py-2 px-2 text-right">Size</th>
                  <th className="py-2 px-2 text-right">Shares</th>
                  <th className="py-2 px-2">Market</th>
                  <th className="py-2 px-2 text-center">Status</th>
                  <th className="py-2 px-2"></th>
                </tr>
              </thead>
              <tbody>
                {signals.map((s, i) => {
                  const delta =
                    s.currentPrice != null
                      ? s.currentPrice - Number(s.entryPrice)
                      : null;
                  return (
                    <tr
                      key={`${s.conditionId}-${s.wallet}-${i}`}
                      className="border-b border-gray-800/50 hover:bg-gray-800/30"
                    >
                      <td className="py-1.5 px-2 text-gray-400 whitespace-nowrap">
                        <span title={new Date(s.ts).toLocaleString()}>
                          {timeAgo(s.ts)}
                        </span>
                      </td>
                      <td className="py-1.5 px-2 font-mono">
                        <Link
                          href={`/wallet/${s.wallet}`}
                          className="text-blue-400 hover:underline"
                        >
                          {s.wallet.slice(0, 6)}...{s.wallet.slice(-4)}
                        </Link>
                      </td>
                      <td className="py-1.5 px-2 text-right text-green-400 font-semibold">
                        {Number(s.entryPrice).toFixed(4)}
                      </td>
                      <td className="py-1.5 px-2 text-right">
                        {s.currentPrice != null ? (
                          <span
                            className={
                              delta != null && delta > 0
                                ? "text-green-400"
                                : delta != null && delta < 0
                                ? "text-red-400"
                                : "text-yellow-400"
                            }
                          >
                            {Number(s.currentPrice).toFixed(4)}
                            {delta != null && (
                              <span className="text-[10px] ml-0.5">
                                ({delta > 0 ? "+" : ""}
                                {delta.toFixed(3)})
                              </span>
                            )}
                          </span>
                        ) : (
                          <span className="text-gray-600">—</span>
                        )}
                      </td>
                      <td className="py-1.5 px-2 text-right">
                        {Number(s.size).toFixed(2)}
                      </td>
                      <td className="py-1.5 px-2 text-right text-gray-400">
                        {s.netShares != null
                          ? Number(s.netShares).toFixed(2)
                          : "—"}
                      </td>
                      <td className="py-1.5 px-2 max-w-xs truncate">
                        {s.question || s.conditionId.slice(0, 16) + "..."}
                      </td>
                      <td className="py-1.5 px-2 text-center">
                        {s.closed ? (
                          <span className="text-gray-500">Closed</span>
                        ) : (
                          <span className="text-yellow-400">Open</span>
                        )}
                      </td>
                      <td className="py-1.5 px-2">
                        {s.slug && (
                          <a
                            href={`https://polymarket.com/market/${s.slug}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-500 hover:underline text-[10px]"
                          >
                            Open
                          </a>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </div>
  );
}
