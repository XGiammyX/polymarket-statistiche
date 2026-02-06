"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import Navbar from "@/components/Navbar";

/* ═══ Types from /api/smart-picks ═══ */

interface WalletStat { threshold: number; n: number; wins: number; expected_wins: number; alphaz: number; }

interface SmartWallet {
  wallet: string;
  followScore: number;
  isFollowable: boolean;
  n: number;
  alphaz: number;
  hedgeRate: number;
  lateRate: number;
  lastTradeAt: string | null;
  positiveThresholds: number;
  totalThresholds: number;
  maxN: number;
  stats: WalletStat[];
}

interface TradeEntry {
  wallet: string;
  ts: string;
  price: number;
  size: number;
  followScore: number;
  alphaz: number;
  isFollowable: boolean;
  positiveThresholds: number;
}

interface Pick {
  conditionId: string;
  outcomeIndex: number;
  question: string;
  slug: string;
  endDate: string | null;
  outcomeName: string;
  trades: TradeEntry[];
  walletCount: number;
  followableCount: number;
  avgAlphaZ: number;
  maxAlphaZ: number;
  bestFollowScore: number;
  avgEntryPrice: number;
  totalVolume: number;
  latestTrade: string;
  convergenceScore: number;
  expectedValue: number;
  confidence: "ALTA" | "MEDIA" | "BASSA";
  suggestedSizePercent: number;
  potentialReturn: number;
}

interface ExitAlert {
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
}

interface Portfolio {
  totalPicks: number;
  highConfidence: number;
  mediumConfidence: number;
  lowConfidence: number;
  totalSuggestedAllocation: number;
  uniqueMarkets: number;
  avgPotentialReturn: number;
  avgExpectedValue: number;
}

