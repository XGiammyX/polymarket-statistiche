"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";

interface Position {
  wallet: string;
  conditionId: string;
  outcomeIndex: number;
  netShares: number;
  lastTradeAt: string | null;
  question: string | null;
  slug: string | null;
  endDate: string | null;
  closed: boolean | null;
  tokenId: string | null;
  currentPrice: number | null;
}

export default function PositionsPage() {
  const [walletFilter, setWalletFilter] = useState("");
  const [onlyFollowable, setOnlyFollowable] = useState(true);
  const [positions, setPositions] = useState<Position[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchPositions = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        limit: "300",
        onlyFollowable: onlyFollowable ? "true" : "false",
      });
      const trimmed = walletFilter.trim().toLowerCase();
      if (trimmed && /^0x[a-f0-9]{40}$/i.test(trimmed)) {
        params.set("wallet", trimmed);
        params.set("onlyFollowable", "false");
      }
      const res = await fetch(`/api/positions?${params}`);
      const json = await res.json();
      if (!json.ok) throw new Error(json.error ?? "Unknown error");
      setPositions(json.positions ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [walletFilter, onlyFollowable]);

  useEffect(() => {
    fetchPositions();
  }, [fetchPositions]);

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
            <Link href="/signals" className="text-gray-400 hover:text-gray-200">
              Signals
            </Link>
            <Link href="/positions" className="text-blue-400 font-semibold">
              Positions
            </Link>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-6">
        <h2 className="text-lg font-bold mb-1">Open Positions</h2>
        <p className="text-xs text-gray-500 mb-4">
          Open positions (net_shares &gt; 0) from followable wallets. Includes current price when available.
        </p>

        {/* Filters */}
        <div className="flex flex-wrap gap-3 items-end mb-5">
          <label className="flex flex-col text-sm">
            <span className="text-gray-400 mb-1">Wallet (optional)</span>
            <input
              className="bg-gray-800 rounded px-3 py-1.5 w-80 text-sm font-mono"
              value={walletFilter}
              onChange={(e) => setWalletFilter(e.target.value)}
              placeholder="0x..."
            />
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

        {error && (
          <div className="bg-red-950 border border-red-800 text-red-300 rounded p-3 text-sm mb-4">
            {error}
          </div>
        )}

        {loading ? (
          <p className="text-gray-500 text-sm">Loading...</p>
        ) : positions.length === 0 ? (
          <p className="text-gray-500 text-sm">
            Nessuna posizione aperta trovata.
          </p>
        ) : (
          <div className="overflow-auto">
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-gray-950">
                <tr className="text-left text-gray-400 border-b border-gray-800">
                  <th className="py-2 px-2">Wallet</th>
                  <th className="py-2 px-2">Market</th>
                  <th className="py-2 px-2 text-center">Idx</th>
                  <th className="py-2 px-2 text-right">Shares</th>
                  <th className="py-2 px-2 text-right">Cur. Price</th>
                  <th className="py-2 px-2">Last Trade</th>
                  <th className="py-2 px-2 text-center">Status</th>
                  <th className="py-2 px-2"></th>
                </tr>
              </thead>
              <tbody>
                {positions.map((p, i) => (
                  <tr
                    key={`${p.wallet}-${p.conditionId}-${p.outcomeIndex}-${i}`}
                    className="border-b border-gray-800/50 hover:bg-gray-800/30"
                  >
                    <td className="py-1.5 px-2 font-mono">
                      <Link
                        href={`/wallet/${p.wallet}`}
                        className="text-blue-400 hover:underline"
                      >
                        {p.wallet.slice(0, 6)}...{p.wallet.slice(-4)}
                      </Link>
                    </td>
                    <td className="py-1.5 px-2 max-w-xs truncate">
                      {p.question || p.conditionId.slice(0, 16) + "..."}
                    </td>
                    <td className="py-1.5 px-2 text-center text-gray-400">
                      {p.outcomeIndex}
                    </td>
                    <td className="py-1.5 px-2 text-right font-semibold">
                      {Number(p.netShares).toFixed(2)}
                    </td>
                    <td className="py-1.5 px-2 text-right">
                      {p.currentPrice != null ? (
                        <span className="text-yellow-400">
                          {Number(p.currentPrice).toFixed(4)}
                        </span>
                      ) : (
                        <span className="text-gray-600">—</span>
                      )}
                    </td>
                    <td className="py-1.5 px-2 text-gray-400 whitespace-nowrap">
                      {p.lastTradeAt ? (
                        <span title={new Date(p.lastTradeAt).toLocaleString()}>
                          {timeAgo(p.lastTradeAt)}
                        </span>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="py-1.5 px-2 text-center">
                      {p.closed ? (
                        <span className="text-gray-500">Closed</span>
                      ) : (
                        <span className="text-yellow-400">Open</span>
                      )}
                    </td>
                    <td className="py-1.5 px-2">
                      {p.slug && (
                        <a
                          href={`https://polymarket.com/market/${p.slug}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-500 hover:underline text-[10px]"
                        >
                          Open
                        </a>
                      )}
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
