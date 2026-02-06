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
      .then((j) => { if (j.ok) setHealth(j); })
      .catch(() => {});
  }, []);

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100">
      <Navbar />
      <main className="max-w-7xl mx-auto px-6 py-6">
        {/* Page description */}
        <div className="mb-6">
          <h2 className="text-xl font-bold mb-1">Leaderboard</h2>
          <p className="text-sm text-gray-400 leading-relaxed">
            Classifica dei wallet che piazzano scommesse a bassa probabilità su Polymarket
            e vincono più spesso del previsto. Il sistema analizza migliaia di trade e identifica
            chi ha un vantaggio statistico reale.
          </p>
          <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-gray-500">
            <div className="bg-gray-900/60 rounded p-2.5">
              <strong className="text-gray-300">Follow Score</strong> — Punteggio composito che combina
              Alpha-Z, numero di trade, basso hedge rate e bassa late-sniping rate.
              Più alto = wallet più affidabile da seguire.
            </div>
            <div className="bg-gray-900/60 rounded p-2.5">
              <strong className="text-gray-300">Alpha-Z</strong> — Deviazione standard delle vittorie
              rispetto al valore atteso. Un valore &gt; 2 indica che il wallet vince
              significativamente più del caso.
            </div>
            <div className="bg-gray-900/60 rounded p-2.5">
              <strong className="text-gray-300">Hedge%</strong> — Percentuale di mercati dove il wallet
              scommette su entrambi i lati (copre il rischio). Un valore basso è migliore.
            </div>
            <div className="bg-gray-900/60 rounded p-2.5">
              <strong className="text-gray-300">Late%</strong> — Percentuale di trade piazzati nell&apos;ultimo
              giorno prima della chiusura (sniping). Un valore basso è migliore.
            </div>
          </div>
        </div>

        {/* Health summary */}
        {health && (
          <div className="flex flex-wrap gap-3 mb-5">
            {[
              { label: "Markets", value: health.counts.markets },
              { label: "Resolutions", value: health.counts.resolutions },
              { label: "Trades", value: health.counts.trades.toLocaleString() },
              { label: "Backlog", value: health.backlog.pending },
            ].map((s) => (
              <span key={s.label} className="bg-gray-900 rounded-md px-3 py-1.5 text-xs text-gray-400">
                {s.label}: <strong className="text-gray-200">{s.value}</strong>
              </span>
            ))}
            {health.lastComputeAt && (
              <span className="bg-gray-900 rounded-md px-3 py-1.5 text-xs text-gray-400">
                Ultimo compute: <strong className="text-gray-200">{new Date(health.lastComputeAt).toLocaleString()}</strong>
              </span>
            )}
          </div>
        )}

        {/* Filters */}
        <div className="mb-5 bg-gray-900/50 rounded-lg p-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <label className="flex flex-col text-sm">
              <span className="text-gray-400 mb-1">Soglia prezzo</span>
              <select className="bg-gray-800 rounded px-3 py-1.5 text-sm" value={threshold} onChange={(e) => setThreshold(e.target.value)}>
                <option value="0.05">≤ 0.05 (5%)</option>
                <option value="0.02">≤ 0.02 (2%)</option>
                <option value="0.01">≤ 0.01 (1%)</option>
              </select>
              <span className="text-[10px] text-gray-600 mt-1">Considera solo trade sotto questa probabilità implicita</span>
            </label>
            <label className="flex flex-col text-sm">
              <span className="text-gray-400 mb-1">Trade minimi</span>
              <input className="bg-gray-800 rounded px-3 py-1.5 w-full text-sm" type="number" min="1" value={minN} onChange={(e) => setMinN(e.target.value)} />
              <span className="text-[10px] text-gray-600 mt-1">Quanti trade low-prob servono per entrare in classifica</span>
            </label>
            <label className="flex flex-col text-sm">
              <span className="text-gray-400 mb-1">Ordina per</span>
              <select className="bg-gray-800 rounded px-3 py-1.5 text-sm" value={sort} onChange={(e) => setSort(e.target.value)}>
                <option value="followScore">Follow Score</option>
                <option value="alphaz">Alpha Z</option>
                <option value="wins">Vittorie</option>
                <option value="n">N° trade</option>
              </select>
              <span className="text-[10px] text-gray-600 mt-1">Metrica usata per ordinare la classifica</span>
            </label>
            <label className="flex flex-col text-sm justify-between">
              <span className="text-gray-400 mb-1">Filtro qualità</span>
              <div className="flex items-center gap-2 bg-gray-800 rounded px-3 py-1.5">
                <input type="checkbox" className="accent-blue-500" checked={onlyFollowable} onChange={(e) => setOnlyFollowable(e.target.checked)} />
                <span className="text-gray-300 text-sm">Solo Followable</span>
              </div>
              <span className="text-[10px] text-gray-600 mt-1">Mostra solo wallet con N≥20, AlphaZ&gt;0, Hedge≤25%</span>
            </label>
          </div>
        </div>

        {updatedAt && (
          <p className="text-xs text-gray-600 mb-3">
            Ultimo aggiornamento: {new Date(updatedAt).toLocaleString()} — {items.length} risultati
          </p>
        )}

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
            <p className="text-gray-600 text-xs mt-1">Prova ad abbassare il valore di &quot;Min N&quot; o vai al pannello admin per eseguire sync + compute.</p>
          </div>
        ) : (
          <div className="overflow-auto rounded-lg border border-gray-800">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-left text-gray-400 bg-gray-900/80 border-b border-gray-800">
                  <th className="py-2.5 px-3">#</th>
                  <th className="py-2.5 px-3">Wallet</th>
                  <th className="py-2.5 px-3 text-right">Follow Score</th>
                  <th className="py-2.5 px-3 text-center">Followable</th>
                  <th className="py-2.5 px-3 text-right">N</th>
                  <th className="py-2.5 px-3 text-right">Wins</th>
                  <th className="py-2.5 px-3 text-right">E[Wins]</th>
                  <th className="py-2.5 px-3 text-right">AlphaZ</th>
                  <th className="py-2.5 px-3 text-right">Hedge%</th>
                  <th className="py-2.5 px-3 text-right">Late%</th>
                  <th className="py-2.5 px-3">Last Trade</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item, i) => (
                  <tr key={item.wallet} className="border-b border-gray-800/50 hover:bg-gray-800/30 transition-colors">
                    <td className="py-2 px-3 text-gray-600">{i + 1}</td>
                    <td className="py-2 px-3 font-mono">
                      <Link href={`/wallet/${item.wallet}`} className="text-blue-400 hover:underline">
                        {item.wallet.slice(0, 6)}...{item.wallet.slice(-4)}
                      </Link>
                    </td>
                    <td className="py-2 px-3 text-right font-semibold text-blue-400">{Number(item.followScore).toFixed(1)}</td>
                    <td className="py-2 px-3 text-center">
                      {item.isFollowable ? <span className="text-green-400 font-medium">✓</span> : <span className="text-gray-600">—</span>}
                    </td>
                    <td className="py-2 px-3 text-right">{item.n}</td>
                    <td className="py-2 px-3 text-right">{item.wins}</td>
                    <td className="py-2 px-3 text-right text-gray-500">{Number(item.expectedWins).toFixed(2)}</td>
                    <td className={`py-2 px-3 text-right font-medium ${Number(item.alphaz) > 0 ? 'text-green-400' : Number(item.alphaz) < -1 ? 'text-red-400' : ''}`}>{Number(item.alphaz).toFixed(2)}</td>
                    <td className="py-2 px-3 text-right">{(Number(item.hedgeRate) * 100).toFixed(1)}%</td>
                    <td className="py-2 px-3 text-right">{(Number(item.lateSnipingRate) * 100).toFixed(1)}%</td>
                    <td className="py-2 px-3 text-gray-500">{item.lastTradeAt ? new Date(item.lastTradeAt).toLocaleDateString() : "—"}</td>
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
