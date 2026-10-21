import React, { useState, useMemo } from 'react';
import {
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  ArrowRight,
  ShieldCheck,
  Percent,
  Wallet,
  Receipt,
  Lock,
  Unlock,
  Calculator,
  ExternalLink,
  ChevronRight,
  Calendar,
  Filter,
  RotateCcw,
} from 'lucide-react';
import {
  InstrumentConfig,
  NextSessionForecast,
  PaperOrder,
  PlatformConfig,
  SessionStatus,
  TargetValidationResult,
} from '../types/platform';
import { DetailedMetricsAuditModal, MetricTabType } from './DetailedMetricsAuditModal';

interface WatchlistRow {
  instrument: InstrumentConfig;
  lastClose: number;
  vwap: number;
  rsi14: number;
  atr14: number;
  direction: 'LONG' | 'SHORT' | 'NO_TRADE';
  plannedEntry: number | null;
  plannedTarget: number | null;
  plannedStop: number | null;
  rewardRisk: number | null;
  score: number;
  validation: TargetValidationResult | null;
  forecast: NextSessionForecast | null;
}

interface Level1MarketOverviewProps {
  watchlist: WatchlistRow[];
  portfolioOrders: PaperOrder[];
  config: PlatformConfig;
  sessionStatus?: SessionStatus;
  enforceRealMarketHours?: boolean;
  onToggleEnforceMarketHours?: () => void;
  onSelectSymbol: (symbol: string) => void;
  onGoToLevel: (level: number) => void;
}

