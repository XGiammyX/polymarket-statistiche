"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import Navbar from "@/components/Navbar";

interface WalletStat {
  threshold: number;
  n: number;
  wins: number;
  expected_wins: number;
  alphaz: number;
}

interface TopWallet {
  wallet: string;
  followScore: number;
  isFollowable: boolean;
  n: number;
  alphaz: number;
  hedgeRate: number;
  lateRate: number;
  lastTradeAt: string | null;
  stats: WalletStat[];
}

interface Signal {
  wallet: string;
  ts: string;
  conditionId: string;
  price: number;
  size: number;
  outcomeIndex: number;
  question: string | null;
  slug: string | null;
  endDate: string | null;
  closed: boolean | null;
  followScore: number;
  alphaz: number;
  isFollowable: boolean;
  currentPrice: number | null;
  netShares: number | null;
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
  followScore: number;
  alphaz: number;
  isFollowable: boolean;
}

interface ProvenWin {
  wallet: string;
  ts: string;
  conditionId: string;
  price: number;
  size: number;
  outcomeIndex: number;
  question: string | null;
  slug: string | null;
  followScore: number;
  alphaz: number;
  payout: number;
}

interface RecommendationsData {
  topWallets: TopWallet[];
  recentSignals: Signal[];
  openPositions: Position[];
  provenWins: ProvenWin[];
  lastComputeAt: string | null;
  lastSyncAt: string | null;
  lastLiveSyncAt: string | null;
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m fa`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h fa`;
  const days = Math.floor(hrs / 24);
  if (days === 1) return "ieri";
  return `${days}g fa`;
}

function riskLevel(alphaz: number, n: number, hedgeRate: number): { label: string; color: string; bg: string } {
  if (alphaz > 2 && n >= 20 && hedgeRate <= 0.1)
    return { label: "ALTA", color: "text-green-400", bg: "bg-green-500/20 border-green-500/30" };
  if (alphaz > 0 && n >= 10)
    return { label: "MEDIA", color: "text-yellow-400", bg: "bg-yellow-500/20 border-yellow-500/30" };
  return { label: "BASSA", color: "text-gray-400", bg: "bg-gray-500/20 border-gray-500/30" };
}

function potentialReturn(price: number): string {
  if (price <= 0) return "—";
  const ret = (1 / price - 1) * 100;
  return `+${ret.toFixed(0)}%`;
}

