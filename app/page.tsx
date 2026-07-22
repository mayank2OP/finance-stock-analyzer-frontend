"use client";

import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";

type User = { id: number; username: string };
type Job = {
  job_id: string;
  ticker: string;
  status: "queued" | "running" | "completed" | "failed";
  stage: string;
  progress_percent: number;
  result?: Analysis;
  error?: string;
};
type News = { title: string; publisher?: string; url?: string; published_at?: string };
type Analysis = {
  ticker: string;
  action: "BUY" | "HOLD" | "SELL";
  risk: "LOW" | "MEDIUM" | "HIGH";
  summary: string;
  signal_interpretation?: string;
  strengths: string[];
  risks: string[];
  evidence_quality?: { score: number; meaning: string };
  metrics: Record<string, string | number | null>;
  company?: Record<string, string | number | null>;
  news: News[];
  proof?: {
    rule_version: string;
    score_total: number;
    score_calculation: Array<{
      rule: string;
      observed: unknown;
      condition: string;
      score_contribution: number;
    }>;
  };
  meta?: {
    as_of: string;
    source: string;
    source_url?: string;
    price_period?: { start: string; end: string; trading_days: number };
    cached: boolean;
  };
  disclaimer?: string;
};
type Backtest = {
  ticker: string;
  period: string;
  initial_capital: number;
  transaction_cost_bps: number;
  generated_at: string;
  start_date: string;
  end_date: string;
  methodology: Record<string, unknown>;
  proof?: {
    source: string;
    source_url: string;
    adjusted_prices: boolean;
    input_parameters: Record<string, unknown>;
    integrity_checks: Record<string, string>;
    formulas: Record<string, string>;
  };
  overview: {
    verdict: string;
    plain_english_summary: string;
    strategy_return_percent: number;
    benchmark_return_percent: number;
    difference_percentage_points: number;
    strategy_ending_value: number;
    benchmark_ending_value: number;
  };
  advanced?: Record<string, unknown>;
  disclaimer?: string;
};
type WatchItem = { id: number; ticker: string; created_at: string };
type SavedItem = { id: number; ticker: string; result: Analysis; created_at: string };
type Tab = "analyze" | "backtest" | "watchlist" | "saved";

