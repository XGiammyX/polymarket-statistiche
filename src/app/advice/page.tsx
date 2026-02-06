"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";

interface Stats {
  total: number;
  highConf: number;
  strongEdge: number;
  trendingYes: number;
  trendingNo: number;
  avgConfidence: number;
  avgAbsEdge: number;
}

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
  edge: number;
  trend: number | null;
  recommendedSide: string;
  recommendedProb: number;
  mainDriver: string;
  updatedAt: string;
}

type SortKey = "confidence" | "edge" | "trend" | "updated";

function pct(v: number) { return (v * 100).toFixed(1); }
function pp(v: number) { return (v * 100).toFixed(1); }

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

function edgeColor(e: number) {
  const abs = Math.abs(e);
  if (abs > 0.10) return "text-amber-400 font-bold";
  if (abs > 0.05) return "text-amber-400/80";
  return "text-gray-400";
}

function trendArrow(t: number | null) {
  if (t == null) return { icon: "—", color: "text-gray-600" };
  if (t > 0.02) return { icon: "▲▲", color: "text-green-400" };
  if (t > 0.005) return { icon: "▲", color: "text-green-400/70" };
  if (t < -0.02) return { icon: "▼▼", color: "text-red-400" };
  if (t < -0.005) return { icon: "▼", color: "text-red-400/70" };
  return { icon: "→", color: "text-gray-500" };
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
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [minConf, setMinConf] = useState(0);
  const [sort, setSort] = useState<SortKey>("confidence");

  const fetchData = useCallback(() => {
    setLoading(true);
    fetch(`/api/markets/advice?limit=200&minConfidence=${minConf}&sort=${sort}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.ok) {
          setItems(d.markets);
          setStats(d.stats);
        }
      })
      .finally(() => setLoading(false));
  }, [minConf, sort]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const sortLabels: Record<SortKey, string> = {
    confidence: "Confidence",
    edge: "Edge (valore)",
    trend: "Trend",
    updated: "Recenti",
  };

  return (
    <main className="min-h-screen bg-gray-950 text-white p-4 md:p-8 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Analisi Mercati</h1>
          <p className="text-sm text-gray-500 mt-1">
            Probabilità YES/NO stimate · Edge vs prezzo · Trend nel tempo
          </p>
        </div>
        <Link href="/" className="text-sm text-blue-400 hover:underline">← Home</Link>
      </div>

      {/* Stats header */}
      {stats && stats.total > 0 && (
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 mb-6">
          <div className="bg-gray-800/50 rounded-lg p-2.5 text-center">
            <span className="text-[10px] text-gray-500 block">Mercati</span>
            <span className="text-lg font-bold text-white">{stats.total}</span>
          </div>
          <div className="bg-gray-800/50 rounded-lg p-2.5 text-center">
            <span className="text-[10px] text-gray-500 block">Conf. media</span>
            <span className={`text-lg font-bold ${confColor(stats.avgConfidence)}`}>{stats.avgConfidence}</span>
          </div>
          <div className="bg-gray-800/50 rounded-lg p-2.5 text-center">
            <span className="text-[10px] text-gray-500 block">Alta conf.</span>
            <span className="text-lg font-bold text-green-400">{stats.highConf}</span>
          </div>
          <div className="bg-gray-800/50 rounded-lg p-2.5 text-center">
            <span className="text-[10px] text-gray-500 block">Forte edge</span>
            <span className="text-lg font-bold text-amber-400">{stats.strongEdge}</span>
          </div>
          <div className="bg-gray-800/50 rounded-lg p-2.5 text-center">
            <span className="text-[10px] text-gray-500 block">Trend ▲</span>
            <span className="text-lg font-bold text-green-400">{stats.trendingYes}</span>
          </div>
          <div className="bg-gray-800/50 rounded-lg p-2.5 text-center">
            <span className="text-[10px] text-gray-500 block">Trend ▼</span>
            <span className="text-lg font-bold text-red-400">{stats.trendingNo}</span>
          </div>
        </div>
      )}

      {/* Filters + Sort */}
      <div className="flex flex-wrap items-center gap-3 mb-6 text-sm">
        <div className="flex items-center gap-2">
          <span className="text-gray-500 text-xs">Conf. min:</span>
          {[0, 20, 40, 60].map((v) => (
            <button
              key={v}
              onClick={() => setMinConf(v)}
              className={`px-2.5 py-1 rounded border text-xs font-medium transition-colors ${
                minConf === v
                  ? "bg-blue-600 border-blue-500 text-white"
                  : "bg-gray-800 border-gray-700 text-gray-400 hover:border-gray-500"
              }`}
            >
              ≥{v}
            </button>
          ))}
        </div>
        <div className="h-4 w-px bg-gray-700" />
        <div className="flex items-center gap-2">
          <span className="text-gray-500 text-xs">Ordina:</span>
          {(Object.keys(sortLabels) as SortKey[]).map((k) => (
            <button
              key={k}
              onClick={() => setSort(k)}
              className={`px-2.5 py-1 rounded border text-xs font-medium transition-colors ${
                sort === k
                  ? "bg-purple-600 border-purple-500 text-white"
                  : "bg-gray-800 border-gray-700 text-gray-400 hover:border-gray-500"
              }`}
            >
              {sortLabels[k]}
            </button>
          ))}
        </div>
      </div>

      {loading && (
        <div className="text-center py-20 text-gray-500">Caricamento analisi...</div>
      )}

      {!loading && items.length === 0 && (
        <div className="text-center py-20 text-gray-600">
          Nessun consiglio disponibile con questi filtri.
        </div>
      )}

      <div className="space-y-3">
        {items.map((item) => {
          const edge = item.edge;
          const absEdge = Math.abs(edge);
          const tr = trendArrow(item.trend);
          const isValueBet = absEdge > 0.05 && item.confidence >= 40;

          return (
            <Link
              key={item.conditionId}
              href={`/market/${item.conditionId}`}
              className={`block rounded-xl border transition-colors p-4 ${
                isValueBet
                  ? "border-amber-800/40 bg-amber-950/10 hover:bg-amber-950/20"
                  : "border-gray-800 bg-gray-900/60 hover:bg-gray-900"
              }`}
            >
              {/* Row 1: question + badges */}
              <div className="flex items-start justify-between gap-3 mb-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-semibold text-white leading-tight truncate">
                      {item.question || item.conditionId.slice(0, 30)}
                    </h3>
                    {isValueBet && (
                      <span className="flex-shrink-0 px-1.5 py-0.5 rounded bg-amber-900/40 border border-amber-800/40 text-[9px] text-amber-400 font-bold">
                        VALUE
                      </span>
                    )}
                  </div>
                  {item.mainDriver && (
                    <p className="text-[10px] text-gray-500 mt-1 truncate">{item.mainDriver}</p>
                  )}
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  {/* Trend arrow */}
                  <div className="text-center w-8">
                    <span className={`text-sm ${tr.color}`}>{tr.icon}</span>
                  </div>
                  {/* Confidence badge */}
                  <div className={`rounded-lg border px-3 py-1.5 text-center ${confBg(item.confidence)}`}>
                    <span className="text-[9px] text-gray-500 block">Conf.</span>
                    <span className={`text-lg font-bold ${confColor(item.confidence)}`}>
                      {item.confidence}
                    </span>
                  </div>
                </div>
              </div>

              {/* Row 2: key metrics */}
              <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 text-xs">
                <div className="bg-green-900/20 border border-green-800/20 rounded-lg p-2 text-center">
                  <span className="text-gray-500 block text-[10px]">YES</span>
                  <span className="text-green-400 font-bold text-base">{pct(item.pModelYes)}%</span>
                </div>
                <div className="bg-red-900/20 border border-red-800/20 rounded-lg p-2 text-center">
                  <span className="text-gray-500 block text-[10px]">NO</span>
                  <span className="text-red-400 font-bold text-base">{pct(item.pModelNo)}%</span>
                </div>
                <div className="bg-gray-800/50 rounded-lg p-2 text-center">
                  <span className="text-gray-500 block text-[10px]">Mercato</span>
                  <span className="text-white font-bold">{pct(item.pMktYes)}%</span>
                </div>
                <div className="bg-gray-800/50 rounded-lg p-2 text-center">
                  <span className="text-gray-500 block text-[10px]">Edge</span>
                  <span className={edgeColor(edge)}>
                    {edge >= 0 ? "+" : ""}{pp(edge)}pp
                  </span>
                </div>
                <div className="bg-gray-800/50 rounded-lg p-2 text-center">
                  <span className="text-gray-500 block text-[10px]">Trend</span>
                  <span className={tr.color}>
                    {item.trend != null ? `${item.trend >= 0 ? "+" : ""}${pp(item.trend)}pp` : "—"}
                  </span>
                </div>
                <div className="bg-gray-800/50 rounded-lg p-2 text-center">
                  <span className="text-gray-500 block text-[10px]">Range</span>
                  <span className="text-gray-300 font-bold">{pct(item.pLow)}–{pct(item.pHigh)}%</span>
                </div>
              </div>

              {/* Row 3: recommendation + meta */}
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
                <span>{timeAgo(item.updatedAt)}</span>
              </div>
            </Link>
          );
        })}
      </div>

      {/* Disclaimer */}
      <div className="mt-8 p-3 rounded-lg bg-gray-800/30 border border-gray-700/30 text-center">
        <p className="text-[10px] text-gray-600">
          Stime basate su dati storici e flussi osservati. Non è una garanzia. Modello log-odds
          con pesi su posizioni nette e flussi recenti. Edge = differenza modello vs mercato. Trend = variazione rispetto al calcolo precedente.
        </p>
      </div>
    </main>
  );
}