export const Level1MarketOverview: React.FC<Level1MarketOverviewProps> = ({
  watchlist,
  portfolioOrders,
  config,
  sessionStatus,
  enforceRealMarketHours = true,
  onToggleEnforceMarketHours,
  onSelectSymbol,
  onGoToLevel,
}) => {
  // Date filter state: 'ALL' or specific session date ('2026-10-19', etc.)
  const [selectedDate, setSelectedDate] = useState<string>('ALL');

  // Extract all unique dates from portfolio orders sorted newest first
  const availableDates = useMemo(() => {
    const datesSet = new Set<string>();
    portfolioOrders.forEach((o) => {
      const d = o.session_date || o.created_at.split('T')[0];
      if (d) datesSet.add(d);
    });
    return Array.from(datesSet).sort().reverse();
  }, [portfolioOrders]);

  // Filtered closed orders based on selected date
  const filteredClosedOrders = useMemo(() => {
    return portfolioOrders.filter((o) => {
      if (o.status !== 'CLOSED') return false;
      if (selectedDate === 'ALL') return true;
      const d = o.session_date || o.created_at.split('T')[0];
      return d === selectedDate;
    });
  }, [portfolioOrders, selectedDate]);

  const allClosedOrders = useMemo(
    () => portfolioOrders.filter((o) => o.status === 'CLOSED'),
    [portfolioOrders]
  );

  const startingCapital = config.risk_controls.starting_capital_inr;
  const netRealizedPnl = filteredClosedOrders.reduce((sum, o) => sum + o.net_pnl_inr, 0);
  const totalStatutoryCosts = filteredClosedOrders.reduce((sum, o) => sum + o.total_costs_inr, 0);

  // When 'ALL', Current Equity = Starting Capital + all closed PnL
  // When specific date, Current Equity shows base + cumulative up to that date (or starting capital + day's net)
  const currentEquity = startingCapital + netRealizedPnl;

  const wins = filteredClosedOrders.filter((o) => o.net_pnl_inr > 0);
  const losses = filteredClosedOrders.filter((o) => o.net_pnl_inr <= 0);
  const winRate = filteredClosedOrders.length > 0 ? (wins.length / filteredClosedOrders.length) * 100 : 0;

  const grossProfit = wins.reduce((sum, o) => sum + o.gross_pnl_inr, 0);
  const grossLoss = Math.abs(losses.reduce((sum, o) => sum + o.gross_pnl_inr, 0));
  const profitFactor = grossLoss > 0 ? grossProfit / grossLoss : grossProfit > 0 ? 99 : 0;

  const [auditModalOpen, setAuditModalOpen] = useState(false);
  const [selectedMetricTab, setSelectedMetricTab] = useState<MetricTabType>('EQUITY');

  const handleOpenAudit = (tab: MetricTabType) => {
    setSelectedMetricTab(tab);
    setAuditModalOpen(true);
  };

  return (
    <div className="space-y-6">
      {/* Portfolio Performance KPI Section Header & Date-Based Filter Toolbar */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-3.5 sm:p-4 space-y-3 shadow-sm">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-lg bg-sky-500/10 border border-sky-500/30 flex items-center justify-center text-sky-400 shrink-0">
              <Calculator className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-white tracking-wide">
                  Portfolio Performance Audit &amp; Executive KPIs
                </span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-slate-800 text-sky-300 border border-slate-700">
                  {selectedDate === 'ALL' ? 'ALL DATES (FULL HISTORY)' : `DATE: ${selectedDate}`}
                </span>
              </div>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Real-time tracking of portfolio equity, net realized P&amp;L, statutory friction, and win rate. Click any card for detailed audit.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Date Filter Dropdown */}
            <div className="flex items-center gap-1.5 bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs shadow-inner">
              <Calendar className="w-3.5 h-3.5 text-sky-400 shrink-0" />
              <span className="text-slate-400 font-medium text-[11px]">Filter Date:</span>
              <select
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="bg-transparent text-white font-mono text-xs focus:outline-none cursor-pointer pr-1"
                aria-label="Filter performance by date"
              >
                <option value="ALL" className="bg-slate-900 text-white">
                  All Session Dates ({allClosedOrders.length} closed trades)
                </option>
                {availableDates.map((d) => {
                  const count = portfolioOrders.filter(
                    (o) => o.status === 'CLOSED' && (o.session_date || o.created_at.split('T')[0]) === d
                  ).length;
                  return (
                    <option key={d} value={d} className="bg-slate-900 text-white">
                      {d} ({count} closed trades)
                    </option>
                  );
                })}
              </select>
            </div>

            {/* Quick Date Pills */}
            <div className="hidden xl:flex items-center gap-1">
              <button
                onClick={() => setSelectedDate('ALL')}
                className={`px-2.5 py-1.5 rounded text-[11px] font-semibold font-mono transition ${
                  selectedDate === 'ALL'
                    ? 'bg-sky-600 text-white shadow-xs'
                    : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800'
                }`}
                title="View performance across all dates"
              >
                All Dates
              </button>
              {availableDates.slice(0, 4).map((d) => {
                const isSelected = selectedDate === d;
                return (
                  <button
                    key={d}
                    onClick={() => setSelectedDate(d)}
                    className={`px-2 py-1.5 rounded text-[11px] font-mono transition ${
                      isSelected
                        ? 'bg-sky-600 text-white font-bold shadow-xs'
                        : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800'
                    }`}
                    title={`Filter by ${d}`}
                  >
                    {d.slice(5)}
                  </button>
                );
              })}
            </div>

            {/* Expand Detailed Audit Button */}
            <button
              onClick={() => handleOpenAudit('EQUITY')}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-sky-500/10 hover:bg-sky-500/20 text-sky-400 hover:text-sky-300 border border-sky-500/30 text-xs font-semibold transition shrink-0"
              title="Expand complete 6-card mathematical audit and closed trade verification ledger"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span>Expand Detailed Audit</span>
            </button>
          </div>
        </div>

        {/* Selected Date Context Tag */}
        {selectedDate !== 'ALL' && (
          <div className="flex items-center justify-between text-xs bg-sky-950/40 border border-sky-800/60 px-3 py-1.5 rounded-lg text-sky-200">
            <div className="flex items-center gap-2">
              <Filter className="w-3.5 h-3.5 text-sky-400 shrink-0" />
              <span>
                Filtered by Session Date: <strong className="text-white font-mono">{selectedDate}</strong> (
                {filteredClosedOrders.length} closed trades: {wins.length}W / {losses.length}L | Net P&amp;L:{' '}
                <strong className={netRealizedPnl >= 0 ? 'text-emerald-400 font-mono' : 'text-rose-400 font-mono'}>
                  {netRealizedPnl >= 0 ? '+₹' : '-₹'}{Math.abs(netRealizedPnl).toFixed(2)}
                </strong>
                )
              </span>
            </div>
            <button
              onClick={() => setSelectedDate('ALL')}
              className="text-[11px] text-sky-300 hover:text-white flex items-center gap-1 font-semibold transition underline cursor-pointer"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Reset to All Dates</span>
            </button>
          </div>
        )}
      </div>

      {/* Portfolio Performance KPI Cards - Interactive with Click to Expand */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {/* Card 1: Portfolio Equity */}
        <div
          onClick={() => handleOpenAudit('EQUITY')}
          className="bg-slate-900/90 hover:bg-slate-800/90 border border-slate-800 hover:border-sky-500/60 p-3.5 rounded-lg shadow-sm cursor-pointer transition group relative"
          title="Click to view detailed Portfolio Equity breakdown, margin usage & drawdown"
        >
          <div className="flex items-center justify-between text-slate-400 text-xs">
            <span className="group-hover:text-sky-300 transition">Portfolio Equity</span>
            <Wallet className="w-4 h-4 text-sky-400" />
          </div>
          <div className="text-xl font-bold font-mono text-white mt-1">
            ₹{currentEquity.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <div className="text-[11px] text-slate-400 mt-1 flex items-center justify-between">
            <span>
              {selectedDate === 'ALL'
                ? `Capital: ₹${(startingCapital / 100000).toFixed(1)} Lakh`
                : `Net: ${netRealizedPnl >= 0 ? '+₹' : '-₹'}${Math.abs(netRealizedPnl).toFixed(2)}`}
            </span>
            <span className="text-[10px] text-sky-400 font-mono opacity-0 group-hover:opacity-100 transition flex items-center">
              Audit <ChevronRight className="w-3 h-3" />
            </span>
          </div>
        </div>

        {/* Card 2: Net Realized P&L */}
        <div
          onClick={() => handleOpenAudit('PNL')}
          className="bg-slate-900/90 hover:bg-slate-800/90 border border-slate-800 hover:border-emerald-500/60 p-3.5 rounded-lg shadow-sm cursor-pointer transition group relative"
          title="Click to view complete P&L equation, gross win/loss breakdown, and instrument ledger"
        >
          <div className="flex items-center justify-between text-slate-400 text-xs">
            <span className="group-hover:text-emerald-300 transition">Net Realized P&amp;L</span>
            {netRealizedPnl >= 0 ? (
              <TrendingUp className="w-4 h-4 text-emerald-400" />
            ) : (
              <TrendingDown className="w-4 h-4 text-rose-400" />
            )}
          </div>
          <div
            className={`text-xl font-bold font-mono mt-1 ${
              netRealizedPnl >= 0 ? 'text-emerald-400' : 'text-rose-400'
            }`}
          >
            {netRealizedPnl >= 0 ? '+₹' : '-₹'}
            {Math.abs(netRealizedPnl).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <div className="text-[11px] text-slate-400 mt-1 flex items-center justify-between">
            <span>{selectedDate === 'ALL' ? 'Net of all charges' : `Session: ${selectedDate}`}</span>
            <span className="text-[10px] text-emerald-400 font-mono opacity-0 group-hover:opacity-100 transition flex items-center">
              Audit <ChevronRight className="w-3 h-3" />
            </span>
          </div>
        </div>

        {/* Card 3: Statutory Costs */}
        <div
          onClick={() => handleOpenAudit('STATUTORY')}
          className="bg-slate-900/90 hover:bg-slate-800/90 border border-slate-800 hover:border-amber-500/60 p-3.5 rounded-lg shadow-sm cursor-pointer transition group relative"
          title="Click to view itemized breakdown of STT, GST, SEBI charges, Stamp Duty & Brokerage"
        >
          <div className="flex items-center justify-between text-slate-400 text-xs">
            <span className="group-hover:text-amber-300 transition">Statutory Costs (₹)</span>
            <Receipt className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-xl font-bold font-mono text-amber-400 mt-1">
            ₹{totalStatutoryCosts.toFixed(2)}
          </div>
          <div className="text-[11px] text-slate-400 mt-1 flex items-center justify-between">
            <span>STT, GST, SEBI ({filteredClosedOrders.length} tr)</span>
            <span className="text-[10px] text-amber-400 font-mono opacity-0 group-hover:opacity-100 transition flex items-center">
              Breakdown <ChevronRight className="w-3 h-3" />
            </span>
          </div>
        </div>

        {/* Card 4: Closed Trades */}
        <div
          onClick={() => handleOpenAudit('CLOSED_TRADES')}
          className="bg-slate-900/90 hover:bg-slate-800/90 border border-slate-800 hover:border-indigo-500/60 p-3.5 rounded-lg shadow-sm cursor-pointer transition group relative"
          title="Click to view full closed trades ledger with execution details and trade-by-trade outcomes"
        >
          <div className="flex items-center justify-between text-slate-400 text-xs">
            <span className="group-hover:text-indigo-300 transition">Closed Trades</span>
            <ShieldCheck className="w-4 h-4 text-indigo-400" />
          </div>
          <div className="text-xl font-bold font-mono text-white mt-1">
            {filteredClosedOrders.length}
          </div>
          <div className="text-[11px] text-slate-400 mt-1 flex items-center justify-between">
            <span>{wins.length} W / {losses.length} L</span>
            <span className="text-[10px] text-indigo-400 font-mono opacity-0 group-hover:opacity-100 transition flex items-center">
              Ledger <ChevronRight className="w-3 h-3" />
            </span>
          </div>
        </div>

        {/* Card 5: Win Rate */}
        <div
          onClick={() => handleOpenAudit('WIN_RATE')}
          className="bg-slate-900/90 hover:bg-slate-800/90 border border-slate-800 hover:border-cyan-500/60 p-3.5 rounded-lg shadow-sm cursor-pointer transition group relative"
          title="Click to understand Conservative Same-Bar Rule, win streaks, and asset win distributions"
        >
          <div className="flex items-center justify-between text-slate-400 text-xs">
            <span className="group-hover:text-cyan-300 transition">Win Rate</span>
            <Percent className="w-4 h-4 text-cyan-400" />
          </div>
          <div className="text-xl font-bold font-mono text-white mt-1">
            {winRate.toFixed(1)}%
          </div>
          <div className="text-[11px] text-slate-400 mt-1 flex items-center justify-between">
            <span>Conservative same-bar rule</span>
            <span className="text-[10px] text-cyan-400 font-mono opacity-0 group-hover:opacity-100 transition flex items-center">
              Details <ChevronRight className="w-3 h-3" />
            </span>
          </div>
        </div>

        {/* Card 6: Profit Factor */}
        <div
          onClick={() => handleOpenAudit('PROFIT_FACTOR')}
          className="bg-slate-900/90 hover:bg-slate-800/90 border border-slate-800 hover:border-purple-500/60 p-3.5 rounded-lg shadow-sm cursor-pointer transition group relative"
          title="Click to inspect Gross Win / Gross Loss ratio, institutional tiers, and mathematical expectancy"
        >
          <div className="flex items-center justify-between text-slate-400 text-xs">
            <span className="group-hover:text-purple-300 transition">Profit Factor</span>
            <TrendingUp className="w-4 h-4 text-purple-400" />
          </div>
          <div className="text-xl font-bold font-mono text-white mt-1">
            {profitFactor.toFixed(2)}
          </div>
          <div className="text-[11px] text-slate-400 mt-1 flex items-center justify-between">
            <span>Gross Win / Gross Loss</span>
            <span className="text-[10px] text-purple-400 font-mono opacity-0 group-hover:opacity-100 transition flex items-center">
              Metrics <ChevronRight className="w-3 h-3" />
            </span>
          </div>
        </div>
      </div>

      {/* Real Market Status Card */}
      {sessionStatus && !sessionStatus.is_market_open && (
        <div className="bg-indigo-950/70 border border-indigo-800/80 rounded-lg p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
          <div className="flex items-start gap-2.5">
            <Lock className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
            <div>
              <div className="font-bold text-white flex items-center gap-1.5">
                <span>REAL NSE MARKET IS CURRENTLY CLOSED</span>
                <span className="px-1.5 py-0.2 rounded bg-indigo-900 text-indigo-200 text-[10px] font-mono">
                  {sessionStatus.phase}
                </span>
              </div>
              <p className="text-slate-300 text-[11px] mt-0.5 leading-relaxed">
                {enforceRealMarketHours ? (
                  <>
                    Prices are <strong>strictly locked to official Friday closing prices</strong> (Reliance: ₹1,211.20, HDFC Bank: ₹728.85, etc.). Auto-Run and 1m stepping are paused because the exchange is not operating.
                  </>
                ) : (
                  <>
                    <strong>Practice Replay is Active:</strong> You are simulating candle progression outside market hours for strategy testing.
                  </>
                )}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {onToggleEnforceMarketHours && (
              <button
                onClick={onToggleEnforceMarketHours}
                className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-[11px] font-semibold transition"
              >
                {enforceRealMarketHours ? 'Allow Practice Replay' : 'Lock to Real Market'}
              </button>
            )}
            <div className="text-[11px] text-right font-mono text-slate-400">
              Opens: <strong className="text-emerald-400">{sessionStatus.next_trading_day} 09:15 IST</strong>
            </div>
          </div>
        </div>
      )}

      {/* Probabilistic Disclaimer Notice */}
      <div className="bg-slate-900/60 border border-amber-900/50 rounded-lg p-3 flex items-start gap-3">
        <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
        <div className="text-xs text-slate-300 leading-relaxed">
          <strong className="text-amber-300">PROBABILISTIC FORECAST & DEMO NOTICE:</strong> All intraday entry/target/stop levels and next-session opening forecasts represent uncertain probabilistic estimates generated by multi-agent models. No target hit, breakout continuation, or profit is ever guaranteed. In accordance with platform governance, all candidate signals are validated against strict deterministic ≥ ₹3 displacement rules and minimum 1.50 Reward-to-Risk thresholds before execution.
        </div>
      </div>

      {/* Watchlist & Active Signals Matrix */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-lg overflow-hidden shadow-sm">
        <div className="px-4 py-3 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-bold text-white uppercase tracking-wider">
              Configured NSE Universe & Multi-Agent Signals
            </h2>
            <span className="text-xs bg-slate-800 text-slate-300 px-2 py-0.5 rounded">
              {watchlist.length} Stocks
            </span>
          </div>
          <div className="text-xs text-slate-400">
            Click any stock to open Level 2 Interactive Chart & Level 3 Agent Deep-Dive
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-950/70 border-b border-slate-800 text-slate-400 uppercase font-medium">
                <th className="py-2.5 px-3">Symbol</th>
                <th className="py-2.5 px-3">Sector</th>
                <th className="py-2.5 px-3 text-right">P₀ (Ref Close)</th>
                <th className="py-2.5 px-3 text-right">VWAP</th>
                <th className="py-2.5 px-3 text-right">RSI (14)</th>
                <th className="py-2.5 px-3 text-center">Active Signal</th>
                <th className="py-2.5 px-3 text-right">Entry (E)</th>
                <th className="py-2.5 px-3 text-right">Target (T)</th>
                <th className="py-2.5 px-3 text-right">Stop (S)</th>
                <th className="py-2.5 px-3 text-center">R : R</th>
                <th className="py-2.5 px-3 text-center">Next-Day Open Forecast</th>
                <th className="py-2.5 px-3 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-mono">
              {watchlist.map((row) => {
                const isLong = row.direction === 'LONG';
                const isShort = row.direction === 'SHORT';
                const fc = row.forecast;

                return (
                  <tr
                    key={row.instrument.instrument_id}
                    className="hover:bg-slate-800/40 transition group cursor-pointer"
                    onClick={() => {
                      onSelectSymbol(row.instrument.symbol);
                      onGoToLevel(2);
                    }}
                  >
                    <td className="py-2.5 px-3">
                      <div className="font-sans font-bold text-slate-100 group-hover:text-sky-400 transition">
                        {row.instrument.symbol}
                      </div>
                      <div className="text-[11px] font-sans text-slate-400 truncate max-w-[150px]">
                        {row.instrument.company_name}
                      </div>
                    </td>
                    <td className="py-2.5 px-3 font-sans text-slate-400">
                      <span className="px-1.5 py-0.5 rounded bg-slate-800 text-[10px]">
                        {row.instrument.sector.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-right font-medium text-white">
                      ₹{row.lastClose.toFixed(2)}
                    </td>
                    <td className="py-2.5 px-3 text-right text-slate-300">
                      ₹{row.vwap.toFixed(2)}
                    </td>
                    <td className="py-2.5 px-3 text-right">
                      <span
                        className={`font-semibold ${
                          row.rsi14 >= 60
                            ? 'text-emerald-400'
                            : row.rsi14 <= 40
                            ? 'text-rose-400'
                            : 'text-slate-300'
                        }`}
                      >
                        {row.rsi14.toFixed(1)}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-center">
                      <span
                        className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                          isLong
                            ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                            : isShort
                            ? 'bg-rose-950 text-rose-300 border border-rose-800'
                            : 'bg-slate-800 text-slate-400'
                        }`}
                      >
                        {row.direction}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-right text-sky-400 font-semibold">
                      {row.plannedEntry ? `₹${row.plannedEntry.toFixed(2)}` : '—'}
                    </td>
                    <td className="py-2.5 px-3 text-right text-emerald-400 font-semibold">
                      {row.plannedTarget ? `₹${row.plannedTarget.toFixed(2)}` : '—'}
                    </td>
                    <td className="py-2.5 px-3 text-right text-rose-400 font-semibold">
                      {row.plannedStop ? `₹${row.plannedStop.toFixed(2)}` : '—'}
                    </td>
                    <td className="py-2.5 px-3 text-center text-slate-300">
                      {row.rewardRisk ? `${row.rewardRisk.toFixed(2)}` : '—'}
                    </td>
                    <td className="py-2.5 px-3 text-center font-sans">
                      {fc ? (
                        <div className="text-[11px]">
                          <span className="font-mono text-sky-300 font-semibold">
                            ₹{fc.predicted_open_price.toFixed(2)}
                          </span>{' '}
                          <span
                            className={
                              fc.predicted_gap_inr >= 0
                                ? 'text-emerald-400 font-mono text-[10px]'
                                : 'text-rose-400 font-mono text-[10px]'
                            }
                          >
                            ({fc.predicted_gap_inr >= 0 ? '+' : ''}
                            {fc.predicted_gap_inr.toFixed(2)})
                          </span>
                        </div>
                      ) : (
                        <span className="text-slate-500">—</span>
                      )}
                    </td>
                    <td className="py-2.5 px-3 text-center" onClick={(e) => e.stopPropagation()}>
                      <button
                        onClick={() => {
                          onSelectSymbol(row.instrument.symbol);
                          onGoToLevel(2);
                        }}
                        className="px-2.5 py-1 rounded bg-slate-800 hover:bg-sky-600 text-slate-200 hover:text-white transition font-sans text-[11px] font-medium flex items-center gap-1 mx-auto"
                      >
                        Chart <ArrowRight className="w-3 h-3" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Detailed Metrics Audit & Expanded Breakdown Modal */}
      <DetailedMetricsAuditModal
        isOpen={auditModalOpen}
        onClose={() => setAuditModalOpen(false)}
        initialTab={selectedMetricTab}
        initialDate={selectedDate}
        orders={portfolioOrders}
        config={config}
      />
    </div>
  );
};
