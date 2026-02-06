"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import Navbar from "@/components/Navbar";

interface Profile {
  followScore: number;
  isFollowable: boolean;
  n02: number;
  alphaz02: number;
  hedgeRate: number;
  lateSnipingRate: number;
  lastTradeAt: string | null;
}

interface StatRow {
  threshold: number;
  n: number;
  wins: number;
  expectedWins: number;
  variance: number;
  alphaz: number;
}

interface UpsetWin {
  conditionId: string;
  ts: string;
  price: number;
  size: number;
  outcomeIndex: number;
  question: string;
}

interface RecentBet {
  conditionId: string;
  ts: string;
  price: number;
  size: number;
  outcomeIndex: number;
  question: string | null;
  slug: string | null;
  closed: boolean | null;
}

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
  currentPrice: number | null;
}

interface WalletData {
  ok: boolean;
  wallet: string;
  profile: Profile | null;
  stats: StatRow[];
  upsetWins: UpsetWin[];
  recentBets: RecentBet[];
  threshold: number;
  message?: string;
}

export default function WalletPage() {
  const params = useParams();
  const address = (params.address as string) ?? "";

  const [data, setData] = useState<WalletData | null>(null);
  const [positions, setPositions] = useState<Position[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [threshold, setThreshold] = useState("0.02");

  useEffect(() => {
    if (!address) return;
    setLoading(true);
    setError(null);
    fetch(`/api/wallet/${encodeURIComponent(address)}?threshold=${threshold}`)
      .then((r) => r.json())
      .then((json) => {
        if (!json.ok && json.error) throw new Error(json.error);
        setData(json as WalletData);
      })
      .catch((err) => setError(err instanceof Error ? err.message : String(err)))
      .finally(() => setLoading(false));
  }, [address, threshold]);

  useEffect(() => {
    if (!address) return;
    fetch(`/api/positions?wallet=${encodeURIComponent(address)}&onlyFollowable=false&limit=100`)
      .then((r) => r.json())
      .then((json) => {
        if (json.ok) setPositions(json.positions ?? []);
      })
      .catch(() => {});
  }, [address]);

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100">
      <Navbar />
      <main className="max-w-5xl mx-auto px-6 py-6">
        <div className="mb-6">
          <h2 className="text-xl font-bold mb-1">Dettaglio Wallet</h2>
          <p className="text-sm text-gray-400 leading-relaxed">
            Analisi completa di un singolo wallet. Vedi il profilo (Follow Score, se è followable),
            le statistiche per ogni soglia di probabilità, le vittorie improbabili più significative,
            le posizioni ancora aperte e le scommesse recenti a bassa probabilità.
          </p>
          <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-gray-500">
            <div className="bg-gray-900/60 rounded p-2.5">
              <strong className="text-gray-300">Profilo</strong> — Mostra se il wallet è &quot;followable&quot;
              (cioè ha un buon Alpha-Z, abbastanza trade, basso hedge e bassa late-sniping rate).
            </div>
            <div className="bg-gray-900/60 rounded p-2.5">
              <strong className="text-gray-300">Upset Wins</strong> — Vittorie su mercati dove il wallet
              ha scommesso a probabilità molto bassa e ha vinto. Sono la prova del vantaggio informativo.
            </div>
            <div className="bg-gray-900/60 rounded p-2.5">
              <strong className="text-gray-300">Posizioni aperte</strong> — Mercati dove il wallet ha
              ancora shares. Mostra il prezzo corrente per valutare il P&amp;L potenziale.
            </div>
            <div className="bg-gray-900/60 rounded p-2.5">
              <strong className="text-gray-300">Scommesse recenti</strong> — Ultimi 7 giorni di trade
              BUY a probabilità ≤ 5%, inclusi quelli non ancora risolti.
            </div>
          </div>
          <p className="text-xs font-mono text-gray-500 break-all bg-gray-900 rounded px-3 py-2 mt-3">
            {address}
          </p>
        </div>

        {loading && <p className="text-gray-500 text-sm mt-4">Loading...</p>}

        {error && (
          <div className="bg-red-950 border border-red-800 text-red-300 rounded p-3 text-sm mt-4">
            {error}
          </div>
        )}

        {data && !loading && (
          <>
            {/* Profile cards */}
            {data.profile ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3 mt-4">
                <Card
                  label="Follow Score"
                  value={Number(data.profile.followScore).toFixed(1)}
                  highlight
                />
                <Card
                  label="Followable"
                  value={data.profile.isFollowable ? "YES" : "NO"}
                  color={data.profile.isFollowable ? "text-green-400" : "text-gray-500"}
                />
                <Card label="N (0.02)" value={String(data.profile.n02)} />
                <Card
                  label="AlphaZ (0.02)"
                  value={Number(data.profile.alphaz02).toFixed(2)}
                />
                <Card
                  label="Hedge Rate"
                  value={`${(Number(data.profile.hedgeRate) * 100).toFixed(1)}%`}
                />
                <Card
                  label="Late Snipe"
                  value={`${(Number(data.profile.lateSnipingRate) * 100).toFixed(1)}%`}
                />
              </div>
            ) : (
              <p className="text-gray-500 text-sm mt-4">
                {data.message ?? "No profile data available."}
              </p>
            )}

            {/* Stats per threshold */}
            {data.stats.length > 0 && (
              <section className="mt-8">
                <h3 className="text-sm font-semibold text-gray-400 mb-2">
                  Stats per Threshold
                </h3>
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-left text-gray-500 border-b border-gray-800">
                      <th className="py-2 px-2">Threshold</th>
                      <th className="py-2 px-2 text-right">N</th>
                      <th className="py-2 px-2 text-right">Wins</th>
                      <th className="py-2 px-2 text-right">Expected</th>
                      <th className="py-2 px-2 text-right">Variance</th>
                      <th className="py-2 px-2 text-right">AlphaZ</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.stats.map((s) => (
                      <tr
                        key={s.threshold}
                        className="border-b border-gray-800/50"
                      >
                        <td className="py-1.5 px-2">{s.threshold}</td>
                        <td className="py-1.5 px-2 text-right">{s.n}</td>
                        <td className="py-1.5 px-2 text-right">{s.wins}</td>
                        <td className="py-1.5 px-2 text-right">
                          {Number(s.expectedWins).toFixed(2)}
                        </td>
                        <td className="py-1.5 px-2 text-right">
                          {Number(s.variance).toFixed(2)}
                        </td>
                        <td className="py-1.5 px-2 text-right font-semibold">
                          {Number(s.alphaz).toFixed(2)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </section>
            )}

            {/* Upset wins */}
            <section className="mt-8">
              <div className="flex items-center gap-3 mb-2">
                <h3 className="text-sm font-semibold text-gray-400">
                  Upset Wins (price &le; {threshold})
                </h3>
                <select
                  className="bg-gray-800 rounded px-2 py-1 text-xs"
                  value={threshold}
                  onChange={(e) => setThreshold(e.target.value)}
                >
                  <option value="0.05">0.05</option>
                  <option value="0.02">0.02</option>
                  <option value="0.01">0.01</option>
                </select>
              </div>

              {data.upsetWins.length === 0 ? (
                <p className="text-gray-600 text-xs">No upset wins found.</p>
              ) : (
                <div className="overflow-auto max-h-[28rem]">
                  <table className="w-full text-xs">
                    <thead className="sticky top-0 bg-gray-950">
                      <tr className="text-left text-gray-500 border-b border-gray-800">
                        <th className="py-2 px-2">Date</th>
                        <th className="py-2 px-2">Market</th>
                        <th className="py-2 px-2 text-right">Price</th>
                        <th className="py-2 px-2 text-right">Size</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.upsetWins.map((w, i) => (
                        <tr
                          key={`${w.conditionId}-${i}`}
                          className="border-b border-gray-800/50 hover:bg-gray-800/30"
                        >
                          <td className="py-1.5 px-2 text-gray-400 whitespace-nowrap">
                            {new Date(w.ts).toLocaleDateString()}
                          </td>
                          <td className="py-1.5 px-2 max-w-xs truncate">
                            {w.question || w.conditionId.slice(0, 12) + "..."}
                          </td>
                          <td className="py-1.5 px-2 text-right text-green-400">
                            {Number(w.price).toFixed(4)}
                          </td>
                          <td className="py-1.5 px-2 text-right">
                            {Number(w.size).toFixed(2)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

            {/* Open Positions */}
            {positions.length > 0 && (
              <section className="mt-8">
                <h3 className="text-sm font-semibold text-gray-400 mb-2">
                  Open Positions ({positions.length})
                </h3>
                <div className="overflow-auto max-h-[28rem]">
                  <table className="w-full text-xs">
                    <thead className="sticky top-0 bg-gray-950">
                      <tr className="text-left text-gray-500 border-b border-gray-800">
                        <th className="py-2 px-2">Market</th>
                        <th className="py-2 px-2 text-center">Idx</th>
                        <th className="py-2 px-2 text-right">Shares</th>
                        <th className="py-2 px-2 text-right">Cur. Price</th>
                        <th className="py-2 px-2 text-center">Status</th>
                        <th className="py-2 px-2"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {positions.map((p, i) => (
                        <tr
                          key={`pos-${p.conditionId}-${p.outcomeIndex}-${i}`}
                          className="border-b border-gray-800/50 hover:bg-gray-800/30"
                        >
                          <td className="py-1.5 px-2 max-w-xs truncate">
                            {p.question || p.conditionId.slice(0, 12) + "..."}
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
              </section>
            )}

            {/* Recent low-prob bets (including unresolved) */}
            {data.recentBets && data.recentBets.length > 0 && (
              <section className="mt-8">
                <h3 className="text-sm font-semibold text-gray-400 mb-2">
                  Recent Low-Prob Bets (7 days, p &le; 0.05)
                </h3>
                <div className="overflow-auto max-h-[28rem]">
                  <table className="w-full text-xs">
                    <thead className="sticky top-0 bg-gray-950">
                      <tr className="text-left text-gray-500 border-b border-gray-800">
                        <th className="py-2 px-2">Date</th>
                        <th className="py-2 px-2">Market</th>
                        <th className="py-2 px-2 text-right">Price</th>
                        <th className="py-2 px-2 text-right">Size</th>
                        <th className="py-2 px-2 text-center">Status</th>
                        <th className="py-2 px-2"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.recentBets.map((b, i) => (
                        <tr
                          key={`${b.conditionId}-recent-${i}`}
                          className="border-b border-gray-800/50 hover:bg-gray-800/30"
                        >
                          <td className="py-1.5 px-2 text-gray-400 whitespace-nowrap">
                            {new Date(b.ts).toLocaleDateString()}
                          </td>
                          <td className="py-1.5 px-2 max-w-xs truncate">
                            {b.question || b.conditionId.slice(0, 12) + "..."}
                          </td>
                          <td className="py-1.5 px-2 text-right text-green-400">
                            {Number(b.price).toFixed(4)}
                          </td>
                          <td className="py-1.5 px-2 text-right">
                            {Number(b.size).toFixed(2)}
                          </td>
                          <td className="py-1.5 px-2 text-center">
                            {b.closed ? (
                              <span className="text-gray-500">Closed</span>
                            ) : (
                              <span className="text-yellow-400">Open</span>
                            )}
                          </td>
                          <td className="py-1.5 px-2">
                            {b.slug && (
                              <a
                                href={`https://polymarket.com/market/${b.slug}`}
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
              </section>
            )}
          </>
        )}
      </main>
    </div>
  );
}

function Card({
  label,
  value,
  highlight,
  color,
}: {
  label: string;
  value: string;
  highlight?: boolean;
  color?: string;
}) {
  return (
    <div className="bg-gray-900 rounded-lg p-3">
      <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-1">
        {label}
      </p>
      <p
        className={`text-lg font-semibold ${
          color ?? (highlight ? "text-blue-400" : "text-gray-100")
        }`}
      >
        {value}
      </p>
    </div>
  );
}
