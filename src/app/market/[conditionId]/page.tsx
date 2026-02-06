"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";

interface Driver {
  name: string;
  value: number;
  effect: string;
  note: string;
}

interface TopWallet {
  wallet: string;
  followScore: number;
  alphaz: number;
  weight: number;
  side: string;
  netShares: number;
  flowCost72h: number;
  lastTradeAt: string | null;
}

interface Advice {
  conditionId: string;
  question: string;
  slug: string;
  eventSlug: string | null;
  endDate: string | null;
  closed: boolean;
  outcomes: string[];
  pMktYes: number;
  pModelYes: number;
  pModelNo: number;
  confidence: number;
  pLow: number;
  pHigh: number;
  edge: number;
  trend: number | null;
  recommendedSide: string;
  recommendedProb: number;
  netYesShares: number;
  netNoShares: number;
  flowYesCost: number;
  flowNoCost: number;
  topDrivers: Driver[];
  topWallets: TopWallet[];
  updatedAt?: string;
}

function pct(v: number) { return (v * 100).toFixed(1); }
function pct2(v: number) { return (v * 100).toFixed(2); }

function confColor(c: number) {
  if (c >= 60) return "text-green-400";
  if (c >= 30) return "text-yellow-400";
  return "text-gray-500";
}

function effectIcon(e: string) {
  if (e.includes("YES")) return "🟢";
  if (e.includes("NO")) return "🔴";
  if (e.includes("buona") || e.includes("alta")) return "✅";
  if (e.includes("pochi")) return "⚠️";
  return "⚪";
}

function timeAgo(ts: string | null) {
  if (!ts) return "—";
  const diff = Date.now() - new Date(ts).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m fa`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h fa`;
  return `${Math.floor(hrs / 24)}g fa`;
}