function formatKey(key: string) {
  return key.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function formatValue(value: unknown) {
  if (value === null || value === undefined) return "Not available";
  if (typeof value === "number") return value.toLocaleString(undefined, { maximumFractionDigits: 4 });
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

function formatMoney(value: number) {
  return new Intl.NumberFormat(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 2 }).format(value);
}

function formatMetric(key: string, value: unknown) {
  if (value === null || value === undefined) return "Not available";
  if (typeof value !== "number") return formatValue(value);
  if (key.includes("percent")) return `${value.toLocaleString(undefined, { maximumFractionDigits: 2 })}%`;
  if (key.includes("value") || key.includes("capital")) return formatMoney(value);
  return value.toLocaleString(undefined, { maximumFractionDigits: 4 });
}

async function api<T>(path: string, options: RequestInit = {}, token?: string): Promise<T> {
  const headers = new Headers(options.headers);
  if (!(options.body instanceof URLSearchParams)) headers.set("Content-Type", "application/json");
  if (token) headers.set("Authorization", `Bearer ${token}`);
  const response = await fetch(`${API_URL}${path}`, { ...options, headers });
  const payload = response.status === 204 ? null : await response.json().catch(() => null);
  if (!response.ok) throw new Error(payload?.detail || "The request could not be completed.");
  return payload as T;
}

export default function Home() {
  const [token, setToken] = useState(() =>
    typeof window === "undefined" ? "" : sessionStorage.getItem("stock-analyser-token") || "",
  );
  const [user, setUser] = useState<User | null>(null);
  const [authMode, setAuthMode] = useState<"login" | "register">("login");
  const [authBusy, setAuthBusy] = useState(false);
  const [authError, setAuthError] = useState("");
  const [tab, setTab] = useState<Tab>("analyze");
  const [ticker, setTicker] = useState("AAPL");
  const [job, setJob] = useState<Job | null>(null);
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [analysisError, setAnalysisError] = useState("");
  const [backtest, setBacktest] = useState<Backtest | null>(null);
  const [backtestBusy, setBacktestBusy] = useState(false);
  const [backtestError, setBacktestError] = useState("");
  const [watchlist, setWatchlist] = useState<WatchItem[]>([]);
  const [saved, setSaved] = useState<SavedItem[]>([]);
  const [notice, setNotice] = useState("");
  const pollingRef = useRef(true);

  const authenticatedApi = useCallback(<T,>(path: string, options?: RequestInit) => api<T>(path, options, token), [token]);

  const loadPersonalData = useCallback(async (activeToken = token) => {
    if (!activeToken) return;
    const [watchResponse, savedResponse] = await Promise.all([
      api<{ data: WatchItem[] }>("/watchlist", {}, activeToken),
      api<{ data: SavedItem[] }>("/saved-analyses", {}, activeToken),
    ]);
    setWatchlist(watchResponse.data);
    setSaved(savedResponse.data);
  }, [token]);

  useEffect(() => {
    pollingRef.current = true;
    if (token) {
      Promise.all([
        api<{ data: User }>("/auth/me", {}, token),
        api<{ data: WatchItem[] }>("/watchlist", {}, token),
        api<{ data: SavedItem[] }>("/saved-analyses", {}, token),
      ]).then(([userResponse, watchResponse, savedResponse]) => {
        setUser(userResponse.data);
        setWatchlist(watchResponse.data);
        setSaved(savedResponse.data);
      }).catch(() => {
        sessionStorage.removeItem("stock-analyser-token");
        setToken("");
      });
    }
    return () => { pollingRef.current = false; };
  }, [token]);

  async function submitAuth(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setAuthBusy(true); setAuthError("");
    const form = new FormData(event.currentTarget);
    const username = String(form.get("username") || "").trim().toLowerCase();
    const password = String(form.get("password") || "");
    try {
      if (authMode === "register") {
        await api("/auth/register", { method: "POST", body: JSON.stringify({ username, password }) });
      }
      const body = new URLSearchParams({ username, password });
      const response = await api<{ access_token: string }>("/auth/token", { method: "POST", body });
      sessionStorage.setItem("stock-analyser-token", response.access_token);
      setToken(response.access_token);
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : "Authentication failed.");
    } finally { setAuthBusy(false); }
  }

  function logout() {
    sessionStorage.removeItem("stock-analyser-token");
    setToken(""); setUser(null); setAnalysis(null); setJob(null); setWatchlist([]); setSaved([]);
  }

  async function runAnalysis(event: FormEvent) {
    event.preventDefault();
    const symbol = ticker.trim().toUpperCase();
    setTicker(symbol); setAnalysis(null); setAnalysisError(""); setNotice("");
    try {
      const response = await authenticatedApi<{ data: Job }>("/analysis-jobs", { method: "POST", body: JSON.stringify({ ticker: symbol }) });
      setJob(response.data);
      let current = response.data;
      while (pollingRef.current && current.status !== "completed" && current.status !== "failed") {
        await new Promise((resolve) => setTimeout(resolve, 2200));
        const update = await authenticatedApi<{ data: Job }>(`/analysis-jobs/${current.job_id}`);
        current = update.data;
        setJob(current);
      }
      if (current.status === "completed" && current.result) {
        setAnalysis(current.result);
        try {
          await authenticatedApi("/saved-analyses", {
            method: "POST",
            body: JSON.stringify({ ticker: current.result.ticker, result: current.result }),
          });
          await loadPersonalData();
          setNotice("Analysis completed and saved automatically.");
        } catch {
          setNotice("Analysis completed, but it could not be added to saved research.");
        }
      }
      if (current.status === "failed") setAnalysisError(current.error || "The analysis failed.");
    } catch (error) {
      setJob(null);
      setAnalysisError(error instanceof Error ? error.message : "Analysis failed.");
    }
  }

  async function addToWatchlist(symbol = ticker) {
    try {
      await authenticatedApi("/watchlist", { method: "POST", body: JSON.stringify({ ticker: symbol }) });
      await loadPersonalData(); setNotice(`${symbol.toUpperCase()} added to your watchlist.`);
    } catch (error) { setNotice(error instanceof Error ? error.message : "Could not update watchlist."); }
  }

  async function removeWatchlist(symbol: string) {
    await authenticatedApi(`/watchlist/${symbol}`, { method: "DELETE" });
    await loadPersonalData();
  }

  async function runBacktest(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBacktestBusy(true); setBacktestError("");
    const form = new FormData(event.currentTarget);
    try {
      const response = await authenticatedApi<{ data: Backtest }>("/backtest", {
        method: "POST",
        body: JSON.stringify({
          ticker: String(form.get("ticker") || "AAPL").toUpperCase(),
          period: form.get("period"), initial_capital: Number(form.get("capital")),
          transaction_cost_bps: 5, horizon_days: 20, include_equity_curve: false,
        }),
      });
      setBacktest(response.data);
    } catch (error) { setBacktestError(error instanceof Error ? error.message : "Backtest failed."); }
    finally { setBacktestBusy(false); }
  }

  const isAnalyzing = job?.status === "queued" || job?.status === "running";
  const actionClass = analysis ? analysis.action.toLowerCase() : "";
  const memberSince = useMemo(() => user ? `Signed in as ${user.username}` : "", [user]);

  if (!user) {
    return (
      <main className="auth-shell">
        <section className="auth-story">
          <div className="brand"><span className="brand-mark">SP</span><span>StockPilot</span><small className="ai-badge">AI</small></div>
          <div className="auth-copy">
            <p className="eyebrow">EVIDENCE-FIRST STOCK RESEARCH</p>
            <h1>Navigate markets with <em>evidence.</em></h1>
            <p>StockPilot combines specialized AI research agents with reproducible market signals—so every conclusion can be inspected, challenged and understood.</p>
          </div>
          <div className="trust-row"><span>Live evidence</span><span>3 specialist AI agents</span><span>Auditable calculations</span></div>
        </section>
        <section className="auth-panel">
          <div className="auth-card">
            <p className="eyebrow">WELCOME</p>
            <h2>{authMode === "login" ? "Sign in to your workspace" : "Create your workspace"}</h2>
            <p className="muted">Use any demo username and an 8+ character password.</p>
            <form onSubmit={submitAuth}>
              <label>Username<input name="username" minLength={3} required autoComplete="username" placeholder="mayank" /></label>
              <label>Password<input name="password" type="password" minLength={8} required autoComplete={authMode === "login" ? "current-password" : "new-password"} placeholder="At least 8 characters" /></label>
              {authError && <p className="error-message">{authError}</p>}
              <button className="primary-button" disabled={authBusy}>{authBusy ? "Please wait…" : authMode === "login" ? "Sign in" : "Create account"}</button>
            </form>
            <button className="text-button" onClick={() => { setAuthMode(authMode === "login" ? "register" : "login"); setAuthError(""); }}>
              {authMode === "login" ? "New here? Create an account" : "Already registered? Sign in"}
            </button>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="app-shell">
      <aside className="sidebar">
        <div className="brand"><span className="brand-mark">SP</span><span>StockPilot</span><small className="ai-badge">AI</small></div>
        <nav aria-label="Main navigation">
          {(["analyze", "backtest", "watchlist", "saved"] as Tab[]).map((item) => (
            <button key={item} className={tab === item ? "active" : ""} aria-current={tab === item ? "page" : undefined} onClick={() => setTab(item)}>
              <span className="nav-dot" />{item === "saved" ? "Saved research" : formatKey(item)}
            </button>
          ))}
        </nav>
        <div className="sidebar-note"><strong>Evidence-grounded AI</strong><span>Agents interpret verified facts. Signals remain reproducible and are not personalized advice.</span></div>
        <button className="profile-button" onClick={logout}><span className="avatar">{user.username[0]?.toUpperCase()}</span><span><strong>{user.username}</strong><small>Sign out</small></span></button>
      </aside>

      <section className="workspace">
        <header className="topbar"><div><p className="eyebrow">STOCK ANALYSER</p><h2>{tab === "analyze" ? "Research workspace" : formatKey(tab)}</h2></div><span className="session-pill">{memberSince}</span></header>

        {tab === "analyze" && <>
          <section className="hero-search">
            <div><p className="eyebrow">AI-ASSISTED RESEARCH</p><h1>Your co-pilot for stock research.</h1><p>Enter a ticker. Reproducible rules calculate the signal while Research, Risk and Advisor agents examine the evidence from different angles.</p></div>
            <form className="ticker-form" onSubmit={runAnalysis}>
              <input aria-label="Stock ticker" value={ticker} onChange={(event) => setTicker(event.target.value)} maxLength={15} placeholder="AAPL" />
              <button className="primary-button" disabled={isAnalyzing}>{isAnalyzing ? "Agents are reviewing…" : "Analyze stock"}</button>
            </form>
            <div className="quick-tickers"><span>Try</span>{["AAPL", "MSFT", "NVDA", "TSLA"].map((symbol) => <button key={symbol} onClick={() => setTicker(symbol)}>{symbol}</button>)}</div>
            <div className="agent-strip"><span><b>01</b> Research Agent<small>Finds relevant evidence</small></span><span><b>02</b> Risk Agent<small>Challenges the signal</small></span><span><b>03</b> Advisor Agent<small>Balances the conclusion</small></span></div>
          </section>

          {isAnalyzing && <section className="progress-card">
            <div className="progress-head"><span className="pulse"/><div><strong>Analyzing {job?.ticker}</strong><p>{job?.stage === "queued" ? "Preparing verified market evidence" : "Research, Risk and Advisor agents are reviewing the evidence"}</p></div><b>{job?.progress_percent || 0}%</b></div>
            <div className="progress-track"><span style={{ width: `${Math.max(job?.progress_percent || 0, 8)}%` }} /></div>
            <div className="progress-steps"><span className="done">Market data</span><span className={job?.status === "running" ? "current" : ""}>Agent review</span><span>Verification</span></div>
          </section>}
          {analysisError && <div className="error-card"><strong>Analysis could not be completed</strong><span>{analysisError}</span></div>}

          {!analysis && !isAnalyzing && !analysisError && <section className="empty-insight">
            <div className="orb"><span>MA</span><span>RSI</span><span>AI</span></div><h3>Clarity before conviction</h3><p>StockPilot shows the signal, risk, strongest evidence, AI review and exact calculation trail behind every result.</p>
          </section>}

          {analysis && <section className="results">
            <div className="result-heading"><div><p className="eyebrow">AI REVIEW COMPLETE</p><h2>{analysis.company?.name ? String(analysis.company.name) : analysis.ticker} <span>{analysis.ticker}</span></h2><p>{analysis.meta?.as_of ? `Evidence collected ${new Date(analysis.meta.as_of).toLocaleString()}` : "Latest available evidence"}</p></div><div className="result-actions"><span className="autosave-pill">Saved automatically</span><button onClick={() => addToWatchlist(analysis.ticker)}>+ Watchlist</button></div></div>
            {notice && <div className="notice">{notice}</div>}
            <div className="signal-grid">
              <article className={`signal-card ${actionClass}`}><span>Technical signal</span><strong>{analysis.action}</strong><small>Rules-based, not personalized advice</small></article>
              <article className="signal-card"><span>Risk level</span><strong>{analysis.risk}</strong><small>Based on historical volatility</small></article>
              <article className="signal-card"><span>Evidence quality</span><strong>{analysis.evidence_quality?.score ?? "—"}<i>/100</i></strong><small>Completeness, not profit probability</small></article>
            </div>
            <article className="summary-card"><div className="summary-label">BALANCED VIEW</div><h3>{analysis.signal_interpretation || analysis.summary}</h3><p>{analysis.summary}</p></article>
            <div className="evidence-grid">
              <article><h3><span className="positive-dot"/>What supports the signal</h3>{analysis.strengths.map((item) => <p key={item}>{item}</p>)}</article>
              <article><h3><span className="warning-dot"/>What could go wrong</h3>{analysis.risks.map((item) => <p key={item}>{item}</p>)}</article>
            </div>
            <details className="detail-panel" open><summary>Market metrics <span>Live calculated values</span></summary><div className="metric-grid">{Object.entries(analysis.metrics).map(([key, value]) => <div key={key}><span>{formatKey(key)}</span><strong>{formatValue(value)}</strong></div>)}</div></details>
            <details className="detail-panel"><summary>Calculation proof <span>{analysis.proof?.rule_version || "Rules"}</span></summary><div className="proof-list">{analysis.proof?.score_calculation.map((rule) => <div key={rule.rule}><span><strong>{formatKey(rule.rule)}</strong><small>{rule.condition}</small></span><b className={rule.score_contribution >= 0 ? "positive-text" : "negative-text"}>{rule.score_contribution > 0 ? "+" : ""}{rule.score_contribution}</b></div>)}</div></details>
            <details className="detail-panel"><summary>Selected news <span>{analysis.news.length} attributable sources</span></summary><div className="news-list">{analysis.news.map((item) => <a key={`${item.url}-${item.title}`} href={item.url} target="_blank" rel="noreferrer"><span><strong>{item.title}</strong><small>{item.publisher}{item.published_at ? ` · ${new Date(item.published_at).toLocaleDateString()}` : ""}</small></span><b>Open ↗</b></a>)}</div></details>
            <p className="disclaimer">{analysis.disclaimer}</p>
          </section>}
        </>}

        {tab === "backtest" && <section className="section-page">
          <div className="page-intro"><p className="eyebrow">HISTORICAL SIMULATION</p><h1>Test the rules against the past.</h1><p>Compare the technical strategy with simply buying and holding the same stock.</p></div>
          <form className="backtest-form" onSubmit={runBacktest}><label>Ticker<input name="ticker" defaultValue={ticker} required /></label><label>Period<select name="period" defaultValue="5y"><option>1y</option><option>2y</option><option>5y</option><option>10y</option></select></label><label>Starting capital<input name="capital" type="number" min="100" defaultValue="10000" /></label><button className="primary-button" disabled={backtestBusy}>{backtestBusy ? "Running…" : "Run backtest"}</button></form>
          {backtestError && <div className="error-card">{backtestError}</div>}
          {backtest && <div className="backtest-result">
            <div className="verdict"><div><p className="eyebrow">AUDITED RESULT</p><h2>{backtest.overview.verdict}</h2><p>{backtest.overview.plain_english_summary}</p></div><span className="verified-badge">Calculation proof included</span></div>
            <div className="comparison-grid"><article><span>Strategy return</span><strong>{backtest.overview.strategy_return_percent}%</strong><small>{formatMoney(backtest.overview.strategy_ending_value)}</small></article><article><span>Buy & hold</span><strong>{backtest.overview.benchmark_return_percent}%</strong><small>{formatMoney(backtest.overview.benchmark_ending_value)}</small></article><article><span>Difference</span><strong>{backtest.overview.difference_percentage_points} pts</strong><small>Strategy minus benchmark</small></article></div>
            <div className="audit-line"><span><small>Test window</small><b>{backtest.start_date} to {backtest.end_date}</b></span><span><small>Starting capital</small><b>{formatMoney(backtest.initial_capital)}</b></span><span><small>Transaction cost</small><b>{backtest.transaction_cost_bps} bps per position change</b></span><span><small>Generated</small><b>{new Date(backtest.generated_at).toLocaleString()}</b></span></div>
            <details className="detail-panel" open><summary>Performance evidence <span>Strategy and benchmark</span></summary><div className="advanced-groups">{Object.entries(backtest.advanced || {}).map(([group, values]) => <section key={group}><h4>{formatKey(group)}</h4><div className="metric-grid">{typeof values === "object" && values !== null ? Object.entries(values).map(([key, value]) => <div key={key}><span>{formatKey(key)}</span><strong>{formatMetric(key, value)}</strong></div>) : <div><strong>{formatValue(values)}</strong></div>}</div></section>)}</div></details>
            {backtest.proof && <details className="detail-panel" open><summary>Why these numbers are trustworthy <span>Source, assumptions and formulas</span></summary><div className="proof-section"><div className="proof-source"><span>Market-data source</span><a href={backtest.proof.source_url} target="_blank" rel="noreferrer">{backtest.proof.source} ↗</a><small>Adjusted daily prices: {backtest.proof.adjusted_prices ? "Yes" : "No"}</small></div><h4>Integrity checks</h4>{Object.entries(backtest.proof.integrity_checks).map(([key, value]) => <p key={key}><b>{formatKey(key)}</b><span>{value}</span></p>)}<h4>Calculation formulas</h4>{Object.entries(backtest.proof.formulas).map(([key, value]) => <p key={key}><b>{formatKey(key)}</b><span>{value}</span></p>)}</div></details>}
            <p className="disclaimer">{backtest.disclaimer}</p>
          </div>}
        </section>}

        {tab === "watchlist" && <section className="section-page"><div className="page-intro"><p className="eyebrow">YOUR SHORTLIST</p><h1>Stocks worth watching.</h1><p>Keep frequently researched companies one click away.</p></div>{watchlist.length ? <div className="list-grid">{watchlist.map((item) => <article key={item.id}><div><span className="ticker-badge">{item.ticker[0]}</span><span><strong>{item.ticker}</strong><small>Added {new Date(item.created_at).toLocaleDateString()}</small></span></div><div><button onClick={() => { setTicker(item.ticker); setTab("analyze"); }}>Research</button><button className="danger-button" onClick={() => removeWatchlist(item.ticker)}>Remove</button></div></article>)}</div> : <div className="empty-state"><h3>Your watchlist is empty</h3><p>Run an analysis, then choose “Watchlist” to add a ticker.</p><button onClick={() => setTab("analyze")}>Research a stock</button></div>}</section>}

        {tab === "saved" && <section className="section-page"><div className="page-intro"><p className="eyebrow">RESEARCH HISTORY</p><h1>Return to earlier decisions.</h1><p>Saved analyses preserve the evidence and result from that point in time.</p></div>{saved.length ? <div className="saved-grid">{saved.map((item) => <button key={item.id} onClick={() => { setAnalysis(item.result); setTicker(item.ticker); setTab("analyze"); }}><span><b>{item.ticker}</b><small>{new Date(item.created_at).toLocaleString()}</small></span><strong className={(item.result?.action || "hold").toLowerCase()}>{item.result?.action || "Saved"}</strong><p>{item.result?.summary || "Open saved analysis"}</p></button>)}</div> : <div className="empty-state"><h3>No saved research yet</h3><p>Complete an analysis and save it to build your research history.</p><button onClick={() => setTab("analyze")}>Start an analysis</button></div>}</section>}
      </section>
    </main>
  );
}
