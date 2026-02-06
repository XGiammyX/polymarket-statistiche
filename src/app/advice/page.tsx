"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

interface AdviceItem {
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
  recommendedSide: string;
  recommendedProb: number;
  mainDriver: string;
  updatedAt: string;
}

function pct(v: number) {
  return (v * 100).toFixed(1);
}

function confColor(c: number) {
  if (c >= 60) return "text-green-400";
  if (c >= 30) return "text-yellow-400";
  return "text-gray-500";
}

function confBg(c: number) {
  if (c >= 60) return "bg-green-900/20 border-green-800/30";
  if (c >= 30) return "bg-yellow-900/20 border-yellow-800/30";
  return "bg-gray-800/30 border-gray-700/30";
}

function sideColor(side: string) {
  return side === "YES" ? "text-green-400" : "text-red-400";
}

function timeAgo(ts: string) {
  const diff = Date.now() - new Date(ts).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m fa`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h fa`;
  return `${Math.floor(hrs / 24)}g fa`;
}

export default function AdvicePage() {
  const [items, setItems] = useState<AdviceItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [minConf, setMinConf] = useState(0);

  useEffect(() => {
    fetch(`/api/markets/advice?limit=100&minConfidence=${minConf}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.ok) setItems(d.markets);
      })
      .finally(() => setLoading(false));
  }, [minConf]);

  return (
    <main className="min-h-screen bg-gray-950 text-white p-4 md:p-8 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Consigli Mercati</h1>
          <p className="text-sm text-gray-500 mt-1">
            Probabilità stimate YES/NO basate su posizioni, flussi e wallet affidabili.
            Modello statistico log-odds, nessun ML.
          </p>
        </div>
        <Link href="/" className="text-sm text-blue-400 hover:underline">← Home</Link>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4 mb-6 text-sm">
        <span className="text-gray-500">Confidence minima:</span>
        {[0, 20, 40, 60].map((v) => (
          <button
            key={v}
            onClick={() => { setLoading(true); setMinConf(v); }}
            className={`px-3 py-1 rounded border text-xs font-medium transition-colors ${
              minConf === v
                ? "bg-blue-600 border-blue-500 text-white"
                : "bg-gray-800 border-gray-700 text-gray-400 hover:border-gray-500"
            }`}
          >
            ≥{v}
          </button>
        ))}
      </div>

      {loading && (
        <div className="text-center py-20 text-gray-500">Caricamento analisi...</div>
      )}

      {!loading && items.length === 0 && (
        <div className="text-center py-20 text-gray-600">
          Nessun consiglio disponibile. Esegui il cron compute-markets per generare le analisi.
        </div>
      )}

      <div className="space-y-3">
        {items.map((item) => {
          const shift = item.pModelYes - item.pMktYes;
          const shiftPct = (shift * 100).toFixed(1);
          const shiftSign = shift >= 0 ? "+" : "";

          return (
            <Link
              key={item.conditionId}
              href={`/market/${item.conditionId}`}
              className="block rounded-xl border border-gray-800 bg-gray-900/60 hover:bg-gray-900 transition-colors p-4"
            >
              {/* Row 1: question + confidence */}
              <div className="flex items-start justify-between gap-3 mb-3">
                <div className="flex-1 min-w-0">
                  <h3 className="text-sm font-semibold text-white leading-tight">
                    {item.question || item.conditionId.slice(0, 30)}
                  </h3>
                  {item.mainDriver && (
                    <p className="text-[10px] text-gray-500 mt-1">
                      {item.mainDriver}
                    </p>
                  )}
                </div>
                <div className={`flex-shrink-0 rounded-lg border px-3 py-1.5 text-center ${confBg(item.confidence)}`}>
                  <span className="text-[9px] text-gray-500 block">Confidence</span>
                  <span className={`text-lg font-bold ${confColor(item.confidence)}`}>
                    {item.confidence}
                  </span>
                </div>
              </div>

              {/* Row 2: probabilities */}
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-xs">
                {/* YES probability */}
                <div className="bg-green-900/20 border border-green-800/20 rounded-lg p-2 text-center">
                  <span className="text-gray-500 block text-[10px]">YES modello</span>
                  <span className="text-green-400 font-bold text-base">{pct(item.pModelYes)}%</span>
                </div>
                {/* NO probability */}
                <div className="bg-red-900/20 border border-red-800/20 rounded-lg p-2 text-center">
                  <span className="text-gray-500 block text-[10px]">NO modello</span>
                  <span className="text-red-400 font-bold text-base">{pct(item.pModelNo)}%</span>
                </div>
                {/* Market price */}
                <div className="bg-gray-800/50 rounded-lg p-2 text-center">
                  <span className="text-gray-500 block text-[10px]">Mercato YES</span>
                  <span className="text-white font-bold">{pct(item.pMktYes)}%</span>
                </div>
                {/* Shift */}
                <div className="bg-gray-800/50 rounded-lg p-2 text-center">
                  <span className="text-gray-500 block text-[10px]">Δ modello</span>
                  <span className={`font-bold ${shift > 0.01 ? "text-green-400" : shift < -0.01 ? "text-red-400" : "text-gray-400"}`}>
                    {shiftSign}{shiftPct}pp
                  </span>
                </div>
                {/* Range */}
                <div className="bg-gray-800/50 rounded-lg p-2 text-center">
                  <span className="text-gray-500 block text-[10px]">Range</span>
                  <span className="text-gray-300 font-bold">{pct(item.pLow)}–{pct(item.pHigh)}%</span>
                </div>
              </div>

              {/* Row 3: recommended + meta */}
              <div className="flex items-center justify-between mt-3 text-[10px] text-gray-500">
                <div className="flex items-center gap-3">
                  <span>
                    Consiglio: <strong className={sideColor(item.recommendedSide)}>{item.recommendedSide}</strong>
                    {" "}al {pct(item.recommendedProb)}%
                  </span>
                  {item.eventSlug && (
                    <a
                      href={`https://polymarket.com/event/${item.eventSlug}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-400 hover:underline"
                      onClick={(e) => e.stopPropagation()}
                    >
                      Polymarket ↗
                    </a>
                  )}
                </div>
                <span>Aggiornato {timeAgo(item.updatedAt)}</span>
              </div>
            </Link>
          );
        })}
      </div>

      {/* Disclaimer */}
      <div className="mt-8 p-3 rounded-lg bg-gray-800/30 border border-gray-700/30 text-center">
        <p className="text-[10px] text-gray-600">
          Stime basate su dati storici e flussi osservati. Non è una garanzia. Il modello usa log-odds
          con pesi su posizioni nette e flussi recenti di wallet affidabili.
        </p>
      </div>
    </main>
  );
}
