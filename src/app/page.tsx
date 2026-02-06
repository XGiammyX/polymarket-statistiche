"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import Navbar from "@/components/Navbar";

interface LeaderboardItem {
  wallet: string;
  followScore: number;
  isFollowable: boolean;
  n: number;
  wins: number;
  expectedWins: number;
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

function daysAgo(iso: string): string {
  const d = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
  if (d === 0) return "oggi";
  if (d === 1) return "ieri";
  return `${d}g fa`;
}

export default function Home() {
  const [threshold, setThreshold] = useState("0.02");
  const [minN, setMinN] = useState("1");
  const [onlyFollowable, setOnlyFollowable] = useState(false);
  const [sort, setSort] = useState("followScore");
  const [items, setItems] = useState<LeaderboardItem[]>([]);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [health, setHealth] = useState<HealthData | null>(null);
  const [showHelp, setShowHelp] = useState(false);

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

  useEffect(() => { fetchLeaderboard(); }, [fetchLeaderboard]);

  useEffect(() => {
    fetch("/api/health")
      .then((r) => r.json())
      .then((j) => { if (j.ok) setHealth(j); })
      .catch(() => {});
  }, []);

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100">
      <Navbar />
      <main className="max-w-7xl mx-auto px-6 py-6">
        {/* Header compact */}
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold">Leaderboard</h2>
            <p className="text-sm text-gray-500 mt-0.5">
              Wallet che vincono scommesse improbabili su Polymarket.
              {" "}<button onClick={() => setShowHelp(!showHelp)} className="text-blue-400 hover:underline">
                {showHelp ? "Nascondi guida" : "Come funziona?"}
              </button>
            </p>
          </div>
          {health && (
            <div className="flex gap-2 flex-shrink-0">
              {[
                { label: "Mercati", value: health.counts.markets.toLocaleString() },
                { label: "Trade", value: health.counts.trades.toLocaleString() },
              ].map((s) => (
                <span key={s.label} className="bg-gray-900 rounded px-2.5 py-1 text-[10px] text-gray-400">
                  {s.label} <strong className="text-gray-200">{s.value}</strong>
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Collapsible help */}
        {showHelp && (
          <div className="mb-4 grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs text-gray-500 animate-in">
            <div className="bg-gray-900/60 rounded p-2.5">
              <strong className="text-gray-300">Win Rate</strong> — Percentuale di vittorie sui trade fatti. Un wallet che compra a 2% e vince il 5% delle volte ha un edge reale.
            </div>
            <div className="bg-gray-900/60 rounded p-2.5">
              <strong className="text-gray-300">Alpha-Z</strong> — Quante deviazioni standard sopra il caso. &gt;2 = statisticamente significativo. Verde = edge, rosso = sotto la media.
            </div>
            <div className="bg-gray-900/60 rounded p-2.5">
              <strong className="text-gray-300">ROI</strong> — Rendimento simulato: se avessi messo $1 per ogni trade del wallet, quanto avresti guadagnato/perso.
            </div>
            <div className="bg-gray-900/60 rounded p-2.5">
              <strong className="text-gray-300">Followable ✓</strong> — Wallet con N≥20, Alpha-Z&gt;0, Hedge≤25%, Late≤60%. Affidabile da copiare.
            </div>
          </div>
        )}

        {/* Filters — compact single row */}
        <div className="mb-4 flex flex-wrap gap-3 items-center bg-gray-900/40 rounded-lg px-4 py-2.5">
          <label className="flex items-center gap-1.5 text-xs">
            <span className="text-gray-500">Soglia</span>
            <select className="bg-gray-800 rounded px-2 py-1 text-xs" value={threshold} onChange={(e) => setThreshold(e.target.value)}>
              <option value="0.05">≤5%</option>
              <option value="0.02">≤2%</option>
              <option value="0.01">≤1%</option>
            </select>
          </label>
          <label className="flex items-center gap-1.5 text-xs">
            <span className="text-gray-500">Min N</span>
            <input className="bg-gray-800 rounded px-2 py-1 w-14 text-xs" type="number" min="1" value={minN} onChange={(e) => setMinN(e.target.value)} />
          </label>
          <label className="flex items-center gap-1.5 text-xs">
            <span className="text-gray-500">Ordina</span>
            <select className="bg-gray-800 rounded px-2 py-1 text-xs" value={sort} onChange={(e) => setSort(e.target.value)}>
              <option value="followScore">Score</option>
              <option value="alphaz">Alpha-Z</option>
              <option value="wins">Wins</option>
              <option value="n">N trade</option>
            </select>
          </label>
          <label className="flex items-center gap-1.5 text-xs cursor-pointer">
            <input type="checkbox" className="accent-blue-500" checked={onlyFollowable} onChange={(e) => setOnlyFollowable(e.target.checked)} />
            <span className="text-gray-400">Solo Followable</span>
          </label>
          <div className="flex-1" />
          {updatedAt && (
            <span className="text-[10px] text-gray-600">
              Aggiornato: {new Date(updatedAt).toLocaleString()} — {items.length} risultati
            </span>
          )}
        </div>

        {error && (
          <div className="bg-red-950 border border-red-800 text-red-300 rounded p-3 text-sm mb-4">{error}</div>
        )}

        {loading ? (
          <div className="flex justify-center py-12">
            <div className="animate-pulse text-gray-500 text-sm">Caricamento...</div>
          </div>
        ) : items.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-500 text-sm">Nessun wallet trovato con questi filtri.</p>
            <p className="text-gray-600 text-xs mt-1">Prova ad abbassare &quot;Min N&quot; o vai in <Link href="/admin" className="text-blue-400 hover:underline">Admin</Link> per sync + compute.</p>
          </div>
        ) : (
          <div className="overflow-auto rounded-lg border border-gray-800">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-left text-gray-400 bg-gray-900/80 border-b border-gray-800">
                  <th className="py-2 px-2.5">#</th>
                  <th className="py-2 px-2.5">Wallet</th>
                  <th className="py-2 px-2.5 text-right" title="Punteggio composito 0-100">Score</th>
                  <th className="py-2 px-2.5 text-right" title="Trade analizzati / Vittorie">N/W</th>
                  <th className="py-2 px-2.5 text-right" title="Percentuale vittorie effettive">Win%</th>
                  <th className="py-2 px-2.5 text-right" title="Win% atteso dal caso">E[W%]</th>
                  <th className="py-2 px-2.5 text-right" title="Z-score: deviazioni standard sopra il caso">αZ</th>
                  <th className="py-2 px-2.5 text-right" title="ROI simulato: profitto per $1 investito per trade">ROI</th>
                  <th className="py-2 px-2.5 text-right" title="Hedge rate + Late sniping rate">H/L%</th>
                  <th className="py-2 px-2.5" title="Ultimo trade low-prob">Ultimo</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item, i) => {
                  const n = item.n || 1;
                  const winRate = (item.wins / n) * 100;
                  const expectedRate = (Number(item.expectedWins) / n) * 100;
                  // ROI: each win pays ~$1/avgPrice, cost = $avgPrice per trade × N trades
                  // Simplified: (wins × (1/avgPrice) - N × avgPrice) / (N × avgPrice) ... but we use (wins - expectedWins) as proxy
                  // Better: total payout = wins × $1, total cost = Σ prices ≈ expectedWins, ROI = (payout - cost) / cost
                  const totalCost = Number(item.expectedWins); // sum of prices = expected wins
                  const roi = totalCost > 0 ? ((item.wins - totalCost) / totalCost) * 100 : 0;
                  const az = Number(item.alphaz);
                  const isTop = item.isFollowable;

                  return (
                    <tr key={item.wallet} className={`border-b border-gray-800/50 hover:bg-gray-800/30 transition-colors ${isTop ? "bg-green-950/10" : ""}`}>
                      <td className="py-1.5 px-2.5 text-gray-600">{i + 1}</td>
                      <td className="py-1.5 px-2.5 font-mono">
                        <Link href={`/wallet/${item.wallet}`} className="text-blue-400 hover:underline">
                          {item.wallet.slice(0, 6)}…{item.wallet.slice(-4)}
                        </Link>
                        {isTop && <span className="ml-1 text-green-400 text-[10px]" title="Followable">✓</span>}
                      </td>
                      <td className="py-1.5 px-2.5 text-right font-bold text-blue-400">{Number(item.followScore).toFixed(1)}</td>
                      <td className="py-1.5 px-2.5 text-right text-gray-400">
                        <span className="text-gray-200">{item.n}</span>/<span className={item.wins > 0 ? "text-green-400 font-semibold" : ""}>{item.wins}</span>
                      </td>
                      <td className={`py-1.5 px-2.5 text-right font-semibold ${winRate > expectedRate ? "text-green-400" : winRate > 0 ? "text-yellow-400" : "text-gray-500"}`}>
                        {winRate.toFixed(1)}%
                      </td>
                      <td className="py-1.5 px-2.5 text-right text-gray-600">{expectedRate.toFixed(1)}%</td>
                      <td className={`py-1.5 px-2.5 text-right font-bold ${az > 2 ? "text-green-400" : az > 0 ? "text-green-400/70" : az > -1 ? "text-gray-400" : "text-red-400"}`}>
                        {az.toFixed(1)}
                      </td>
                      <td className={`py-1.5 px-2.5 text-right font-semibold ${roi > 0 ? "text-green-400" : roi < -50 ? "text-red-400/60" : "text-gray-500"}`}>
                        {roi > 0 ? "+" : ""}{roi.toFixed(0)}%
                      </td>
                      <td className="py-1.5 px-2.5 text-right text-gray-600">
                        {(Number(item.hedgeRate) * 100).toFixed(0)}/{(Number(item.lateSnipingRate) * 100).toFixed(0)}
                      </td>
                      <td className="py-1.5 px-2.5 text-gray-600" title={item.lastTradeAt ? new Date(item.lastTradeAt).toLocaleString() : ""}>
                        {item.lastTradeAt ? daysAgo(item.lastTradeAt) : "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Quick legend */}
        {!loading && items.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[10px] text-gray-600">
            <span><strong className="text-gray-400">N/W</strong> = Trade/Vittorie</span>
            <span><strong className="text-gray-400">Win%</strong> = % vittorie reali</span>
            <span><strong className="text-gray-400">E[W%]</strong> = % vittorie attese</span>
            <span><strong className="text-gray-400">αZ</strong> = Alpha Z-score</span>
            <span><strong className="text-gray-400">ROI</strong> = Rendimento simulato</span>
            <span><strong className="text-gray-400">H/L%</strong> = Hedge/Late rate</span>
          </div>
        )}
      </main>
    </div>
  );
}
