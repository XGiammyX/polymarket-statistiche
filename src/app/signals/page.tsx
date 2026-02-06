"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import Navbar from "@/components/Navbar";

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
        threshold, hours, limit: "200",
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

  useEffect(() => { fetchSignals(); }, [fetchSignals]);

  function timeAgo(iso: string): string {
    const diff = Date.now() - new Date(iso).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return `${mins}m fa`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h fa`;
    return `${Math.floor(hrs / 24)}g fa`;
  }

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100">
      <Navbar />
      <main className="max-w-7xl mx-auto px-6 py-6">
        <div className="mb-6">
          <h2 className="text-xl font-bold mb-1">Segnali Live</h2>
          <p className="text-sm text-gray-400 leading-relaxed">
            Scommesse BUY a bassa probabilità piazzate di recente da wallet con un track record
            di vittorie improbabili. Questi sono segnali &quot;copiabili&quot;: puoi vedere cosa
            stanno comprando i migliori trader e a che prezzo.
          </p>
          <div className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs text-gray-500">
            <div className="bg-gray-900/60 rounded p-2.5">
              <strong className="text-gray-300">Entry</strong> — Prezzo a cui il wallet ha comprato
              il token. Più basso = scommessa più rischiosa ma con rendimento potenziale più alto.
            </div>
            <div className="bg-gray-900/60 rounded p-2.5">
              <strong className="text-gray-300">Prezzo att.</strong> — Prezzo corrente del token
              sul mercato CLOB. Il delta (verde/rosso) mostra il guadagno/perdita rispetto all&apos;entry.
            </div>
            <div className="bg-gray-900/60 rounded p-2.5">
              <strong className="text-gray-300">Solo Attivi</strong> — Filtra solo i segnali dove
              il wallet ha ancora shares in mano (non ha venduto). I segnali chiusi vengono nascosti.
            </div>
          </div>
          {lastSync && (
            <p className="text-xs text-gray-500 mt-3">
              Ultimo sync live: <strong className="text-gray-400">{new Date(lastSync).toLocaleString()}</strong>
            </p>
          )}
        </div>

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
              <span className="text-[10px] text-gray-600 mt-1">Mostra solo segnali con entry price sotto questa soglia</span>
            </label>
            <label className="flex flex-col text-sm">
              <span className="text-gray-400 mb-1">Finestra temporale</span>
              <select className="bg-gray-800 rounded px-3 py-1.5 text-sm" value={hours} onChange={(e) => setHours(e.target.value)}>
                <option value="24">Ultime 24 ore</option>
                <option value="72">Ultimi 3 giorni</option>
                <option value="168">Ultima settimana</option>
              </select>
              <span className="text-[10px] text-gray-600 mt-1">Quanto indietro cercare i segnali recenti</span>
            </label>
            <label className="flex flex-col text-sm justify-between">
              <span className="text-gray-400 mb-1">Solo wallet top</span>
              <div className="flex items-center gap-2 bg-gray-800 rounded px-3 py-1.5">
                <input type="checkbox" className="accent-blue-500" checked={onlyFollowable} onChange={(e) => setOnlyFollowable(e.target.checked)} />
                <span className="text-gray-300 text-sm">Followable</span>
              </div>
              <span className="text-[10px] text-gray-600 mt-1">Solo segnali da wallet con track record verificato</span>
            </label>
            <label className="flex flex-col text-sm justify-between">
              <span className="text-gray-400 mb-1">Posizioni attive</span>
              <div className="flex items-center gap-2 bg-gray-800 rounded px-3 py-1.5">
                <input type="checkbox" className="accent-green-500" checked={activeOnly} onChange={(e) => setActiveOnly(e.target.checked)} />
                <span className="text-gray-300 text-sm">Solo attivi</span>
              </div>
              <span className="text-[10px] text-gray-600 mt-1">Escludi segnali dove il wallet ha già venduto le shares</span>
            </label>
          </div>
        </div>

        {error && (
          <div className="bg-red-950 border border-red-800 text-red-300 rounded p-3 text-sm mb-4">{error}</div>
        )}

        {loading ? (
          <div className="flex justify-center py-12">
            <div className="animate-pulse text-gray-500 text-sm">Caricamento...</div>
          </div>
        ) : signals.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-500 text-sm">Nessun segnale trovato. Esegui sync-live dall&apos;admin panel.</p>
          </div>
        ) : (
          <div className="overflow-auto rounded-lg border border-gray-800">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-left text-gray-400 bg-gray-900/80 border-b border-gray-800">
                  <th className="py-2.5 px-3">Quando</th>
                  <th className="py-2.5 px-3">Wallet</th>
                  <th className="py-2.5 px-3 text-right">Entry</th>
                  <th className="py-2.5 px-3 text-right">Prezzo att.</th>
                  <th className="py-2.5 px-3 text-right">Size</th>
                  <th className="py-2.5 px-3 text-right">Shares</th>
                  <th className="py-2.5 px-3">Mercato</th>
                  <th className="py-2.5 px-3"></th>
                </tr>
              </thead>
              <tbody>
                {signals.map((s, i) => {
                  const delta = s.currentPrice != null ? s.currentPrice - Number(s.entryPrice) : null;
                  return (
                    <tr key={`${s.conditionId}-${s.wallet}-${i}`} className="border-b border-gray-800/50 hover:bg-gray-800/30 transition-colors">
                      <td className="py-2 px-3 text-gray-400 whitespace-nowrap">
                        <span title={new Date(s.ts).toLocaleString()}>{timeAgo(s.ts)}</span>
                      </td>
                      <td className="py-2 px-3 font-mono">
                        <Link href={`/wallet/${s.wallet}`} className="text-blue-400 hover:underline">
                          {s.wallet.slice(0, 6)}...{s.wallet.slice(-4)}
                        </Link>
                      </td>
                      <td className="py-2 px-3 text-right text-green-400 font-semibold">{Number(s.entryPrice).toFixed(4)}</td>
                      <td className="py-2 px-3 text-right">
                        {s.currentPrice != null ? (
                          <span className={delta != null && delta > 0 ? "text-green-400" : delta != null && delta < 0 ? "text-red-400" : "text-yellow-400"}>
                            {Number(s.currentPrice).toFixed(4)}
                            {delta != null && <span className="text-[10px] ml-0.5">({delta > 0 ? "+" : ""}{delta.toFixed(3)})</span>}
                          </span>
                        ) : <span className="text-gray-600">—</span>}
                      </td>
                      <td className="py-2 px-3 text-right">{Number(s.size).toFixed(2)}</td>
                      <td className="py-2 px-3 text-right text-gray-400">{s.netShares != null ? Number(s.netShares).toFixed(2) : "—"}</td>
                      <td className="py-2 px-3 max-w-xs truncate">{s.question || s.conditionId.slice(0, 16) + "..."}</td>
                      <td className="py-2 px-3">
                        {s.slug && (
                          <a href={`https://polymarket.com/market/${s.slug}`} target="_blank" rel="noopener noreferrer"
                            className="text-blue-500 hover:underline text-[10px] bg-blue-500/10 px-2 py-0.5 rounded">
                            Polymarket ↗
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
