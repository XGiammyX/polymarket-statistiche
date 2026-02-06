"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import Navbar from "@/components/Navbar";

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

  useEffect(() => { fetchPositions(); }, [fetchPositions]);

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
          <h2 className="text-xl font-bold mb-1">Posizioni Aperte</h2>
          <p className="text-sm text-gray-400 leading-relaxed">
            Tutte le posizioni attualmente aperte dei wallet migliori. Una posizione è &quot;aperta&quot;
            quando il wallet ha ancora shares in un mercato (ha comprato ma non ha ancora venduto).
            Utile per capire su quali mercati i trader migliori sono esposti.
          </p>
          <div className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs text-gray-500">
            <div className="bg-gray-900/60 rounded p-2.5">
              <strong className="text-gray-300">Shares</strong> — Quantità netta di token detenuti.
              Calcolato come somma dei BUY meno i SELL. Se scende a 0, la posizione scompare.
            </div>
            <div className="bg-gray-900/60 rounded p-2.5">
              <strong className="text-gray-300">Prezzo att.</strong> — Prezzo corrente del token
              sul CLOB di Polymarket (aggiornato ogni 10 minuti dal sync-live).
            </div>
            <div className="bg-gray-900/60 rounded p-2.5">
              <strong className="text-gray-300">Filtra wallet</strong> — Incolla un indirizzo 0x...
              completo per vedere solo le posizioni di quel wallet specifico.
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="mb-5 bg-gray-900/50 rounded-lg p-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <label className="flex flex-col text-sm sm:col-span-2">
              <span className="text-gray-400 mb-1">Cerca wallet</span>
              <input
                className="bg-gray-800 rounded px-3 py-1.5 w-full text-sm font-mono"
                value={walletFilter}
                onChange={(e) => setWalletFilter(e.target.value)}
                placeholder="0x... (incolla un indirizzo completo)"
              />
              <span className="text-[10px] text-gray-600 mt-1">Inserisci un indirizzo 0x per filtrare le posizioni di un singolo wallet. Lascia vuoto per vedere tutti.</span>
            </label>
            <label className="flex flex-col text-sm justify-between">
              <span className="text-gray-400 mb-1">Filtro qualità</span>
              <div className="flex items-center gap-2 bg-gray-800 rounded px-3 py-1.5">
                <input type="checkbox" className="accent-blue-500" checked={onlyFollowable} onChange={(e) => setOnlyFollowable(e.target.checked)} />
                <span className="text-gray-300 text-sm">Solo Followable</span>
              </div>
              <span className="text-[10px] text-gray-600 mt-1">Mostra solo posizioni di wallet verificati con vantaggio statistico</span>
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
        ) : positions.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-500 text-sm">Nessuna posizione aperta trovata.</p>
          </div>
        ) : (
          <>
            <p className="text-xs text-gray-600 mb-3">{positions.length} posizioni trovate</p>
            <div className="overflow-auto rounded-lg border border-gray-800">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-left text-gray-400 bg-gray-900/80 border-b border-gray-800">
                    <th className="py-2.5 px-3">Wallet</th>
                    <th className="py-2.5 px-3">Mercato</th>
                    <th className="py-2.5 px-3 text-center">Idx</th>
                    <th className="py-2.5 px-3 text-right">Shares</th>
                    <th className="py-2.5 px-3 text-right">Prezzo att.</th>
                    <th className="py-2.5 px-3">Ultimo trade</th>
                    <th className="py-2.5 px-3"></th>
                  </tr>
                </thead>
                <tbody>
                  {positions.map((p, i) => (
                    <tr key={`${p.wallet}-${p.conditionId}-${p.outcomeIndex}-${i}`} className="border-b border-gray-800/50 hover:bg-gray-800/30 transition-colors">
                      <td className="py-2 px-3 font-mono">
                        <Link href={`/wallet/${p.wallet}`} className="text-blue-400 hover:underline">
                          {p.wallet.slice(0, 6)}...{p.wallet.slice(-4)}
                        </Link>
                      </td>
                      <td className="py-2 px-3 max-w-xs truncate">{p.question || p.conditionId.slice(0, 16) + "..."}</td>
                      <td className="py-2 px-3 text-center text-gray-400">{p.outcomeIndex}</td>
                      <td className="py-2 px-3 text-right font-semibold">{Number(p.netShares).toFixed(2)}</td>
                      <td className="py-2 px-3 text-right">
                        {p.currentPrice != null
                          ? <span className="text-yellow-400">{Number(p.currentPrice).toFixed(4)}</span>
                          : <span className="text-gray-600">—</span>}
                      </td>
                      <td className="py-2 px-3 text-gray-400 whitespace-nowrap">
                        {p.lastTradeAt ? <span title={new Date(p.lastTradeAt).toLocaleString()}>{timeAgo(p.lastTradeAt)}</span> : "—"}
                      </td>
                      <td className="py-2 px-3">
                        {p.slug && (
                          <a href={`https://polymarket.com/market/${p.slug}`} target="_blank" rel="noopener noreferrer"
                            className="text-blue-500 hover:underline text-[10px] bg-blue-500/10 px-2 py-0.5 rounded">
                            Polymarket ↗
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
      </main>
    </div>
  );
}