export default function RecommendationsPage() {
  const [data, setData] = useState<RecommendationsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<"picks" | "wallets" | "positions" | "proof" | "copyall">("picks");
  const [copied, setCopied] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/recommendations");
      const json = await res.json();
      if (!json.ok) throw new Error(json.error ?? "Unknown error");
      setData(json);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Auto-refresh every 2 minutes
  useEffect(() => {
    const interval = setInterval(fetchData, 120_000);
    return () => clearInterval(interval);
  }, [fetchData]);

  const followableSignals = data?.recentSignals.filter((s) => s.isFollowable) ?? [];
  const allSignals = data?.recentSignals ?? [];
  const bestSignals = followableSignals.length > 0 ? followableSignals : allSignals;

  // Group signals by market for dedup
  const marketSignals = new Map<string, Signal[]>();
  for (const s of bestSignals) {
    const key = s.conditionId + "-" + s.outcomeIndex;
    if (!marketSignals.has(key)) marketSignals.set(key, []);
    marketSignals.get(key)!.push(s);
  }

  // Build "picks" — unique market recommendations sorted by best wallet score
  const picks = Array.from(marketSignals.entries())
    .map(([, signals]) => {
      const best = signals.reduce((a, b) => (a.followScore > b.followScore ? a : b));
      return {
        ...best,
        walletCount: new Set(signals.map((s) => s.wallet)).size,
        totalSize: signals.reduce((sum, s) => sum + Number(s.size), 0),
      };
    })
    .sort((a, b) => {
      // Followable first, then by score
      if (a.isFollowable !== b.isFollowable) return a.isFollowable ? -1 : 1;
      return b.followScore - a.followScore;
    });

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100">
      <Navbar />
      <main className="max-w-7xl mx-auto px-6 py-6">
        {/* Header */}
        <div className="mb-5">
          <div className="flex items-center gap-3 mb-1">
            <h2 className="text-xl font-bold">Consigli</h2>
            <span className="text-[10px] bg-blue-500/20 text-blue-400 px-2 py-0.5 rounded-full font-medium">
              Auto-refresh 2min
            </span>
          </div>
          <p className="text-sm text-gray-500">
            Analisi automatica dei dati: scommesse consigliate, wallet da seguire e alert live.
            Basato su {data?.topWallets.length ?? 0} wallet analizzati e {data?.recentSignals.length ?? 0} segnali recenti.
          </p>
        </div>

        {/* Status bar */}
        {data && (
          <div className="flex flex-wrap gap-2 mb-5">
            {data.lastComputeAt && (
              <span className="bg-gray-900 rounded px-2.5 py-1 text-[10px] text-gray-400">
                Stats: <strong className="text-gray-200">{timeAgo(data.lastComputeAt)}</strong>
              </span>
            )}
            {data.lastSyncAt && (
              <span className="bg-gray-900 rounded px-2.5 py-1 text-[10px] text-gray-400">
                Sync: <strong className="text-gray-200">{timeAgo(data.lastSyncAt)}</strong>
              </span>
            )}
            {data.lastLiveSyncAt && (
              <span className="bg-gray-900 rounded px-2.5 py-1 text-[10px] text-gray-400">
                Live: <strong className="text-gray-200">{timeAgo(data.lastLiveSyncAt)}</strong>
              </span>
            )}
            <span className="bg-green-900/30 text-green-400 rounded px-2.5 py-1 text-[10px] font-medium">
              {picks.filter((p) => p.isFollowable).length} pick da wallet verificati
            </span>
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-1 mb-5 bg-gray-900/50 rounded-lg p-1 w-fit">
          {[
            { key: "picks" as const, label: "Scommesse consigliate", count: picks.length },
            { key: "copyall" as const, label: "Copia tutto", count: picks.filter((p) => p.slug).length },
            { key: "wallets" as const, label: "Wallet da seguire", count: data?.topWallets.length ?? 0 },
            { key: "positions" as const, label: "Posizioni aperte", count: data?.openPositions.length ?? 0 },
            { key: "proof" as const, label: "Vittorie passate", count: data?.provenWins.length ?? 0 },
          ].map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`px-3 py-1.5 rounded-md text-xs transition-colors ${
                tab === t.key
                  ? "bg-gray-800 text-white font-medium"
                  : "text-gray-400 hover:text-gray-200"
              }`}
            >
              {t.label} <span className="text-gray-600 ml-0.5">({t.count})</span>
            </button>
          ))}
        </div>

        {error && (
          <div className="bg-red-950 border border-red-800 text-red-300 rounded p-3 text-sm mb-4">{error}</div>
        )}

        {loading ? (
          <div className="flex justify-center py-16">
            <div className="animate-pulse text-gray-500 text-sm">Analisi in corso...</div>
          </div>
        ) : (
          <>
            {/* ═══ TAB: PICKS ═══ */}
            {tab === "picks" && (
              <div className="space-y-3">
                {picks.length === 0 ? (
                  <div className="text-center py-16">
                    <p className="text-gray-500 text-sm mb-1">Nessuna scommessa consigliata al momento.</p>
                    <p className="text-gray-600 text-xs">Il sistema cerca trade recenti (14gg) da wallet con vantaggio statistico. I dati si accumulano con il tempo.</p>
                  </div>
                ) : (
                  <>
                    <div className="bg-blue-950/20 border border-blue-800/30 rounded-lg p-3 text-xs text-blue-300 mb-4">
                      Queste sono scommesse a <strong>bassa probabilità</strong> piazzate da wallet con track record positivo.
                      Non sono certezze — sono scommesse dove il rischio/rendimento potrebbe essere a tuo favore.
                      Usa sempre una size piccola (1-2% del bankroll).
                    </div>
                    {picks.map((p, i) => {
                      const risk = riskLevel(Number(p.alphaz), p.walletCount * 10, 0);
                      const isOpen = !p.closed;
                      const hasShares = p.netShares != null && Number(p.netShares) > 0;
                      const priceNow = p.currentPrice != null ? Number(p.currentPrice) : null;
                      const entryPrice = Number(p.price);

                      return (
                        <div key={`${p.conditionId}-${p.outcomeIndex}-${i}`} className={`rounded-lg border p-4 ${p.isFollowable ? "bg-green-950/10 border-green-800/30" : "bg-gray-900/60 border-gray-800"}`}>
                          <div className="flex items-start justify-between gap-3 mb-3">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                <span className={`text-[10px] px-2 py-0.5 rounded-full border font-medium ${risk.bg} ${risk.color}`}>
                                  Fiducia {risk.label}
                                </span>
                                {p.isFollowable && (
                                  <span className="text-[10px] bg-green-500/20 text-green-400 px-2 py-0.5 rounded-full">Wallet verificato ✓</span>
                                )}
                                {hasShares && (
                                  <span className="text-[10px] bg-purple-500/20 text-purple-400 px-2 py-0.5 rounded-full">Posizione ancora aperta</span>
                                )}
                                {isOpen && (
                                  <span className="text-[10px] bg-blue-500/20 text-blue-400 px-2 py-0.5 rounded-full">Mercato aperto</span>
                                )}
                              </div>
                              <h3 className="text-sm font-semibold text-white truncate">
                                {p.question || p.conditionId.slice(0, 20) + "..."}
                              </h3>
                              <p className="text-[10px] text-gray-500 mt-0.5">
                                Outcome #{p.outcomeIndex} — {p.walletCount} wallet{p.walletCount > 1 ? "s" : ""} hanno comprato — {timeAgo(p.ts)}
                              </p>
                            </div>
                            {p.slug && (
                              <div className="flex flex-col gap-1.5 flex-shrink-0">
                                <a
                                  href={`https://polymarket.com/event/${p.slug}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium px-3 py-1.5 rounded-md transition-colors text-center"
                                >
                                  Compra Outcome #{p.outcomeIndex} ↗
                                </a>
                                <span className="text-[9px] text-gray-600 text-center">su Polymarket</span>
                              </div>
                            )}
                          </div>

                          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-xs">
                            <div className="bg-gray-800/50 rounded p-2">
                              <span className="text-gray-500 block">Entry price</span>
                              <span className="text-green-400 font-bold text-sm">${entryPrice.toFixed(4)}</span>
                              <span className="text-gray-600 block text-[10px]">Prob. implicita: {(entryPrice * 100).toFixed(1)}%</span>
                            </div>
                            <div className="bg-gray-800/50 rounded p-2">
                              <span className="text-gray-500 block">Se vince</span>
                              <span className="text-green-400 font-bold text-sm">{potentialReturn(entryPrice)}</span>
                              <span className="text-gray-600 block text-[10px]">${(1 / entryPrice).toFixed(0)} per $1 investito</span>
                            </div>
                            <div className="bg-gray-800/50 rounded p-2">
                              <span className="text-gray-500 block">Prezzo attuale</span>
                              {priceNow != null ? (
                                <>
                                  <span className={`font-bold text-sm ${priceNow > entryPrice ? "text-green-400" : priceNow < entryPrice ? "text-red-400" : "text-yellow-400"}`}>
                                    ${priceNow.toFixed(4)}
                                  </span>
                                  <span className="text-gray-600 block text-[10px]">
                                    {priceNow > entryPrice ? "↑ Salito" : priceNow < entryPrice ? "↓ Sceso" : "= Stabile"} dal trade
                                  </span>
                                </>
                              ) : (
                                <span className="text-gray-600 font-bold text-sm">—</span>
                              )}
                            </div>
                            <div className="bg-gray-800/50 rounded p-2">
                              <span className="text-gray-500 block">Wallet αZ</span>
                              <span className={`font-bold text-sm ${Number(p.alphaz) > 2 ? "text-green-400" : Number(p.alphaz) > 0 ? "text-green-400/70" : "text-gray-400"}`}>
                                {Number(p.alphaz).toFixed(2)}
                              </span>
                              <span className="text-gray-600 block text-[10px]">Score: {Number(p.followScore).toFixed(1)}</span>
                            </div>
                            <div className="bg-gray-800/50 rounded p-2">
                              <span className="text-gray-500 block">Volume totale</span>
                              <span className="text-white font-bold text-sm">${p.totalSize.toFixed(0)}</span>
                              <span className="text-gray-600 block text-[10px]">
                                <Link href={`/wallet/${p.wallet}`} className="text-blue-400 hover:underline">
                                  {p.wallet.slice(0, 6)}…{p.wallet.slice(-4)}
                                </Link>
                              </span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </>
                )}
              </div>
            )}

            {/* ═══ TAB: COPY ALL ═══ */}
            {tab === "copyall" && (
              <div className="space-y-4">
                {picks.filter((p) => p.slug).length === 0 ? (
                  <div className="text-center py-16">
                    <p className="text-gray-500 text-sm">Nessun mercato con link disponibile al momento.</p>
                  </div>
                ) : (
                  <>
                    {/* Quick action bar */}
                    <div className="bg-blue-950/20 border border-blue-800/30 rounded-lg p-4">
                      <div className="flex items-center justify-between mb-3">
                        <div>
                          <h3 className="text-white font-semibold text-sm">Lista scommesse da copiare</h3>
                          <p className="text-gray-400 text-xs mt-0.5">
                            {picks.filter((p) => p.slug).length} mercati — clicca &quot;Copia lista&quot; per avere tutti i link pronti
                          </p>
                        </div>
                        <button
                          onClick={() => {
                            const lines = picks
                              .filter((p) => p.slug)
                              .map((p, i) => {
                                const ret = potentialReturn(Number(p.price));
                                return `${i + 1}. ${p.question || "Mercato"}\n   Outcome #${p.outcomeIndex} — Entry: $${Number(p.price).toFixed(4)} — Se vince: ${ret}\n   Wallet αZ: ${Number(p.alphaz).toFixed(2)} — Score: ${Number(p.followScore).toFixed(1)}${p.isFollowable ? " ✓" : ""}\n   Link: https://polymarket.com/event/${p.slug}\n`;
                              });
                            navigator.clipboard.writeText(lines.join("\n")).then(() => {
                              setCopied(true);
                              setTimeout(() => setCopied(false), 3000);
                            });
                          }}
                          className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                            copied
                              ? "bg-green-600 text-white"
                              : "bg-blue-600 hover:bg-blue-500 text-white"
                          }`}
                        >
                          {copied ? "✓ Copiato!" : "Copia lista"}
                        </button>
                      </div>
                      <p className="text-[10px] text-gray-500">
                        La lista include: nome mercato, outcome da comprare, entry price, rendimento potenziale, wallet score e link diretto a Polymarket.
                      </p>
                    </div>

                    {/* Open all links */}
                    <div className="bg-gray-900/60 border border-gray-800 rounded-lg p-4">
                      <div className="flex items-center justify-between mb-3">
                        <div>
                          <h3 className="text-white font-semibold text-sm">Apri tutti i mercati</h3>
                          <p className="text-gray-400 text-xs mt-0.5">
                            Apre ogni mercato in un nuovo tab di Polymarket. Poi compra manualmente l&apos;outcome indicato.
                          </p>
                        </div>
                        <button
                          onClick={() => {
                            picks.filter((p) => p.slug).forEach((p, i) => {
                              setTimeout(() => {
                                window.open(`https://polymarket.com/event/${p.slug}`, `_blank_${i}`);
                              }, i * 300);
                            });
                          }}
                          className="px-4 py-2 rounded-md text-sm font-medium bg-purple-600 hover:bg-purple-500 text-white transition-colors"
                        >
                          Apri tutti ({picks.filter((p) => p.slug).length}) ↗
                        </button>
                      </div>
                      <p className="text-[10px] text-yellow-400/60">
                        Il browser potrebbe bloccare i popup. Consenti i popup per questo sito se necessario.
                      </p>
                    </div>

                    {/* Individual cards with direct links */}
                    <h3 className="text-white font-semibold text-sm mt-2">Dettaglio per mercato</h3>
                    {picks.filter((p) => p.slug).map((p, i) => {
                      const entryPrice = Number(p.price);
                      const ret = potentialReturn(entryPrice);

                      return (
                        <div key={`copy-${p.conditionId}-${p.outcomeIndex}-${i}`} className={`rounded-lg border p-3 ${p.isFollowable ? "bg-green-950/10 border-green-800/30" : "bg-gray-900/60 border-gray-800"}`}>
                          <div className="flex items-center justify-between gap-3">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                <span className="text-white font-bold text-sm">{i + 1}.</span>
                                <h4 className="text-sm text-white font-medium truncate">{p.question || "Mercato"}</h4>
                                {p.isFollowable && <span className="text-green-400 text-[10px]">✓</span>}
                              </div>
                              <div className="flex flex-wrap items-center gap-3 text-xs text-gray-400">
                                <span>
                                  Compra <strong className="text-yellow-400">Outcome #{p.outcomeIndex}</strong>
                                </span>
                                <span>
                                  Entry: <strong className="text-green-400">${entryPrice.toFixed(4)}</strong>
                                </span>
                                <span>
                                  Se vince: <strong className="text-green-400">{ret}</strong>
                                </span>
                                <span>
                                  αZ: <strong className={Number(p.alphaz) > 0 ? "text-green-400" : "text-gray-500"}>{Number(p.alphaz).toFixed(1)}</strong>
                                </span>
                                <span className="text-gray-600">
                                  {p.walletCount} wallet · {timeAgo(p.ts)}
                                </span>
                              </div>
                            </div>
                            <a
                              href={`https://polymarket.com/event/${p.slug}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex-shrink-0 bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium px-3 py-2 rounded-md transition-colors"
                            >
                              Compra ↗
                            </a>
                          </div>
                        </div>
                      );
                    })}
                  </>
                )}
              </div>
            )}

            {/* ═══ TAB: WALLETS ═══ */}
            {tab === "wallets" && (
              <div className="space-y-3">
                {(data?.topWallets ?? []).length === 0 ? (
                  <div className="text-center py-16">
                    <p className="text-gray-500 text-sm">Nessun wallet analizzato ancora. Esegui sync + compute.</p>
                  </div>
                ) : (
                  <>
                    <div className="bg-gray-900/40 border border-gray-800 rounded-lg p-3 text-xs text-gray-400 mb-4">
                      Wallet ordinati per Follow Score. I wallet con ✓ soddisfano tutti i criteri di affidabilità.
                      Clicca su un wallet per vedere il dettaglio completo e i trade recenti.
                    </div>
                    {(data?.topWallets ?? []).map((w) => {
                      const risk = riskLevel(Number(w.alphaz), w.n, Number(w.hedgeRate));
                      const winRate = w.stats?.find((s: WalletStat) => s.threshold === 0.02);
                      const wr = winRate && winRate.n > 0 ? (winRate.wins / winRate.n * 100) : 0;
                      const ewr = winRate && winRate.n > 0 ? (Number(winRate.expected_wins) / winRate.n * 100) : 0;

                      return (
                        <div key={w.wallet} className={`rounded-lg border p-4 ${w.isFollowable ? "bg-green-950/10 border-green-800/30" : "bg-gray-900/60 border-gray-800"}`}>
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                              <Link href={`/wallet/${w.wallet}`} className="font-mono text-blue-400 hover:underline text-sm">
                                {w.wallet.slice(0, 8)}…{w.wallet.slice(-6)}
                              </Link>
                              {w.isFollowable && <span className="text-green-400 text-xs font-medium">✓ Followable</span>}
                              <span className={`text-[10px] px-2 py-0.5 rounded-full border font-medium ${risk.bg} ${risk.color}`}>
                                {risk.label}
                              </span>
                            </div>
                            <span className="text-blue-400 font-bold">{Number(w.followScore).toFixed(1)}</span>
                          </div>
                          <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 text-xs">
                            <div>
                              <span className="text-gray-500 block">Trade</span>
                              <span className="text-white font-semibold">{w.n}</span>
                            </div>
                            <div>
                              <span className="text-gray-500 block">Win%</span>
                              <span className={`font-semibold ${wr > ewr ? "text-green-400" : "text-gray-400"}`}>{wr.toFixed(1)}%</span>
                            </div>
                            <div>
                              <span className="text-gray-500 block">αZ</span>
                              <span className={`font-semibold ${Number(w.alphaz) > 0 ? "text-green-400" : "text-red-400"}`}>{Number(w.alphaz).toFixed(2)}</span>
                            </div>
                            <div>
                              <span className="text-gray-500 block">Hedge</span>
                              <span className={`font-semibold ${Number(w.hedgeRate) <= 0.1 ? "text-green-400" : "text-yellow-400"}`}>{(Number(w.hedgeRate) * 100).toFixed(0)}%</span>
                            </div>
                            <div>
                              <span className="text-gray-500 block">Late</span>
                              <span className="text-gray-300 font-semibold">{(Number(w.lateRate) * 100).toFixed(0)}%</span>
                            </div>
                            <div>
                              <span className="text-gray-500 block">Ultimo</span>
                              <span className="text-gray-300">{w.lastTradeAt ? timeAgo(w.lastTradeAt) : "—"}</span>
                            </div>
                          </div>
                          {/* Multi-threshold stats */}
                          {w.stats && w.stats.length > 0 && (
                            <div className="mt-2 flex gap-2">
                              {w.stats.map((s: WalletStat) => (
                                <span key={s.threshold} className={`text-[10px] px-2 py-0.5 rounded ${Number(s.alphaz) > 0 ? "bg-green-900/30 text-green-400" : "bg-gray-800 text-gray-500"}`}>
                                  @{s.threshold}: {s.wins}/{s.n} wins (αZ {Number(s.alphaz).toFixed(1)})
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </>
                )}
              </div>
            )}

            {/* ═══ TAB: POSITIONS ═══ */}
            {tab === "positions" && (
              <div className="space-y-3">
                {(data?.openPositions ?? []).length === 0 ? (
                  <div className="text-center py-16">
                    <p className="text-gray-500 text-sm">Nessuna posizione aperta trovata.</p>
                    <p className="text-gray-600 text-xs mt-1">Serve sync-live per tracciare le posizioni dei wallet.</p>
                  </div>
                ) : (
                  <>
                    <div className="bg-purple-950/20 border border-purple-800/30 rounded-lg p-3 text-xs text-purple-300 mb-4">
                      I wallet migliori hanno ancora queste posizioni aperte. Se non hanno venduto, credono ancora nell&apos;esito.
                    </div>
                    <div className="overflow-auto rounded-lg border border-gray-800">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="text-left text-gray-400 bg-gray-900/80 border-b border-gray-800">
                            <th className="py-2 px-3">Wallet</th>
                            <th className="py-2 px-3">Mercato</th>
                            <th className="py-2 px-3 text-center">Outcome</th>
                            <th className="py-2 px-3 text-right">Shares</th>
                            <th className="py-2 px-3 text-right">Score</th>
                            <th className="py-2 px-3"></th>
                          </tr>
                        </thead>
                        <tbody>
                          {(data?.openPositions ?? []).map((p, i) => (
                            <tr key={`${p.wallet}-${p.conditionId}-${i}`} className={`border-b border-gray-800/50 hover:bg-gray-800/30 ${p.isFollowable ? "bg-green-950/5" : ""}`}>
                              <td className="py-2 px-3 font-mono">
                                <Link href={`/wallet/${p.wallet}`} className="text-blue-400 hover:underline">
                                  {p.wallet.slice(0, 6)}…{p.wallet.slice(-4)}
                                </Link>
                                {p.isFollowable && <span className="ml-1 text-green-400 text-[10px]">✓</span>}
                              </td>
                              <td className="py-2 px-3 max-w-xs truncate">{p.question || p.conditionId.slice(0, 20)}</td>
                              <td className="py-2 px-3 text-center">
                                <span className="text-yellow-400 font-medium">#{p.outcomeIndex}</span>
                              </td>
                              <td className="py-2 px-3 text-right font-semibold">{Number(p.netShares).toFixed(1)}</td>
                              <td className="py-2 px-3 text-right text-blue-400 font-semibold">{Number(p.followScore).toFixed(1)}</td>
                              <td className="py-2 px-3">
                                {p.slug && (
                                  <a href={`https://polymarket.com/event/${p.slug}`} target="_blank" rel="noopener noreferrer"
                                    className="text-white hover:bg-blue-500 bg-blue-600 text-[10px] px-2.5 py-1 rounded font-medium">
                                    Compra #{p.outcomeIndex} ↗
                                  </a>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </>
                )}
              </div>
            )}

            {/* ═══ TAB: PROOF ═══ */}
            {tab === "proof" && (
              <div className="space-y-3">
                {(data?.provenWins ?? []).length === 0 ? (
                  <div className="text-center py-16">
                    <p className="text-gray-500 text-sm">Nessuna vittoria registrata ancora.</p>
                    <p className="text-gray-600 text-xs mt-1">Serve più tempo e più mercati risolti per vedere le vittorie.</p>
                  </div>
                ) : (
                  <>
                    <div className="bg-green-950/20 border border-green-800/30 rounded-lg p-3 text-xs text-green-300 mb-4">
                      Queste sono vittorie reali: trade a bassa probabilità che hanno effettivamente vinto.
                      Dimostrano che questi wallet hanno un vantaggio informativo.
                    </div>
                    {(data?.provenWins ?? []).map((w, i) => (
                      <div key={`${w.conditionId}-${w.wallet}-${i}`} className="bg-green-950/10 border border-green-800/30 rounded-lg p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            <h3 className="text-sm font-semibold text-white truncate">{w.question || w.conditionId.slice(0, 30)}</h3>
                            <p className="text-[10px] text-gray-500 mt-0.5">
                              <Link href={`/wallet/${w.wallet}`} className="text-blue-400 hover:underline font-mono">
                                {w.wallet.slice(0, 6)}…{w.wallet.slice(-4)}
                              </Link>
                              {" "}— {timeAgo(w.ts)} — αZ {Number(w.alphaz).toFixed(1)}
                            </p>
                          </div>
                          <div className="text-right flex-shrink-0">
                            <div className="text-green-400 font-bold text-lg">+{((1 / Number(w.price) - 1) * 100).toFixed(0)}%</div>
                            <div className="text-[10px] text-gray-500">Entry: ${Number(w.price).toFixed(4)}</div>
                          </div>
                        </div>
                        <div className="mt-2 flex items-center gap-3 text-[10px] text-gray-500">
                          <span>Size: ${Number(w.size).toFixed(0)}</span>
                          <span>Payout: <strong className="text-green-400">${w.payout.toFixed(0)}</strong></span>
                          {w.slug && (
                            <a href={`https://polymarket.com/market/${w.slug}`} target="_blank" rel="noopener noreferrer"
                              className="text-blue-500 hover:underline bg-blue-500/10 px-2 py-0.5 rounded">
                              Polymarket ↗
                            </a>
                          )}
                        </div>
                      </div>
                    ))}
                  </>
                )}
              </div>
            )}
          </>
        )}

        {/* Disclaimer */}
        <div className="mt-8 bg-yellow-950/20 border border-yellow-800/30 rounded-lg p-4 text-xs text-yellow-300/70">
          <strong className="text-yellow-400">Disclaimer:</strong> Questi consigli sono basati su analisi statistica di dati storici.
          Le performance passate non garantiscono risultati futuri. Non è un consiglio finanziario.
          Le scommesse a bassa probabilità hanno un alto rischio di perdita totale.
          Usa sempre una size piccola e diversifica.{" "}
          <Link href="/docs#limiti" className="text-blue-400 hover:underline">Leggi i limiti →</Link>
        </div>
      </main>
    </div>
  );
}