interface SmartPicksData {
  smartWallets: SmartWallet[];
  picks: Pick[];
  exitAlerts: ExitAlert[];
  portfolio: Portfolio;
  lastComputeAt: string | null;
  lastSyncAt: string | null;
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

const confColor = {
  ALTA: { text: "text-green-400", bg: "bg-green-500/20 border-green-500/30" },
  MEDIA: { text: "text-yellow-400", bg: "bg-yellow-500/20 border-yellow-500/30" },
  BASSA: { text: "text-gray-400", bg: "bg-gray-500/20 border-gray-500/30" },
};

export default function RecommendationsPage() {
  const [data, setData] = useState<SmartPicksData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<"dashboard" | "picks" | "wallets" | "exits">("dashboard");
  const [copied, setCopied] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/smart-picks");
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
  useEffect(() => {
    const interval = setInterval(fetchData, 120_000);
    return () => clearInterval(interval);
  }, [fetchData]);

  const picks = data?.picks ?? [];
  const wallets = data?.smartWallets ?? [];
  const exits = data?.exitAlerts ?? [];
  const portfolio = data?.portfolio;

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100">
      <Navbar />
      <main className="max-w-7xl mx-auto px-6 py-6">
        {/* Header */}
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <h2 className="text-xl font-bold">Smart Picks</h2>
              <span className="text-[10px] bg-blue-500/20 text-blue-400 px-2 py-0.5 rounded-full font-medium">Auto-refresh 2min</span>
              {exits.length > 0 && (
                <button onClick={() => setTab("exits")} className="text-[10px] bg-red-500/20 text-red-400 px-2 py-0.5 rounded-full font-medium animate-pulse">
                  {exits.length} alert uscita
                </button>
              )}
            </div>
            <p className="text-sm text-gray-500">
              Analisi automatica: il sistema seleziona wallet con edge robusto, trova le loro scommesse su mercati aperti,
              calcola convergenza e EV, e suggerisce come allocare il bankroll.
            </p>
          </div>
          {data?.lastSyncAt && (
            <span className="text-[10px] text-gray-600 flex-shrink-0 mt-1">
              Sync: {timeAgo(data.lastSyncAt)}
            </span>
          )}
        </div>

        {/* ═══ PORTFOLIO SUMMARY ═══ */}
        {portfolio && !loading && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
            <div className="bg-gray-900/60 rounded-lg p-3 border border-gray-800">
              <span className="text-gray-500 text-[10px] block">Pick totali</span>
              <span className="text-white font-bold text-lg">{portfolio.totalPicks}</span>
              <div className="flex gap-1.5 mt-1">
                {portfolio.highConfidence > 0 && <span className="text-[9px] bg-green-500/20 text-green-400 px-1.5 py-0.5 rounded">{portfolio.highConfidence} ALTA</span>}
                {portfolio.mediumConfidence > 0 && <span className="text-[9px] bg-yellow-500/20 text-yellow-400 px-1.5 py-0.5 rounded">{portfolio.mediumConfidence} MEDIA</span>}
                {portfolio.lowConfidence > 0 && <span className="text-[9px] bg-gray-500/20 text-gray-400 px-1.5 py-0.5 rounded">{portfolio.lowConfidence} BASSA</span>}
              </div>
            </div>
            <div className="bg-gray-900/60 rounded-lg p-3 border border-gray-800">
              <span className="text-gray-500 text-[10px] block">Wallet con edge</span>
              <span className="text-white font-bold text-lg">{wallets.length}</span>
              <span className="text-[9px] text-gray-500 block mt-1">αZ&gt;0 a più soglie, Hedge≤25%</span>
            </div>
            <div className="bg-gray-900/60 rounded-lg p-3 border border-gray-800">
              <span className="text-gray-500 text-[10px] block">Bankroll suggerito</span>
              <span className="text-blue-400 font-bold text-lg">{portfolio.totalSuggestedAllocation.toFixed(1)}%</span>
              <span className="text-[9px] text-gray-500 block mt-1">su {portfolio.uniqueMarkets} mercati diversi</span>
            </div>
            <div className="bg-gray-900/60 rounded-lg p-3 border border-gray-800">
              <span className="text-gray-500 text-[10px] block">Rendimento medio</span>
              <span className="text-green-400 font-bold text-lg">+{portfolio.avgPotentialReturn.toFixed(0)}%</span>
              <span className="text-[9px] text-gray-500 block mt-1">EV medio: {portfolio.avgExpectedValue > 0 ? "+" : ""}{(portfolio.avgExpectedValue * 100).toFixed(1)}¢</span>
            </div>
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-1 mb-5 bg-gray-900/50 rounded-lg p-1 w-fit">
          {[
            { key: "dashboard" as const, label: "Dashboard", count: picks.length },
            { key: "picks" as const, label: "Copia scommesse", count: picks.filter((p) => p.slug).length },
            { key: "wallets" as const, label: "Wallet smart", count: wallets.length },
            { key: "exits" as const, label: `Alert uscita${exits.length > 0 ? " ⚠" : ""}`, count: exits.length },
          ].map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`px-3 py-1.5 rounded-md text-xs transition-colors ${
                tab === t.key ? "bg-gray-800 text-white font-medium" : "text-gray-400 hover:text-gray-200"
              }`}
            >
              {t.label} <span className="text-gray-600 ml-0.5">({t.count})</span>
            </button>
          ))}
        </div>

        {error && <div className="bg-red-950 border border-red-800 text-red-300 rounded p-3 text-sm mb-4">{error}</div>}

        {loading ? (
          <div className="flex justify-center py-16"><div className="animate-pulse text-gray-500 text-sm">Analisi in corso...</div></div>
        ) : (
          <>
            {/* ═══ TAB: DASHBOARD ═══ */}
            {tab === "dashboard" && (
              <div className="space-y-3">
                {picks.length === 0 ? (
                  <div className="text-center py-16">
                    <p className="text-gray-500 text-sm mb-1">Nessuna scommessa trovata su mercati aperti.</p>
                    <p className="text-gray-600 text-xs">Il sistema cerca trade degli ultimi 30gg da wallet con edge robusto su mercati ancora aperti. Serve più sync per accumulare dati.</p>
                  </div>
                ) : (
                  <>
                    <div className="bg-blue-950/20 border border-blue-800/30 rounded-lg p-3 text-xs text-blue-300">
                      <strong>Come funziona:</strong> Il sistema ha filtrato automaticamente i wallet con αZ&gt;0 a più soglie,
                      hedge basso e late basso. Poi ha trovato le loro scommesse su mercati <strong>ancora aperti</strong>.
                      Ogni pick mostra: fiducia, EV, size suggerita e link diretto per comprare.
                    </div>

                    {picks.map((p, i) => {
                      const cc = confColor[p.confidence];
                      return (
                        <div key={`${p.conditionId}-${p.outcomeIndex}-${i}`} className={`rounded-lg border p-4 ${p.confidence === "ALTA" ? "bg-green-950/10 border-green-800/30" : p.confidence === "MEDIA" ? "bg-yellow-950/5 border-yellow-800/20" : "bg-gray-900/60 border-gray-800"}`}>
                          {/* Row 1: badges + title + buy button */}
                          <div className="flex items-start justify-between gap-3 mb-3">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1 flex-wrap">
                                <span className={`text-[10px] px-2 py-0.5 rounded-full border font-bold ${cc.bg} ${cc.text}`}>
                                  {p.confidence}
                                </span>
                                {p.walletCount > 1 && (
                                  <span className="text-[10px] bg-purple-500/20 text-purple-400 px-2 py-0.5 rounded-full font-medium">
                                    {p.walletCount} wallet convergono
                                  </span>
                                )}
                                {p.followableCount > 0 && (
                                  <span className="text-[10px] bg-green-500/20 text-green-400 px-2 py-0.5 rounded-full">
                                    {p.followableCount} verificati ✓
                                  </span>
                                )}
                              </div>
                              <h3 className="text-sm font-semibold text-white">{p.question || p.conditionId.slice(0, 30)}</h3>
                              <p className="text-[10px] text-gray-500 mt-0.5">
                                Compra <strong className="text-yellow-400">{p.outcomeName}</strong> — ultimo trade {timeAgo(p.latestTrade)}
                              </p>
                            </div>
                            {p.slug && (
                              <a
                                href={`https://polymarket.com/event/${p.slug}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex-shrink-0 bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium px-4 py-2 rounded-md transition-colors"
                              >
                                Compra ↗
                              </a>
                            )}
                          </div>

                          {/* Row 2: metrics */}
                          <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 text-xs">
                            <div className="bg-gray-800/50 rounded p-2">
                              <span className="text-gray-500 block text-[10px]">Entry</span>
                              <span className="text-green-400 font-bold">${p.avgEntryPrice.toFixed(3)}</span>
                            </div>
                            <div className="bg-gray-800/50 rounded p-2">
                              <span className="text-gray-500 block text-[10px]">Se vince</span>
                              <span className="text-green-400 font-bold">+{p.potentialReturn.toFixed(0)}%</span>
                            </div>
                            <div className="bg-gray-800/50 rounded p-2">
                              <span className="text-gray-500 block text-[10px]">EV</span>
                              <span className={`font-bold ${p.expectedValue > 0 ? "text-green-400" : "text-red-400"}`}>
                                {p.expectedValue > 0 ? "+" : ""}{(p.expectedValue * 100).toFixed(1)}¢
                              </span>
                            </div>
                            <div className="bg-gray-800/50 rounded p-2">
                              <span className="text-gray-500 block text-[10px]">Best αZ</span>
                              <span className={`font-bold ${p.maxAlphaZ > 2 ? "text-green-400" : p.maxAlphaZ > 0 ? "text-green-400/70" : "text-gray-400"}`}>
                                {p.maxAlphaZ.toFixed(1)}
                              </span>
                            </div>
                            <div className="bg-gray-800/50 rounded p-2">
                              <span className="text-gray-500 block text-[10px]">Volume</span>
                              <span className="text-white font-bold">${p.totalVolume.toFixed(0)}</span>
                            </div>
                            <div className="bg-blue-900/30 rounded p-2 border border-blue-800/30">
                              <span className="text-blue-400 block text-[10px] font-medium">Size suggerita</span>
                              <span className="text-blue-400 font-bold">{p.suggestedSizePercent.toFixed(1)}%</span>
                            </div>
                          </div>

                          {/* Row 3: wallet list */}
                          <div className="mt-2 flex flex-wrap gap-2 text-[10px] text-gray-500">
                            {p.trades.slice(0, 5).map((t, j) => (
                              <Link key={`${t.wallet}-${j}`} href={`/wallet/${t.wallet}`} className="hover:text-blue-400 transition-colors">
                                <span className="font-mono">{t.wallet.slice(0, 6)}…{t.wallet.slice(-4)}</span>
                                <span className="ml-0.5">(αZ {t.alphaz.toFixed(1)}{t.isFollowable ? " ✓" : ""})</span>
                              </Link>
                            ))}
                            {p.trades.length > 5 && <span>+{p.trades.length - 5} altri</span>}
                          </div>
                        </div>
                      );
                    })}
                  </>
                )}
              </div>
            )}

            {/* ═══ TAB: COPY ═══ */}
            {tab === "picks" && (
              <div className="space-y-4">
                {picks.filter((p) => p.slug).length === 0 ? (
                  <div className="text-center py-16"><p className="text-gray-500 text-sm">Nessun pick con link disponibile.</p></div>
                ) : (
                  <>
                    <div className="bg-blue-950/20 border border-blue-800/30 rounded-lg p-4">
                      <div className="flex items-center justify-between mb-3">
                        <div>
                          <h3 className="text-white font-semibold text-sm">Copia tutte le scommesse</h3>
                          <p className="text-gray-400 text-xs mt-0.5">{picks.filter((p) => p.slug).length} mercati con link diretto</p>
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={() => {
                              const lines = picks.filter((p) => p.slug).map((p, i) =>
                                `${i + 1}. ${p.question}\n   Compra: ${p.outcomeName} (Outcome #${p.outcomeIndex})\n   Entry: $${p.avgEntryPrice.toFixed(4)} — Se vince: +${p.potentialReturn.toFixed(0)}% — EV: ${p.expectedValue > 0 ? "+" : ""}${(p.expectedValue * 100).toFixed(1)}¢\n   Fiducia: ${p.confidence} — ${p.walletCount} wallet — Size: ${p.suggestedSizePercent.toFixed(1)}% bankroll\n   Link: https://polymarket.com/event/${p.slug}\n`
                              );
                              navigator.clipboard.writeText(lines.join("\n")).then(() => { setCopied(true); setTimeout(() => setCopied(false), 3000); });
                            }}
                            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${copied ? "bg-green-600 text-white" : "bg-blue-600 hover:bg-blue-500 text-white"}`}
                          >
                            {copied ? "✓ Copiato!" : "Copia lista"}
                          </button>
                          <button
                            onClick={() => { picks.filter((p) => p.slug).forEach((p, i) => { setTimeout(() => window.open(`https://polymarket.com/event/${p.slug}`, `_pm_${i}`), i * 300); }); }}
                            className="px-3 py-1.5 rounded-md text-xs font-medium bg-purple-600 hover:bg-purple-500 text-white transition-colors"
                          >
                            Apri tutti ↗
                          </button>
                        </div>
                      </div>
                    </div>

                    {picks.filter((p) => p.slug).map((p, i) => {
                      const cc = confColor[p.confidence];
                      return (
                        <div key={`copy-${p.conditionId}-${i}`} className="rounded-lg border bg-gray-900/60 border-gray-800 p-3">
                          <div className="flex items-center justify-between gap-3">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-0.5">
                                <span className="text-white font-bold text-sm">{i + 1}.</span>
                                <span className={`text-[9px] px-1.5 py-0.5 rounded border font-bold ${cc.bg} ${cc.text}`}>{p.confidence}</span>
                                <h4 className="text-sm text-white font-medium truncate">{p.question}</h4>
                              </div>
                              <div className="flex flex-wrap gap-3 text-xs text-gray-400">
                                <span>Compra <strong className="text-yellow-400">{p.outcomeName}</strong></span>
                                <span>Entry: <strong className="text-green-400">${p.avgEntryPrice.toFixed(4)}</strong></span>
                                <span>Rendimento: <strong className="text-green-400">+{p.potentialReturn.toFixed(0)}%</strong></span>
                                <span>Size: <strong className="text-blue-400">{p.suggestedSizePercent.toFixed(1)}%</strong></span>
                                <span className="text-gray-600">{p.walletCount} wallet</span>
                              </div>
                            </div>
                            <a href={`https://polymarket.com/event/${p.slug}`} target="_blank" rel="noopener noreferrer"
                              className="flex-shrink-0 bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium px-3 py-2 rounded-md">
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

            {/* ═══ TAB: SMART WALLETS ═══ */}
            {tab === "wallets" && (
              <div className="space-y-3">
                {wallets.length === 0 ? (
                  <div className="text-center py-16"><p className="text-gray-500 text-sm">Nessun wallet con edge robusto trovato. Serve più sync + compute.</p></div>
                ) : (
                  <>
                    <div className="bg-gray-900/40 border border-gray-800 rounded-lg p-3 text-xs text-gray-400">
                      Wallet con αZ positivo a più soglie, hedge ≤25%, late ≤60%.
                      Ordinati per numero di soglie positive e follow score.
                    </div>
                    {wallets.map((w) => (
                      <div key={w.wallet} className={`rounded-lg border p-4 ${w.isFollowable ? "bg-green-950/10 border-green-800/30" : "bg-gray-900/60 border-gray-800"}`}>
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <Link href={`/wallet/${w.wallet}`} className="font-mono text-blue-400 hover:underline text-sm">
                              {w.wallet.slice(0, 8)}…{w.wallet.slice(-6)}
                            </Link>
                            {w.isFollowable && <span className="text-green-400 text-xs font-medium">✓</span>}
                            <span className="text-[10px] bg-blue-500/20 text-blue-400 px-1.5 py-0.5 rounded">
                              αZ+ a {w.positiveThresholds}/{w.totalThresholds} soglie
                            </span>
                          </div>
                          <span className="text-blue-400 font-bold">{w.followScore.toFixed(1)}</span>
                        </div>
                        <div className="grid grid-cols-3 sm:grid-cols-5 gap-2 text-xs">
                          <div><span className="text-gray-500 block">Trade</span><span className="text-white font-semibold">{w.maxN}</span></div>
                          <div><span className="text-gray-500 block">αZ @2%</span><span className={`font-semibold ${w.alphaz > 0 ? "text-green-400" : "text-red-400"}`}>{w.alphaz.toFixed(2)}</span></div>
                          <div><span className="text-gray-500 block">Hedge</span><span className={`font-semibold ${w.hedgeRate <= 0.1 ? "text-green-400" : "text-yellow-400"}`}>{(w.hedgeRate * 100).toFixed(0)}%</span></div>
                          <div><span className="text-gray-500 block">Late</span><span className="text-gray-300 font-semibold">{(w.lateRate * 100).toFixed(0)}%</span></div>
                          <div><span className="text-gray-500 block">Ultimo</span><span className="text-gray-300">{w.lastTradeAt ? timeAgo(w.lastTradeAt) : "—"}</span></div>
                        </div>
                        {w.stats && w.stats.length > 0 && (
                          <div className="mt-2 flex flex-wrap gap-1.5">
                            {w.stats.map((s: WalletStat) => (
                              <span key={s.threshold} className={`text-[10px] px-2 py-0.5 rounded ${Number(s.alphaz) > 0 ? "bg-green-900/30 text-green-400" : "bg-gray-800 text-gray-500"}`}>
                                @{s.threshold}: {s.wins}/{s.n} (αZ {Number(s.alphaz).toFixed(1)})
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </>
                )}
              </div>
            )}

            {/* ═══ TAB: EXIT ALERTS ═══ */}
            {tab === "exits" && (
              <div className="space-y-3">
                {exits.length === 0 ? (
                  <div className="text-center py-16">
                    <p className="text-gray-500 text-sm mb-1">Nessun alert di uscita negli ultimi 7 giorni.</p>
                    <p className="text-gray-600 text-xs">Quando un wallet smart vende le sue shares, apparirà qui come segnale di uscita.</p>
                  </div>
                ) : (
                  <>
                    <div className="bg-red-950/20 border border-red-800/30 rounded-lg p-3 text-xs text-red-300">
                      <strong>Alert uscita:</strong> Questi wallet smart hanno VENDUTO posizioni di recente.
                      Se hai copiato le loro scommesse, potrebbe essere il momento di uscire.
                    </div>
                    {exits.map((e, i) => (
                      <div key={`exit-${e.conditionId}-${e.wallet}-${i}`} className="bg-red-950/10 border border-red-800/30 rounded-lg p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-[10px] bg-red-500/20 text-red-400 px-2 py-0.5 rounded-full font-bold">VENDITA</span>
                              <span className="text-[10px] text-gray-500">{timeAgo(e.ts)}</span>
                            </div>
                            <h3 className="text-sm font-semibold text-white truncate">{e.question || e.conditionId.slice(0, 30)}</h3>
                            <p className="text-[10px] text-gray-500 mt-0.5">
                              <Link href={`/wallet/${e.wallet}`} className="text-blue-400 hover:underline font-mono">
                                {e.wallet.slice(0, 6)}…{e.wallet.slice(-4)}
                              </Link>
                              {" "}— αZ {e.alphaz.toFixed(1)} — Score {e.followScore.toFixed(1)} — Outcome #{e.outcomeIndex} — Size: ${e.size.toFixed(0)} @ ${e.price.toFixed(4)}
                            </p>
                          </div>
                          {e.slug && (
                            <a href={`https://polymarket.com/event/${e.slug}`} target="_blank" rel="noopener noreferrer"
                              className="flex-shrink-0 bg-red-600/80 hover:bg-red-500 text-white text-xs font-medium px-3 py-1.5 rounded-md">
                              Vedi mercato ↗
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
          <strong className="text-yellow-400">Disclaimer:</strong> Questi consigli sono generati da un algoritmo statistico.
          Le performance passate non garantiscono risultati futuri. Le scommesse a bassa probabilità hanno un alto rischio di perdita totale.
          Le size suggerite sono basate su Kelly frazionario (1/4) — sono conservative ma non eliminano il rischio.
          Non è un consiglio finanziario.{" "}
          <Link href="/docs#come-usare" className="text-blue-400 hover:underline">Guida completa →</Link>
        </div>
      </main>
    </div>
  );
}