export default function MarketDetailPage() {
  const params = useParams();
  const conditionId = params.conditionId as string;

  const [advice, setAdvice] = useState<Advice | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!conditionId) return;
    fetch(`/api/market/${conditionId}/advice`)
      .then((r) => r.json())
      .then((d) => {
        if (d.ok) setAdvice(d.advice);
        else setError(d.error || "Errore sconosciuto");
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [conditionId]);

  if (loading) {
    return (
      <main className="min-h-screen bg-gray-950 text-white flex items-center justify-center">
        <p className="text-gray-500">Calcolo analisi in corso...</p>
      </main>
    );
  }

  if (error || !advice) {
    return (
      <main className="min-h-screen bg-gray-950 text-white p-8 max-w-4xl mx-auto">
        <Link href="/advice" className="text-blue-400 hover:underline text-sm">← Torna ai consigli</Link>
        <div className="mt-8 text-center py-20">
          <p className="text-red-400 font-semibold">{error || "Mercato non trovato"}</p>
          <p className="text-gray-600 text-sm mt-2">Solo mercati binari (YES/NO) sono supportati.</p>
        </div>
      </main>
    );
  }

  const shift = advice.pModelYes - advice.pMktYes;

  return (
    <main className="min-h-screen bg-gray-950 text-white p-4 md:p-8 max-w-4xl mx-auto">
      {/* Back nav */}
      <Link href="/advice" className="text-blue-400 hover:underline text-sm">← Torna ai consigli</Link>

      {/* Header */}
      <div className="mt-4 mb-6">
        <h1 className="text-xl font-bold">{advice.question || conditionId}</h1>
        <div className="flex items-center gap-3 mt-2 text-xs text-gray-500">
          {advice.endDate && <span>Scade: {new Date(advice.endDate).toLocaleDateString("it-IT")}</span>}
          {advice.eventSlug && (
            <a
              href={`https://polymarket.com/event/${advice.eventSlug}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-400 hover:underline"
            >
              Vedi su Polymarket ↗
            </a>
          )}
        </div>
      </div>

      {/* ── Main probability cards ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <div className="bg-green-900/20 border border-green-800/30 rounded-xl p-4 text-center">
          <span className="text-gray-500 block text-[10px] mb-1">Prob. modello YES</span>
          <span className="text-green-400 font-bold text-3xl">{pct(advice.pModelYes)}%</span>
        </div>
        <div className="bg-red-900/20 border border-red-800/30 rounded-xl p-4 text-center">
          <span className="text-gray-500 block text-[10px] mb-1">Prob. modello NO</span>
          <span className="text-red-400 font-bold text-3xl">{pct(advice.pModelNo)}%</span>
        </div>
        <div className={`rounded-xl border p-4 text-center ${advice.confidence >= 60 ? "bg-green-900/10 border-green-800/20" : advice.confidence >= 30 ? "bg-yellow-900/10 border-yellow-800/20" : "bg-gray-800/30 border-gray-700/20"}`}>
          <span className="text-gray-500 block text-[10px] mb-1">Confidence</span>
          <span className={`font-bold text-3xl ${confColor(advice.confidence)}`}>{advice.confidence}</span>
          <span className="text-gray-600 text-xs">/100</span>
        </div>
        <div className="bg-gray-800/30 border border-gray-700/20 rounded-xl p-4 text-center">
          <span className="text-gray-500 block text-[10px] mb-1">Range stima</span>
          <span className="text-gray-300 font-bold text-xl">{pct(advice.pLow)}–{pct(advice.pHigh)}%</span>
        </div>
      </div>

      {/* ── Edge & Trend cards ── */}
      <div className="grid grid-cols-2 gap-3 mb-6">
        <div className={`rounded-xl border p-4 text-center ${
          Math.abs(advice.edge) > 0.05 ? "bg-amber-950/20 border-amber-800/30" : "bg-gray-800/30 border-gray-700/20"
        }`}>
          <span className="text-gray-500 block text-[10px] mb-1">Edge (modello vs mercato)</span>
          <span className={`font-bold text-2xl ${
            Math.abs(advice.edge) > 0.10 ? "text-amber-400" : Math.abs(advice.edge) > 0.05 ? "text-amber-400/80" : "text-gray-400"
          }`}>
            {advice.edge >= 0 ? "+" : ""}{(advice.edge * 100).toFixed(2)}pp
          </span>
          {Math.abs(advice.edge) > 0.05 && (
            <span className="block text-[10px] text-amber-400/60 mt-1">
              {advice.edge > 0 ? "Modello più rialzista del mercato" : "Modello più ribassista del mercato"}
            </span>
          )}
        </div>
        <div className="rounded-xl border bg-gray-800/30 border-gray-700/20 p-4 text-center">
          <span className="text-gray-500 block text-[10px] mb-1">Trend (vs calcolo precedente)</span>
          {advice.trend != null ? (
            <>
              <span className={`font-bold text-2xl ${
                advice.trend > 0.02 ? "text-green-400" : advice.trend > 0.005 ? "text-green-400/70" :
                advice.trend < -0.02 ? "text-red-400" : advice.trend < -0.005 ? "text-red-400/70" : "text-gray-400"
              }`}>
                {advice.trend >= 0 ? "+" : ""}{(advice.trend * 100).toFixed(2)}pp
              </span>
              <span className="block text-[10px] text-gray-500 mt-1">
                {advice.trend > 0.005 ? "Probabilità YES in aumento" : advice.trend < -0.005 ? "Probabilità YES in calo" : "Stabile"}
              </span>
            </>
          ) : (
            <span className="text-gray-500 text-lg">—</span>
          )}
        </div>
      </div>

      {/* ── Comparison: market vs model ── */}
      <div className="rounded-xl border border-gray-800 bg-gray-900/60 p-4 mb-6">
        <h2 className="text-sm font-semibold text-gray-400 mb-3">Confronto prezzo mercato vs modello</h2>
        <div className="grid grid-cols-3 gap-4 text-center text-sm">
          <div>
            <span className="text-gray-500 block text-[10px]">Mercato YES</span>
            <span className="text-white font-bold text-lg">{pct(advice.pMktYes)}%</span>
          </div>
          <div>
            <span className="text-gray-500 block text-[10px]">Edge</span>
            <span className={`font-bold text-lg ${shift > 0.01 ? "text-amber-400" : shift < -0.01 ? "text-red-400" : "text-gray-400"}`}>
              {shift >= 0 ? "+" : ""}{(shift * 100).toFixed(2)}pp
            </span>
          </div>
          <div>
            <span className="text-gray-500 block text-[10px]">Modello YES</span>
            <span className={`font-bold text-lg ${advice.pModelYes > advice.pMktYes ? "text-green-400" : "text-red-400"}`}>
              {pct(advice.pModelYes)}%
            </span>
          </div>
        </div>

        {/* Visual bar */}
        <div className="mt-4 relative h-6 bg-gray-800 rounded-full overflow-hidden">
          <div
            className="absolute top-0 left-0 h-full bg-green-600/40 rounded-l-full"
            style={{ width: `${advice.pModelYes * 100}%` }}
          />
          <div
            className="absolute top-0 h-full w-0.5 bg-white/50"
            style={{ left: `${advice.pMktYes * 100}%` }}
            title="Prezzo mercato"
          />
          <div className="absolute inset-0 flex items-center justify-center text-[10px] text-white/70">
            YES {pct(advice.pModelYes)}% | NO {pct(advice.pModelNo)}%
          </div>
        </div>
        <div className="flex justify-between text-[9px] text-gray-600 mt-1">
          <span>0%</span>
          <span>Linea bianca = prezzo mercato ({pct(advice.pMktYes)}%)</span>
          <span>100%</span>
        </div>
      </div>

      {/* ── PERCHÉ: Drivers ── */}
      <div className="rounded-xl border border-gray-800 bg-gray-900/60 p-4 mb-6">
        <h2 className="text-sm font-semibold text-gray-400 mb-3">Perché — Driver quantitativi</h2>
        <div className="space-y-3">
          {advice.topDrivers.map((d, i) => (
            <div key={i} className="flex items-start gap-3 bg-gray-800/40 rounded-lg p-3">
              <span className="text-lg flex-shrink-0">{effectIcon(d.effect)}</span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-white">{d.name}</span>
                  <span className={`text-xs font-bold ${
                    d.effect.includes("YES") ? "text-green-400" :
                    d.effect.includes("NO") ? "text-red-400" : "text-gray-400"
                  }`}>
                    {typeof d.value === "number" ? (d.value >= 0 ? "+" : "") + pct2(d.value) : d.value}
                    {" "}— {d.effect}
                  </span>
                </div>
                <p className="text-[10px] text-gray-500 mt-0.5">{d.note}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Quantità: posizioni e flussi ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <div className="bg-gray-800/50 rounded-lg p-3 text-center">
          <span className="text-gray-500 block text-[10px]">Pos. nette YES</span>
          <span className={`font-bold ${advice.netYesShares > 0 ? "text-green-400" : "text-gray-400"}`}>
            {advice.netYesShares.toFixed(1)}
          </span>
        </div>
        <div className="bg-gray-800/50 rounded-lg p-3 text-center">
          <span className="text-gray-500 block text-[10px]">Pos. nette NO</span>
          <span className={`font-bold ${advice.netNoShares > 0 ? "text-red-400" : "text-gray-400"}`}>
            {advice.netNoShares.toFixed(1)}
          </span>
        </div>
        <div className="bg-gray-800/50 rounded-lg p-3 text-center">
          <span className="text-gray-500 block text-[10px]">Flusso 72h YES</span>
          <span className={`font-bold ${advice.flowYesCost > 0 ? "text-green-400" : "text-gray-400"}`}>
            ${advice.flowYesCost.toFixed(2)}
          </span>
        </div>
        <div className="bg-gray-800/50 rounded-lg p-3 text-center">
          <span className="text-gray-500 block text-[10px]">Flusso 72h NO</span>
          <span className={`font-bold ${advice.flowNoCost > 0 ? "text-red-400" : "text-gray-400"}`}>
            ${advice.flowNoCost.toFixed(2)}
          </span>
        </div>
      </div>

      {/* ── Chi sta guidando: top wallets ── */}
      {advice.topWallets.length > 0 && (
        <div className="rounded-xl border border-gray-800 bg-gray-900/60 p-4 mb-6">
          <h2 className="text-sm font-semibold text-gray-400 mb-3">Chi sta guidando il segnale</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-gray-600 text-[10px] border-b border-gray-800">
                  <th className="text-left pb-2">Wallet</th>
                  <th className="text-center pb-2">Peso</th>
                  <th className="text-center pb-2">αZ</th>
                  <th className="text-center pb-2">Lato</th>
                  <th className="text-right pb-2">Shares</th>
                  <th className="text-right pb-2">Flow 72h</th>
                  <th className="text-right pb-2">Ultimo</th>
                </tr>
              </thead>
              <tbody>
                {advice.topWallets.map((w, i) => (
                  <tr key={i} className="border-b border-gray-800/50">
                    <td className="py-1.5">
                      <Link
                        href={`/wallet/${w.wallet}`}
                        className="text-blue-400 hover:underline font-mono"
                      >
                        {w.wallet.slice(0, 6)}…{w.wallet.slice(-4)}
                      </Link>
                    </td>
                    <td className="text-center">
                      <span className="bg-gray-800 px-1.5 py-0.5 rounded text-[10px]">
                        {(w.weight * 100).toFixed(0)}%
                      </span>
                    </td>
                    <td className={`text-center font-bold ${w.alphaz > 2 ? "text-green-400" : w.alphaz > 0 ? "text-green-400/70" : "text-gray-500"}`}>
                      {w.alphaz.toFixed(1)}
                    </td>
                    <td className={`text-center font-bold ${w.side === "YES" ? "text-green-400" : "text-red-400"}`}>
                      {w.side}
                    </td>
                    <td className="text-right font-mono">{w.netShares.toFixed(1)}</td>
                    <td className="text-right font-mono">${w.flowCost72h.toFixed(2)}</td>
                    <td className="text-right text-gray-500">{timeAgo(w.lastTradeAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Consiglio finale */}
      <div className={`rounded-xl border p-4 mb-6 text-center ${
        advice.recommendedSide === "YES" ? "bg-green-900/10 border-green-800/30" : "bg-red-900/10 border-red-800/30"
      }`}>
        <span className="text-gray-500 text-xs block mb-1">Consiglio del modello</span>
        <span className={`text-2xl font-bold ${advice.recommendedSide === "YES" ? "text-green-400" : "text-red-400"}`}>
          {advice.recommendedSide}
        </span>
        <span className="text-gray-400 text-sm ml-2">
          al {pct(advice.recommendedProb)}% (confidence {advice.confidence}/100)
        </span>
      </div>

      {/* Disclaimer */}
      <div className="p-3 rounded-lg bg-gray-800/30 border border-gray-700/30 text-center">
        <p className="text-[10px] text-gray-600">
          Stime basate su dati storici e flussi osservati. Non è una garanzia.
          Il modello usa log-odds con pesi su posizioni nette e flussi recenti di wallet affidabili.
        </p>
      </div>
    </main>
  );
}
