"use client";

import { useState } from "react";

interface ApiResult {
  loading: boolean;
  data: unknown;
  error: string | null;
}

const initial: ApiResult = { loading: false, data: null, error: null };

export default function DebugPage() {
  // ── API test state ──
  const [limit, setLimit] = useState("50");
  const [offset, setOffset] = useState("0");
  const [closed, setClosed] = useState("true");
  const [marketsResult, setMarketsResult] = useState<ApiResult>(initial);

  const [conditionId, setConditionId] = useState("");
  const [marketResult, setMarketResult] = useState<ApiResult>(initial);

  // ── DB test state ──
  const [healthResult, setHealthResult] = useState<ApiResult>(initial);
  const [seedSecret, setSeedSecret] = useState("");
  const [seedResult, setSeedResult] = useState<ApiResult>(initial);

  // ── Compute stats state ──
  const [computeSecret, setComputeSecret] = useState("");
  const [computeResult, setComputeResult] = useState<ApiResult>(initial);

  // ── Leaderboard state ──
  const [lbThreshold, setLbThreshold] = useState("0.02");
  const [lbMinN, setLbMinN] = useState("20");
  const [lbOnlyFollowable, setLbOnlyFollowable] = useState(false);
  const [lbLimit, setLbLimit] = useState("50");
  const [lbResult, setLbResult] = useState<ApiResult>(initial);

  async function callApi(
    url: string,
    options: RequestInit = {}
  ): Promise<unknown> {
    const res = await fetch(url, options);
    const json = await res.json();
    if (!res.ok) throw new Error(json.error ?? `HTTP ${res.status}`);
    return json;
  }

  async function handleFetchMarkets() {
    setMarketsResult({ loading: true, data: null, error: null });
    try {
      const params = new URLSearchParams({ limit, offset, closed });
      const data = await callApi(`/api/debug/markets?${params}`);
      setMarketsResult({ loading: false, data, error: null });
    } catch (err) {
      setMarketsResult({
        loading: false,
        data: null,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  async function handleFetchMarket() {
    if (!conditionId.trim()) return;
    setMarketResult({ loading: true, data: null, error: null });
    try {
      const data = await callApi(
        `/api/debug/market/${encodeURIComponent(conditionId.trim())}`
      );
      setMarketResult({ loading: false, data, error: null });
    } catch (err) {
      setMarketResult({
        loading: false,
        data: null,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  async function handleDbHealth() {
    setHealthResult({ loading: true, data: null, error: null });
    try {
      const data = await callApi("/api/db/health");
      setHealthResult({ loading: false, data, error: null });
    } catch (err) {
      setHealthResult({
        loading: false,
        data: null,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  async function handleSeed() {
    if (!seedSecret.trim()) return;
    setSeedResult({ loading: true, data: null, error: null });
    try {
      const data = await callApi("/api/db/seed", {
        method: "POST",
        headers: { Authorization: `Bearer ${seedSecret.trim()}` },
      });
      setSeedResult({ loading: false, data, error: null });
    } catch (err) {
      setSeedResult({
        loading: false,
        data: null,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  async function handleComputeStats() {
    if (!computeSecret.trim()) return;
    setComputeResult({ loading: true, data: null, error: null });
    try {
      const data = await callApi("/api/cron/compute-stats", {
        method: "POST",
        headers: { Authorization: `Bearer ${computeSecret.trim()}` },
      });
      setComputeResult({ loading: false, data, error: null });
    } catch (err) {
      setComputeResult({
        loading: false,
        data: null,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  async function handleLeaderboard() {
    setLbResult({ loading: true, data: null, error: null });
    try {
      const params = new URLSearchParams({
        threshold: lbThreshold,
        minN: lbMinN,
        limit: lbLimit,
        ...(lbOnlyFollowable ? { onlyFollowable: "true" } : {}),
      });
      const data = await callApi(`/api/leaderboard?${params}`);
      setLbResult({ loading: false, data, error: null });
    } catch (err) {
      setLbResult({
        loading: false,
        data: null,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 p-6 max-w-5xl mx-auto">
      <h1 className="text-3xl font-bold mb-2">Polymarket Debug</h1>
      <p className="text-gray-400 mb-8 text-sm">
        Test API pubbliche Polymarket e connessione DB.
      </p>

      {/* ═══════ API TEST ═══════ */}
      <section className="mb-10">
        <h2 className="text-xl font-semibold mb-4 border-b border-gray-800 pb-2">
          API Test
        </h2>

        {/* Markets */}
        <div className="bg-gray-900 rounded-lg p-5 mb-5">
          <h3 className="font-medium mb-3">Fetch Markets (Gamma)</h3>
          <div className="flex flex-wrap gap-3 items-end mb-3">
            <label className="flex flex-col text-sm">
              <span className="text-gray-400 mb-1">Limit</span>
              <input
                className="bg-gray-800 rounded px-3 py-1.5 w-24 text-sm"
                value={limit}
                onChange={(e) => setLimit(e.target.value)}
              />
            </label>
            <label className="flex flex-col text-sm">
              <span className="text-gray-400 mb-1">Offset</span>
              <input
                className="bg-gray-800 rounded px-3 py-1.5 w-24 text-sm"
                value={offset}
                onChange={(e) => setOffset(e.target.value)}
              />
            </label>
            <label className="flex flex-col text-sm">
              <span className="text-gray-400 mb-1">Closed</span>
              <select
                className="bg-gray-800 rounded px-3 py-1.5 text-sm"
                value={closed}
                onChange={(e) => setClosed(e.target.value)}
              >
                <option value="true">true</option>
                <option value="false">false</option>
              </select>
            </label>
            <button
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-1.5 rounded text-sm font-medium disabled:opacity-50"
              onClick={handleFetchMarkets}
              disabled={marketsResult.loading}
            >
              {marketsResult.loading ? "Loading..." : "Fetch"}
            </button>
          </div>
          <ResultBox result={marketsResult} />
        </div>

        {/* Single Market */}
        <div className="bg-gray-900 rounded-lg p-5">
          <h3 className="font-medium mb-3">
            Fetch Market Detail (CLOB + Trades)
          </h3>
          <div className="flex gap-3 items-end mb-3">
            <label className="flex flex-col text-sm flex-1">
              <span className="text-gray-400 mb-1">Condition ID</span>
              <input
                className="bg-gray-800 rounded px-3 py-1.5 text-sm w-full font-mono"
                placeholder="0x..."
                value={conditionId}
                onChange={(e) => setConditionId(e.target.value)}
              />
            </label>
            <button
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-1.5 rounded text-sm font-medium disabled:opacity-50"
              onClick={handleFetchMarket}
              disabled={marketResult.loading || !conditionId.trim()}
            >
              {marketResult.loading ? "Loading..." : "Fetch"}
            </button>
          </div>
          <ResultBox result={marketResult} />
        </div>
      </section>

      {/* ═══════ DB TEST ═══════ */}
      <section>
        <h2 className="text-xl font-semibold mb-4 border-b border-gray-800 pb-2">
          DB Test
        </h2>

        {/* Health */}
        <div className="bg-gray-900 rounded-lg p-5 mb-5">
          <h3 className="font-medium mb-3">Database Health</h3>
          <button
            className="bg-green-600 hover:bg-green-700 text-white px-4 py-1.5 rounded text-sm font-medium disabled:opacity-50 mb-3"
            onClick={handleDbHealth}
            disabled={healthResult.loading}
          >
            {healthResult.loading ? "Checking..." : "Check Health"}
          </button>
          <ResultBox result={healthResult} />
        </div>

        {/* Seed */}
        <div className="bg-gray-900 rounded-lg p-5">
          <h3 className="font-medium mb-3">Seed Sample Data</h3>
          <div className="flex gap-3 items-end mb-3">
            <label className="flex flex-col text-sm flex-1">
              <span className="text-gray-400 mb-1">SEED_SECRET</span>
              <input
                className="bg-gray-800 rounded px-3 py-1.5 text-sm w-full font-mono"
                type="password"
                placeholder="your-seed-secret"
                value={seedSecret}
                onChange={(e) => setSeedSecret(e.target.value)}
              />
            </label>
            <button
              className="bg-amber-600 hover:bg-amber-700 text-white px-4 py-1.5 rounded text-sm font-medium disabled:opacity-50"
              onClick={handleSeed}
              disabled={seedResult.loading || !seedSecret.trim()}
            >
              {seedResult.loading ? "Seeding..." : "Seed DB"}
            </button>
          </div>
          <p className="text-xs text-gray-500 mb-3">
            Scarica 50 mercati closed, salva resolution per 10 e trades BUY per
            5. Richiede SEED_SECRET valido.
          </p>
          <ResultBox result={seedResult} />
        </div>
      </section>

      {/* ═══════ COMPUTE STATS ═══════ */}
      <section className="mb-10">
        <h2 className="text-xl font-semibold mb-4 border-b border-gray-800 pb-2">
          Compute Stats &amp; Profiles
        </h2>
        <div className="bg-gray-900 rounded-lg p-5">
          <h3 className="font-medium mb-3">Run compute-stats</h3>
          <p className="text-xs text-gray-500 mb-3">
            Calcola wallet_stats (per soglia 0.05/0.02/0.01) e wallet_profiles
            (follow_score, hedge_rate, late_sniping_rate). Richiede SEED_SECRET.
          </p>
          <div className="flex gap-3 items-end mb-3">
            <label className="flex flex-col text-sm flex-1">
              <span className="text-gray-400 mb-1">SEED_SECRET</span>
              <input
                className="bg-gray-800 rounded px-3 py-1.5 text-sm w-full font-mono"
                type="password"
                placeholder="your-seed-secret"
                value={computeSecret}
                onChange={(e) => setComputeSecret(e.target.value)}
              />
            </label>
            <button
              className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-1.5 rounded text-sm font-medium disabled:opacity-50"
              onClick={handleComputeStats}
              disabled={computeResult.loading || !computeSecret.trim()}
            >
              {computeResult.loading ? "Computing..." : "Compute"}
            </button>
          </div>
          <ResultBox result={computeResult} />
        </div>
      </section>

      {/* ═══════ LEADERBOARD ═══════ */}
      <section className="mb-10">
        <h2 className="text-xl font-semibold mb-4 border-b border-gray-800 pb-2">
          Leaderboard
        </h2>
        <div className="bg-gray-900 rounded-lg p-5">
          <div className="flex flex-wrap gap-3 items-end mb-3">
            <label className="flex flex-col text-sm">
              <span className="text-gray-400 mb-1">Threshold</span>
              <select
                className="bg-gray-800 rounded px-3 py-1.5 text-sm"
                value={lbThreshold}
                onChange={(e) => setLbThreshold(e.target.value)}
              >
                <option value="0.05">0.05</option>
                <option value="0.02">0.02</option>
                <option value="0.01">0.01</option>
              </select>
            </label>
            <label className="flex flex-col text-sm">
              <span className="text-gray-400 mb-1">Min N</span>
              <input
                className="bg-gray-800 rounded px-3 py-1.5 w-20 text-sm"
                value={lbMinN}
                onChange={(e) => setLbMinN(e.target.value)}
              />
            </label>
            <label className="flex flex-col text-sm">
              <span className="text-gray-400 mb-1">Limit</span>
              <input
                className="bg-gray-800 rounded px-3 py-1.5 w-20 text-sm"
                value={lbLimit}
                onChange={(e) => setLbLimit(e.target.value)}
              />
            </label>
            <label className="flex items-center gap-2 text-sm cursor-pointer pt-5">
              <input
                type="checkbox"
                className="accent-blue-500"
                checked={lbOnlyFollowable}
                onChange={(e) => setLbOnlyFollowable(e.target.checked)}
              />
              <span className="text-gray-400">Solo Followable</span>
            </label>
            <button
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-1.5 rounded text-sm font-medium disabled:opacity-50"
              onClick={handleLeaderboard}
              disabled={lbResult.loading}
            >
              {lbResult.loading ? "Loading..." : "Fetch Leaderboard"}
            </button>
          </div>
          <LeaderboardTable result={lbResult} />
        </div>
      </section>
    </div>
  );
}

function ResultBox({ result }: { result: ApiResult }) {
  if (!result.data && !result.error) return null;
  return (
    <pre
      className={`rounded p-3 text-xs overflow-auto max-h-96 ${
        result.error
          ? "bg-red-950 text-red-300 border border-red-800"
          : "bg-gray-800 text-gray-200"
      }`}
    >
      {result.error
        ? `Error: ${result.error}`
        : JSON.stringify(result.data, null, 2)}
    </pre>
  );
}

interface LeaderboardItem {
  wallet: string;
  followScore: number;
  isFollowable: boolean;
  n: number;
  wins: number;
  alphaz: number;
  hedgeRate: number;
  lateSnipingRate: number;
  lastTradeAt: string | null;
}

function LeaderboardTable({ result }: { result: ApiResult }) {
  if (result.error) {
    return (
      <pre className="rounded p-3 text-xs bg-red-950 text-red-300 border border-red-800">
        Error: {result.error}
      </pre>
    );
  }
  if (!result.data) return null;

  const data = result.data as { items?: LeaderboardItem[]; count?: number };
  const items = data.items ?? [];

  if (items.length === 0) {
    return (
      <p className="text-gray-500 text-sm">
        Nessun risultato. Hai eseguito compute-stats?
      </p>
    );
  }

  return (
    <div className="overflow-auto max-h-[32rem]">
      <p className="text-xs text-gray-500 mb-2">{data.count} risultati</p>
      <table className="w-full text-xs">
        <thead className="sticky top-0 bg-gray-900">
          <tr className="text-left text-gray-400 border-b border-gray-800">
            <th className="py-2 px-2">#</th>
            <th className="py-2 px-2">Wallet</th>
            <th className="py-2 px-2 text-right">Follow</th>
            <th className="py-2 px-2 text-center">OK?</th>
            <th className="py-2 px-2 text-right">N</th>
            <th className="py-2 px-2 text-right">Wins</th>
            <th className="py-2 px-2 text-right">AlphaZ</th>
            <th className="py-2 px-2 text-right">Hedge%</th>
            <th className="py-2 px-2 text-right">Late%</th>
            <th className="py-2 px-2">Last Trade</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item, i) => (
            <tr
              key={item.wallet}
              className="border-b border-gray-800/50 hover:bg-gray-800/40"
            >
              <td className="py-1.5 px-2 text-gray-500">{i + 1}</td>
              <td className="py-1.5 px-2 font-mono truncate max-w-[140px]">
                {item.wallet}
              </td>
              <td className="py-1.5 px-2 text-right font-semibold text-blue-400">
                {item.followScore}
              </td>
              <td className="py-1.5 px-2 text-center">
                {item.isFollowable ? (
                  <span className="text-green-400">Y</span>
                ) : (
                  <span className="text-gray-600">N</span>
                )}
              </td>
              <td className="py-1.5 px-2 text-right">{item.n}</td>
              <td className="py-1.5 px-2 text-right">{item.wins}</td>
              <td className="py-1.5 px-2 text-right">
                {typeof item.alphaz === "number"
                  ? item.alphaz.toFixed(2)
                  : item.alphaz}
              </td>
              <td className="py-1.5 px-2 text-right">
                {(item.hedgeRate * 100).toFixed(1)}%
              </td>
              <td className="py-1.5 px-2 text-right">
                {(item.lateSnipingRate * 100).toFixed(1)}%
              </td>
              <td className="py-1.5 px-2 text-gray-500">
                {item.lastTradeAt
                  ? new Date(item.lastTradeAt).toLocaleDateString()
                  : "—"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
