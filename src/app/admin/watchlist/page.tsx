"use client";

import { useState, useCallback, useEffect } from "react";
import Link from "next/link";
import Navbar from "@/components/Navbar";

interface WatchlistItem {
  wallet: string;
  created_at: string;
}

export default function WatchlistPage() {
  const [secret, setSecret] = useState(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("admin_secret") ?? "";
    }
    return "";
  });
  const [wallets, setWallets] = useState<WatchlistItem[]>([]);
  const [newWallet, setNewWallet] = useState("");
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lastResult, setLastResult] = useState<string | null>(null);

  const saveSecret = (v: string) => {
    setSecret(v);
    if (typeof window !== "undefined") {
      localStorage.setItem("admin_secret", v);
    }
  };

  const headers = useCallback(
    () => ({
      Authorization: `Bearer ${secret}`,
      "Content-Type": "application/json",
    }),
    [secret]
  );

  const fetchWatchlist = useCallback(async () => {
    if (!secret) return;
    setLoading("list");
    setError(null);
    try {
      const res = await fetch("/api/admin/watchlist", {
        headers: { Authorization: `Bearer ${secret}` },
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error ?? "Failed");
      setWallets(json.wallets ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(null);
    }
  }, [secret]);

  useEffect(() => {
    fetchWatchlist();
  }, [fetchWatchlist]);

  const addWallet = async () => {
    if (!newWallet.trim()) return;
    setLoading("add");
    setError(null);
    try {
      const res = await fetch("/api/admin/watchlist", {
        method: "POST",
        headers: headers(),
        body: JSON.stringify({ wallet: newWallet.trim() }),
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error ?? "Failed");
      setNewWallet("");
      await fetchWatchlist();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(null);
    }
  };

  const removeWallet = async (wallet: string) => {
    setLoading(`rm-${wallet}`);
    setError(null);
    try {
      const res = await fetch("/api/admin/watchlist", {
        method: "DELETE",
        headers: headers(),
        body: JSON.stringify({ wallet }),
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error ?? "Failed");
      await fetchWatchlist();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(null);
    }
  };

  const runLiveSync = async () => {
    setLoading("sync");
    setError(null);
    setLastResult(null);
    try {
      const res = await fetch("/api/admin/run-live-sync", {
        method: "POST",
        headers: headers(),
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error ?? "Failed");
      setLastResult(JSON.stringify(json.result ?? json, null, 2));
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(null);
    }
  };

  return (
    <>
      <head>
        <meta name="robots" content="noindex, nofollow" />
      </head>
      <div className="min-h-screen bg-gray-950 text-gray-100">
        <Navbar />
        <main className="max-w-5xl mx-auto px-6 py-6 space-y-6">
          <div>
            <h2 className="text-xl font-bold mb-1">Watchlist</h2>
            <p className="text-sm text-gray-400 leading-relaxed">
              Lista manuale di wallet da monitorare. I wallet aggiunti qui vengono inclusi
              nel job &quot;sync-live&quot; insieme a quelli followable automatici, così puoi
              tracciare le posizioni e i segnali anche di wallet che non hanno ancora abbastanza dati
              per entrare nella leaderboard.
            </p>
            <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-gray-500">
              <div className="bg-gray-900/60 rounded p-2.5">
                <strong className="text-gray-300">Aggiungi wallet</strong> — Incolla l&apos;indirizzo 0x...
                di un wallet Polymarket che vuoi monitorare. I suoi trade verranno scaricati
                al prossimo sync-live.
              </div>
              <div className="bg-gray-900/60 rounded p-2.5">
                <strong className="text-gray-300">Force Live Sync</strong> — Lancia subito il job
                sync-live che scarica i trade recenti di tutti i wallet (followable + watchlist),
                aggiorna le posizioni aperte e i prezzi.
              </div>
            </div>
          </div>
          {/* Secret */}
          <div className="flex items-end gap-3">
            <label className="flex flex-col text-sm">
              <span className="text-gray-400 mb-1">Admin Secret</span>
              <input
                type="password"
                className="bg-gray-800 rounded px-3 py-1.5 w-64 text-sm"
                value={secret}
                onChange={(e) => saveSecret(e.target.value)}
                placeholder="Enter ADMIN_SECRET"
              />
            </label>
            <button
              className="bg-blue-600 hover:bg-blue-700 px-4 py-1.5 rounded text-sm font-medium disabled:opacity-50"
              onClick={fetchWatchlist}
              disabled={!secret || loading !== null}
            >
              Refresh
            </button>
            <button
              className="bg-green-700 hover:bg-green-600 px-4 py-1.5 rounded text-sm font-medium disabled:opacity-50"
              onClick={runLiveSync}
              disabled={!secret || loading !== null}
            >
              {loading === "sync" ? "Running..." : "Force Live Sync"}
            </button>
          </div>

          {error && (
            <div className="bg-red-950 border border-red-800 text-red-300 rounded p-3 text-sm">
              {error}
            </div>
          )}

          {lastResult && (
            <pre className="bg-gray-800 text-gray-200 rounded p-3 text-xs overflow-auto max-h-48">
              {lastResult}
            </pre>
          )}

          {/* Add wallet */}
          <div className="flex gap-3 items-end">
            <label className="flex flex-col text-sm">
              <span className="text-gray-400 mb-1">Add Wallet</span>
              <input
                className="bg-gray-800 rounded px-3 py-1.5 w-96 text-sm font-mono"
                value={newWallet}
                onChange={(e) => setNewWallet(e.target.value)}
                placeholder="0x..."
                onKeyDown={(e) => e.key === "Enter" && addWallet()}
              />
            </label>
            <button
              className="bg-purple-700 hover:bg-purple-600 px-4 py-1.5 rounded text-sm font-medium disabled:opacity-50"
              onClick={addWallet}
              disabled={!secret || !newWallet.trim() || loading !== null}
            >
              {loading === "add" ? "Adding..." : "Add"}
            </button>
          </div>

          {/* Watchlist table */}
          <section>
            <h2 className="text-sm font-semibold text-gray-400 mb-2">
              Watchlist ({wallets.length})
            </h2>
            {wallets.length === 0 ? (
              <p className="text-gray-600 text-xs">No wallets in watchlist.</p>
            ) : (
              <div className="overflow-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-left text-gray-500 border-b border-gray-800">
                      <th className="py-2 px-2">Wallet</th>
                      <th className="py-2 px-2">Added</th>
                      <th className="py-2 px-2"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {wallets.map((w) => (
                      <tr
                        key={w.wallet}
                        className="border-b border-gray-800/50"
                      >
                        <td className="py-1.5 px-2 font-mono">
                          <Link
                            href={`/wallet/${w.wallet}`}
                            className="text-blue-400 hover:underline"
                          >
                            {w.wallet}
                          </Link>
                        </td>
                        <td className="py-1.5 px-2 text-gray-400">
                          {new Date(w.created_at).toLocaleDateString()}
                        </td>
                        <td className="py-1.5 px-2">
                          <button
                            className="text-red-400 hover:text-red-300 text-[10px]"
                            onClick={() => removeWallet(w.wallet)}
                            disabled={loading !== null}
                          >
                            Remove
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </main>
      </div>
    </>
  );
}
