import React, { useState, useMemo } from 'react';
import {
  FileText,
  ShieldCheck,
  TrendingUp,
  TrendingDown,
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle,
  HelpCircle,
  Receipt,
  Scale,
  Calendar,
  Brain,
  Sparkles,
  ArrowRight,
  Database,
  Search,
  Filter,
  Layers,
  ChevronDown,
  ChevronUp,
  BookOpen,
  ArrowUpRight,
  ArrowDownRight,
  Activity,
  BarChart2,
  Calculator,
  ExternalLink,
} from 'lucide-react';
import { FailureAnalysis, PaperOrder, PlatformConfig } from '../types/platform';
import { getAllLearnedRulesFromStorage } from '../services/learningStore';
import { DetailedMetricsAuditModal, MetricTabType } from './DetailedMetricsAuditModal';
import { FailureLessonModal } from './FailureLessonModal';

interface Level4PaperTradingProps {
  orders: PaperOrder[];
  config: PlatformConfig;
}

export const Level4PaperTrading: React.FC<Level4PaperTradingProps> = ({ orders, config }) => {
  // Navigation tabs between the 3 sections + Self-Learning Store
  const [activeSection, setActiveSection] = useState<
    'INTRADAY' | 'NEXT_DAY' | 'PREV_VS_NEXT_OPEN' | 'LEARNING_STORE'
  >('INTRADAY');

  // Date-based selection
  const [selectedDate, setSelectedDate] = useState<string>('ALL');

  // Outcome filter
  const [outcomeFilter, setOutcomeFilter] = useState<'ALL' | 'SUCCESS' | 'FAILURE' | 'ACTIVE'>('ALL');

  // Selected order for detailed deep-dive modal/drawer
  const [selectedOrder, setSelectedOrder] = useState<PaperOrder | null>(orders[0] || null);

  // Lesson modal state for pop-up failure root-cause analysis
  const [lessonModalOrder, setLessonModalOrder] = useState<PaperOrder | null>(null);

  // Failure category filter in the learning store
  const [ruleCategoryFilter, setRuleCategoryFilter] = useState<string>('ALL');
  const [ruleSearchTerm, setRuleSearchTerm] = useState<string>('');

  // 6-KPI Detailed Metrics Audit Modal
  const [auditModalOpen, setAuditModalOpen] = useState(false);
  const [auditTab, setAuditTab] = useState<MetricTabType>('EQUITY');

  // Retrieve all stored learned rules from persistent storage
  const storedLearnedRules = useMemo(() => {
    return getAllLearnedRulesFromStorage();
  }, [orders]);

  // Extract all unique dates from paper orders for the Date Switcher
  const availableDates = useMemo(() => {
    const datesSet = new Set<string>();
    orders.forEach((o) => {
      const d = o.session_date || o.created_at.split('T')[0];
      if (d) datesSet.add(d);
    });
    return Array.from(datesSet).sort().reverse();
  }, [orders]);

  // Separate orders into Section 1 (Intraday) and Section 2 (Next Day Gap)
  const intradayOrders = useMemo(() => {
    return orders.filter((o) => (o.prediction_type || 'INTRADAY') === 'INTRADAY');
  }, [orders]);

  const nextDayOrders = useMemo(() => {
    return orders.filter((o) => o.prediction_type === 'NEXT_DAY_OPENING');
  }, [orders]);

  // Current active section list
  const currentSectionOrders = activeSection === 'INTRADAY' ? intradayOrders : nextDayOrders;

  // Filter current section by date and outcome
  const filteredOrders = useMemo(() => {
    return currentSectionOrders.filter((o) => {
      // Date filter
      const orderDate = o.session_date || o.created_at.split('T')[0];
      if (selectedDate !== 'ALL' && orderDate !== selectedDate) return false;

      // Outcome filter
      const isSuccess =
        o.outcome_status === 'SUCCESS_TARGET_HIT' ||
        (o.exit_reason === 'TAKE_PROFIT_HIT' && o.net_pnl_inr > 0) ||
        o.gap_direction_matched === true;
      const isFailure =
        o.outcome_status === 'FAILURE_STOP_HIT' ||
        (o.status === 'CLOSED' && !isSuccess) ||
        o.gap_direction_matched === false;
      const isActive = o.status === 'PENDING' || o.status === 'FILLED';

      if (outcomeFilter === 'SUCCESS') return isSuccess;
      if (outcomeFilter === 'FAILURE') return isFailure;
      if (outcomeFilter === 'ACTIVE') return isActive;

      return true;
    });
  }, [currentSectionOrders, selectedDate, outcomeFilter]);

  // Performance calculations respecting selectedDate
  const dateScopedOrders = useMemo(() => {
    return orders.filter((o) => {
      if (selectedDate === 'ALL') return true;
      const orderDate = o.session_date || o.created_at.split('T')[0];
      return orderDate === selectedDate;
    });
  }, [orders, selectedDate]);

  const totalClosed = dateScopedOrders.filter((o) => o.status === 'CLOSED').length;
  const totalSuccess = dateScopedOrders.filter(
    (o) =>
      o.outcome_status === 'SUCCESS_TARGET_HIT' ||
      (o.exit_reason === 'TAKE_PROFIT_HIT' && o.net_pnl_inr > 0) ||
      (o.prediction_type === 'NEXT_DAY_OPENING' && o.gap_direction_matched === true)
  ).length;
  const totalFailure = dateScopedOrders.filter(
    (o) =>
      o.outcome_status === 'FAILURE_STOP_HIT' ||
      (o.status === 'CLOSED' && o.exit_reason !== 'TAKE_PROFIT_HIT' && !o.gap_direction_matched)
  ).length;
  const winRate = totalClosed > 0 ? (totalSuccess / totalClosed) * 100 : 0;
  const totalNetPnl = dateScopedOrders.reduce((sum, o) => sum + (o.net_pnl_inr || 0), 0);

  // Filtered learned rules for Section 4
  const filteredRules = useMemo(() => {
    return storedLearnedRules.filter((r) => {
      if (ruleCategoryFilter !== 'ALL' && r.category !== ruleCategoryFilter) return false;
      if (ruleSearchTerm.trim()) {
        const term = ruleSearchTerm.toLowerCase();
        const matchesSymbol = r.symbol.toLowerCase().includes(term);
        const matchesRule = r.learned_rule.toLowerCase().includes(term);
        const matchesCause = r.root_cause.toLowerCase().includes(term);
        return matchesSymbol || matchesRule || matchesCause;
      }
      return true;
    });
  }, [storedLearnedRules, ruleCategoryFilter, ruleSearchTerm]);

  // Next-Day comparison metrics for Section 3
  const nextDayComparisonList = useMemo(() => {
    return nextDayOrders.filter((o) => {
      const orderDate = o.session_date || o.created_at.split('T')[0];
      if (selectedDate !== 'ALL' && orderDate !== selectedDate) return false;
      return true;
    });
  }, [nextDayOrders, selectedDate]);

  const gapStats = useMemo(() => {
    if (nextDayComparisonList.length === 0) {
      return { total: 0, matched: 0, hitRate: 0, avgGapPct: 0, avgErrorInr: 0 };
    }
    const total = nextDayComparisonList.length;
    const matched = nextDayComparisonList.filter(
      (o) => o.gap_direction_matched || o.outcome_status === 'SUCCESS_TARGET_HIT'
    ).length;
    const hitRate = (matched / total) * 100;
    const avgGapPct =
      nextDayComparisonList.reduce((sum, o) => sum + Math.abs(o.actual_gap_pct || 0.45), 0) / total;
    const avgErrorInr =
      nextDayComparisonList.reduce((sum, o) => sum + (o.gap_error_inr || 0.8), 0) / total;
    return { total, matched, hitRate, avgGapPct, avgErrorInr };
  }, [nextDayComparisonList]);

  return (
    <div className="space-y-6">
      {/* ============================================================== */}
      {/* TOP HEADER: DATE-BASED TRACKING & SELF-LEARNING GATE STATUS   */}
      {/* ============================================================== */}
      <div className="bg-slate-900/90 border border-slate-800 p-4 rounded-xl flex flex-col lg:flex-row lg:items-center justify-between gap-4 shadow-sm">
        <div>
          <div className="flex items-center gap-2">
            <Scale className="w-5 h-5 text-sky-400" />
            <h2 className="text-base font-bold text-white tracking-tight">
              Date-Based Paper Trading &amp; Self-Learning Execution Ledger
            </h2>
          </div>
          <p className="text-xs text-slate-400 mt-1 max-w-2xl">
            Tracks intraday predictions continuously until Target or Stop-Loss, and verifies Next-Day opening prices against previous day close. Trade failures trigger automated root-cause diagnosis and store persistent self-learning rules.
          </p>
        </div>

        {/* Global Summary Metrics + Audit Drilldown Button */}
        <div className="flex flex-wrap items-center gap-2.5 font-mono text-xs">
          <button
            onClick={() => {
              setAuditTab('WIN_RATE');
              setAuditModalOpen(true);
            }}
            className="p-2 rounded bg-slate-950 hover:bg-slate-800/80 border border-slate-800 hover:border-emerald-500/50 text-center min-w-[90px] transition cursor-pointer group"
            title="Click to view detailed Win Rate & Conservative Same-Bar Rule audit"
          >
            <div className="text-[10px] text-slate-400 uppercase group-hover:text-emerald-300">Success Rate</div>
            <div className="text-sm font-bold text-emerald-400 mt-0.5">
              {winRate.toFixed(1)}% <span className="text-[10px] text-slate-400">({totalSuccess}/{totalClosed})</span>
            </div>
          </button>

          <button
            onClick={() => {
              setAuditTab('CLOSED_TRADES');
              setAuditModalOpen(true);
            }}
            className="p-2 rounded bg-slate-950 hover:bg-slate-800/80 border border-slate-800 hover:border-rose-500/50 text-center min-w-[90px] transition cursor-pointer group"
            title="Click to inspect closed trade ledger and failures"
          >
            <div className="text-[10px] text-slate-400 uppercase group-hover:text-rose-300">Failures</div>
            <div className="text-sm font-bold text-rose-400 mt-0.5">{totalFailure} Logged</div>
          </button>

          <button
            onClick={() => {
              setAuditTab('PNL');
              setAuditModalOpen(true);
            }}
            className="p-2 rounded bg-slate-950 hover:bg-slate-800/80 border border-slate-800 hover:border-sky-500/50 text-center min-w-[100px] transition cursor-pointer group"
            title="Click to inspect complete Realized Net P&L mathematical formula & statutory costs"
          >
            <div className="text-[10px] text-slate-400 uppercase group-hover:text-sky-300">Realized Net P&amp;L</div>
            <div className={`text-sm font-bold mt-0.5 ${totalNetPnl >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
              {totalNetPnl >= 0 ? '+₹' : '-₹'}{Math.abs(totalNetPnl).toFixed(2)}
            </div>
          </button>

          <div className="p-2 rounded bg-slate-950 border border-slate-800 text-center min-w-[110px]">
            <div className="text-[10px] text-purple-300 uppercase flex items-center justify-center gap-1">
              <Brain className="w-3 h-3 text-purple-400" />
              <span>Learned Rules</span>
            </div>
            <div className="text-sm font-bold text-white mt-0.5">
              {storedLearnedRules.length} Stored
            </div>
          </div>

          <button
            onClick={() => {
              setAuditTab('EQUITY');
              setAuditModalOpen(true);
            }}
            className="px-3 py-2 rounded-lg bg-sky-500/10 hover:bg-sky-500/20 text-sky-400 hover:text-sky-300 border border-sky-500/30 text-xs font-semibold flex items-center gap-1.5 transition ml-auto font-sans"
            title="Inspect all 6 KPI cards with full data and mathematical formulas"
          >
            <Calculator className="w-3.5 h-3.5" />
            <span>Detailed 6-KPI Audit</span>
          </button>
        </div>
      </div>

      {/* ============================================================== */}
      {/* 3 MAIN SECTIONS SWITCHER TABS + SELF-LEARNING STORE TAB        */}
      {/* ============================================================== */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-950/80 p-2 rounded-xl border border-slate-800">
        {/* Section Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
          {/* Section 1: Intraday Within Market Time */}
          <button
            onClick={() => {
              setActiveSection('INTRADAY');
              if (intradayOrders.length > 0) setSelectedOrder(intradayOrders[0]);
            }}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-bold transition ${
              activeSection === 'INTRADAY'
                ? 'bg-sky-600 text-white shadow-md'
                : 'text-slate-400 hover:text-white hover:bg-slate-900 border border-slate-800'
            }`}
          >
            <Clock className="w-4 h-4 text-sky-300" />
            <span>1. Intraday (Market-Time) Predictions</span>
            <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-slate-950 text-sky-300 font-mono">
              {intradayOrders.length}
            </span>
          </button>

          {/* Section 2: Next-Day Starting Predictions */}
          <button
            onClick={() => {
              setActiveSection('NEXT_DAY');
              if (nextDayOrders.length > 0) setSelectedOrder(nextDayOrders[0]);
            }}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-bold transition ${
              activeSection === 'NEXT_DAY'
                ? 'bg-purple-600 text-white shadow-md'
                : 'text-slate-400 hover:text-white hover:bg-slate-900 border border-slate-800'
            }`}
          >
            <TrendingUp className="w-4 h-4 text-purple-300" />
            <span>2. Next-Day Starting (Opening Gap) Predictions</span>
            <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-slate-950 text-purple-300 font-mono">
              {nextDayOrders.length}
            </span>
          </button>

          {/* Section 3: Previous Day Closing vs Next Opening Price */}
          <button
            onClick={() => setActiveSection('PREV_VS_NEXT_OPEN')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-bold transition ${
              activeSection === 'PREV_VS_NEXT_OPEN'
                ? 'bg-amber-600 text-white shadow-md'
                : 'text-slate-400 hover:text-white hover:bg-slate-900 border border-slate-800'
            }`}
          >
            <Activity className="w-4 h-4 text-amber-300" />
            <span>3. Prev Day Close vs Next Open Analysis</span>
            <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-slate-950 text-amber-300 font-mono">
              {nextDayOrders.length} Pairs
            </span>
          </button>

          {/* Section 4: Failure Post-Mortem & Self-Learning Memory Store */}
          <button
            onClick={() => setActiveSection('LEARNING_STORE')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-bold transition ${
              activeSection === 'LEARNING_STORE'
                ? 'bg-emerald-600 text-white shadow-md'
                : 'text-slate-400 hover:text-white hover:bg-slate-900 border border-slate-800'
            }`}
          >
            <Brain className="w-4 h-4 text-emerald-300" />
            <span>Failure Explanations &amp; Self-Learning Store</span>
            <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-slate-950 text-emerald-300 font-mono">
              {storedLearnedRules.length} Rules
            </span>
          </button>
        </div>

        {/* Date Filter Dropdown */}
        {activeSection !== 'LEARNING_STORE' && (
          <div className="flex items-center gap-2 text-xs">
            <Calendar className="w-3.5 h-3.5 text-sky-400" />
            <span className="text-slate-400 text-[11px] font-semibold">Filter Date:</span>
            <select
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="bg-slate-900 border border-slate-700 text-slate-200 text-xs rounded-md px-2.5 py-1 font-mono focus:outline-none focus:border-sky-500"
            >
              <option value="ALL">All Session Dates (Last 30 Days)</option>
              {availableDates.map((d) => (
                <option key={d} value={d}>
                  {d} ({orders.filter((o) => (o.session_date || o.created_at.split('T')[0]) === d).length} trades)
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* ============================================================== */}
      {/* SECTION 1: INTRADAY PREDICTIONS (TARGET & STOP LOSS TRACKING)   */}
      {/* ============================================================== */}
      {activeSection === 'INTRADAY' && (
        <div className="space-y-4">
          {/* Outcome Filter Toolbar */}
          <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2">
              <span className="text-slate-400 font-semibold text-[11px]">Outcome Filter:</span>
              {(['ALL', 'SUCCESS', 'FAILURE', 'ACTIVE'] as const).map((filter) => {
                const isActive = outcomeFilter === filter;
                return (
                  <button
                    key={filter}
                    onClick={() => setOutcomeFilter(filter)}
                    className={`px-3 py-1 rounded-md text-xs font-semibold transition ${
                      isActive
                        ? 'bg-slate-200 text-slate-900 font-bold'
                        : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
                    }`}
                  >
                    {filter === 'ALL' && 'All Outcomes'}
                    {filter === 'SUCCESS' && '🟢 Success (Target Hit)'}
                    {filter === 'FAILURE' && '🔴 Failure (Stop Loss Hit)'}
                    {filter === 'ACTIVE' && '🟡 Active / Tracking'}
                  </button>
                );
              })}
            </div>

            <div className="text-[11px] text-slate-400 font-mono">
              Showing <strong>{filteredOrders.length}</strong> of {currentSectionOrders.length} intraday predictions
              {selectedDate !== 'ALL' && ` for ${selectedDate}`}
            </div>
          </div>

          {/* Intraday Orders Table */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-xl overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-950/80 border-b border-slate-800 text-slate-400 uppercase font-medium text-[11px]">
                    <th className="py-2.5 px-3">Session Date / Time</th>
                    <th className="py-2.5 px-3">Symbol</th>
                    <th className="py-2.5 px-3">Direction</th>
                    <th className="py-2.5 px-3 text-right">Planned Entry</th>
                    <th className="py-2.5 px-3 text-right text-emerald-400">Target</th>
                    <th className="py-2.5 px-3 text-right text-rose-400">Stop Loss</th>
                    <th className="py-2.5 px-3 text-center">Status</th>
                    <th className="py-2.5 px-3 text-center">Tracking Excursion (MFE / MAE)</th>
                    <th className="py-2.5 px-3 text-right">Net P&amp;L</th>
                    <th className="py-2.5 px-3 text-center">Outcome &amp; Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-mono">
                  {filteredOrders.length === 0 ? (
                    <tr>
                      <td colSpan={10} className="py-8 text-center text-slate-400 font-sans">
                        No intraday predictions matching selected date or outcome filter.
                      </td>
                    </tr>
                  ) : (
                    filteredOrders.map((order) => {
                      const isSelected = selectedOrder?.order_id === order.order_id;
                      const isSuccess =
                        order.outcome_status === 'SUCCESS_TARGET_HIT' ||
                        (order.exit_reason === 'TAKE_PROFIT_HIT' && order.net_pnl_inr > 0);
                      const isFailure =
                        order.outcome_status === 'FAILURE_STOP_HIT' ||
                        (order.status === 'CLOSED' && !isSuccess);
                      const isFilled = order.status === 'FILLED';

                      return (
                        <tr
                          key={order.order_id}
                          onClick={() => setSelectedOrder(order)}
                          className={`cursor-pointer transition ${
                            isSelected
                              ? 'bg-sky-950/40 ring-1 ring-sky-500/40'
                              : 'hover:bg-slate-850/60'
                          }`}
                        >
                          {/* Date & Time */}
                          <td className="py-2.5 px-3">
                            <div className="font-bold text-slate-200">
                              {order.session_date || order.created_at.split('T')[0]}
                            </div>
                            <div className="text-[10px] text-slate-400">
                              {new Date(order.created_at).toLocaleTimeString('en-IN', {
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </div>
                          </td>

                          {/* Symbol */}
                          <td className="py-2.5 px-3 font-bold text-white">
                            <span>{order.symbol}</span>
                            <div className="text-[9px] text-slate-400 font-normal">Intraday 1m</div>
                          </td>

                          {/* Direction */}
                          <td className="py-2.5 px-3">
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                order.direction === 'LONG'
                                  ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                                  : 'bg-rose-950 text-rose-300 border border-rose-800'
                              }`}
                            >
                              {order.direction}
                            </span>
                          </td>

                          {/* Planned Entry */}
                          <td className="py-2.5 px-3 text-right text-slate-200">
                            ₹{order.planned_entry.toFixed(2)}
                          </td>

                          {/* Target */}
                          <td className="py-2.5 px-3 text-right text-emerald-400 font-semibold">
                            ₹{order.planned_target.toFixed(2)}
                          </td>

                          {/* Stop Loss */}
                          <td className="py-2.5 px-3 text-right text-rose-400 font-semibold">
                            ₹{order.planned_stop.toFixed(2)}
                          </td>

                          {/* Status */}
                          <td className="py-2.5 px-3 text-center">
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                order.status === 'CLOSED'
                                  ? 'bg-slate-800 text-slate-300'
                                  : isFilled
                                  ? 'bg-sky-950 text-sky-300 border border-sky-800 animate-pulse'
                                  : 'bg-amber-950 text-amber-300 border border-amber-800'
                              }`}
                            >
                              {order.status}
                            </span>
                          </td>

                          {/* MFE / MAE Excursion Tracking */}
                          <td className="py-2.5 px-3 text-center text-[11px]">
                            <span className="text-emerald-400 font-semibold">+₹{order.mfe_inr.toFixed(1)}</span>
                            <span className="text-slate-500 mx-1">/</span>
                            <span className="text-rose-400 font-semibold">-₹{order.mae_inr.toFixed(1)}</span>
                          </td>

                          {/* Net P&L */}
                          <td
                            className={`py-2.5 px-3 text-right font-bold ${
                              order.net_pnl_inr > 0
                                ? 'text-emerald-400'
                                : order.net_pnl_inr < 0
                                ? 'text-rose-400'
                                : 'text-slate-400'
                            }`}
                          >
                            {order.net_pnl_inr >= 0 ? '+₹' : '-₹'}{Math.abs(order.net_pnl_inr).toFixed(2)}
                          </td>

                          {/* Outcome & Action */}
                          <td className="py-2.5 px-3 text-center">
                            {isSuccess ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-800 text-[10px] font-bold">
                                <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                                <span>SUCCESS: TARGET HIT</span>
                              </span>
                            ) : isFailure ? (
                              <div className="flex items-center justify-center gap-1.5">
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-rose-950 text-rose-300 border border-rose-800 text-[10px] font-bold">
                                  <XCircle className="w-3 h-3 text-rose-400" />
                                  <span>FAILURE: STOP HIT</span>
                                </span>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setSelectedOrder(order);
                                    setLessonModalOrder(order);
                                  }}
                                  className="px-2 py-0.5 rounded bg-purple-950 hover:bg-purple-900 text-purple-200 text-[10px] font-sans font-semibold border border-purple-700/80 hover:border-purple-500 transition shadow-sm active:scale-95 flex items-center gap-1"
                                  title="Open Failure Root Cause Diagnosis and Self-Learning Lesson"
                                >
                                  <Brain className="w-3 h-3 text-purple-400" />
                                  <span>View Lesson ➔</span>
                                </button>
                              </div>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-amber-950 text-amber-300 border border-amber-800 text-[10px]">
                                <Clock className="w-3 h-3 animate-spin text-amber-400" />
                                <span>ACTIVE TRACKING</span>
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* SECTION 2: NEXT-DAY STARTING (OPENING GAP) PREDICTIONS         */}
      {/* (NO TARGET/STOP-LOSS! REPLACED WITH PREV CLOSE & NEXT OPEN)   */}
      {/* ============================================================== */}
      {activeSection === 'NEXT_DAY' && (
        <div className="space-y-4">
          {/* Section explanation notice */}
          <div className="bg-purple-950/30 border border-purple-800/60 p-3 rounded-xl flex items-center justify-between flex-wrap gap-2 text-xs">
            <div className="flex items-center gap-2 text-purple-200">
              <TrendingUp className="w-4 h-4 text-purple-400 shrink-0" />
              <span>
                <strong>Next-Day Opening Price Predictions</strong>: Evaluates opening gap direction and opening price level by comparing <strong>Previous Day's Closing Price</strong> against the <strong>Next Session Opening Price</strong>.
              </span>
            </div>
            <span className="text-[10px] font-mono text-purple-300 bg-purple-950 px-2 py-0.5 rounded border border-purple-800">
              PREV CLOSE ➔ NEXT OPEN DYNAMICS
            </span>
          </div>

          {/* Outcome Filter Toolbar */}
          <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2">
              <span className="text-slate-400 font-semibold text-[11px]">Outcome Filter:</span>
              {(['ALL', 'SUCCESS', 'FAILURE', 'ACTIVE'] as const).map((filter) => {
                const isActive = outcomeFilter === filter;
                return (
                  <button
                    key={filter}
                    onClick={() => setOutcomeFilter(filter)}
                    className={`px-3 py-1 rounded-md text-xs font-semibold transition ${
                      isActive
                        ? 'bg-purple-200 text-purple-950 font-bold'
                        : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
                    }`}
                  >
                    {filter === 'ALL' && 'All Predictions'}
                    {filter === 'SUCCESS' && '🟢 Success (Gap Direction Hit)'}
                    {filter === 'FAILURE' && '🔴 Failure (Gap Inversion / Missed)'}
                    {filter === 'ACTIVE' && '🟡 Pending Open'}
                  </button>
                );
              })}
            </div>

            <div className="text-[11px] text-slate-400 font-mono">
              Showing <strong>{filteredOrders.length}</strong> of {currentSectionOrders.length} next-day predictions
              {selectedDate !== 'ALL' && ` for ${selectedDate}`}
            </div>
          </div>

          {/* Next-Day Predictions Table with PREVIOUS DAY CLOSE and NEXT OPENING PRICE */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-xl overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-950/80 border-b border-slate-800 text-slate-400 uppercase font-medium text-[11px]">
                    <th className="py-2.5 px-3">Session Date</th>
                    <th className="py-2.5 px-3">Symbol</th>
                    <th className="py-2.5 px-3">Predicted Gap Bias</th>
                    <th className="py-2.5 px-3 text-right text-sky-400">Previous Day Close</th>
                    <th className="py-2.5 px-3 text-right text-purple-400">Predicted Open</th>
                    <th className="py-2.5 px-3 text-right text-amber-400">Actual Next Open</th>
                    <th className="py-2.5 px-3 text-center">Actual Gap (₹ &amp; %)</th>
                    <th className="py-2.5 px-3 text-center">Prediction Error</th>
                    <th className="py-2.5 px-3 text-right">Net Return</th>
                    <th className="py-2.5 px-3 text-center">Prediction Outcome &amp; Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-mono">
                  {filteredOrders.length === 0 ? (
                    <tr>
                      <td colSpan={10} className="py-8 text-center text-slate-400 font-sans">
                        No next-day predictions matching selected date or outcome filter.
                      </td>
                    </tr>
                  ) : (
                    filteredOrders.map((order) => {
                      const isSelected = selectedOrder?.order_id === order.order_id;
                      const prevClose = order.prev_day_close_price || order.planned_entry;
                      const predOpen = order.predicted_next_open_price || order.planned_target;
                      const actualOpen = order.actual_next_open_price || order.exit_fill_price || prevClose;
                      const predGap = order.predicted_gap_inr || (predOpen - prevClose);
                      const actualGap = order.actual_gap_inr || (actualOpen - prevClose);
                      const actualGapPct = order.actual_gap_pct || ((actualGap / prevClose) * 100);
                      const errorInr = order.gap_error_inr || Math.abs(actualOpen - predOpen);

                      const isSuccess =
                        order.gap_direction_matched !== undefined
                          ? order.gap_direction_matched
                          : order.outcome_status === 'SUCCESS_TARGET_HIT';
                      const isFailure = !isSuccess && order.status === 'CLOSED';

                      return (
                        <tr
                          key={order.order_id}
                          onClick={() => setSelectedOrder(order)}
                          className={`cursor-pointer transition ${
                            isSelected
                              ? 'bg-purple-950/40 ring-1 ring-purple-500/40'
                              : 'hover:bg-slate-850/60'
                          }`}
                        >
                          {/* Date */}
                          <td className="py-2.5 px-3">
                            <div className="font-bold text-slate-200">
                              {order.session_date || order.created_at.split('T')[0]}
                            </div>
                            <div className="text-[10px] text-slate-400">Pre-Session Forecast</div>
                          </td>

                          {/* Symbol */}
                          <td className="py-2.5 px-3 font-bold text-white">
                            <span>{order.symbol}</span>
                            <div className="text-[9px] text-slate-400 font-normal">Next-Day Gap</div>
                          </td>

                          {/* Gap Direction Bias */}
                          <td className="py-2.5 px-3">
                            <span
                              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold ${
                                order.direction === 'LONG' || predGap > 0
                                  ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                                  : 'bg-rose-950 text-rose-300 border border-rose-800'
                              }`}
                            >
                              {order.direction === 'LONG' || predGap > 0 ? (
                                <>
                                  <ArrowUpRight className="w-3 h-3 text-emerald-400" />
                                  <span>GAP UP</span>
                                </>
                              ) : (
                                <>
                                  <ArrowDownRight className="w-3 h-3 text-rose-400" />
                                  <span>GAP DOWN</span>
                                </>
                              )}
                            </span>
                          </td>

                          {/* Previous Day Closing Price */}
                          <td className="py-2.5 px-3 text-right font-bold text-sky-300">
                            ₹{prevClose.toFixed(2)}
                          </td>

                          {/* Predicted Next Opening Price */}
                          <td className="py-2.5 px-3 text-right text-purple-300 font-semibold">
                            ₹{predOpen.toFixed(2)}
                            <div className="text-[9px] text-purple-400 font-normal">
                              ({predGap > 0 ? '+' : ''}₹{predGap.toFixed(2)})
                            </div>
                          </td>

                          {/* Actual Next Opening Price */}
                          <td className="py-2.5 px-3 text-right text-amber-300 font-bold">
                            ₹{actualOpen.toFixed(2)}
                          </td>

                          {/* Actual Gap (₹ & %) */}
                          <td className="py-2.5 px-3 text-center text-[11px]">
                            <span
                              className={`font-semibold ${
                                actualGap > 0 ? 'text-emerald-400' : actualGap < 0 ? 'text-rose-400' : 'text-slate-400'
                              }`}
                            >
                              {actualGap > 0 ? '+' : ''}₹{actualGap.toFixed(2)} ({actualGapPct > 0 ? '+' : ''}
                              {actualGapPct.toFixed(2)}%)
                            </span>
                          </td>

                          {/* Deviation / Error */}
                          <td className="py-2.5 px-3 text-center text-[11px]">
                            <span
                              className={`px-1.5 py-0.5 rounded text-[10px] font-mono ${
                                errorInr <= 1.5
                                  ? 'bg-emerald-950/80 text-emerald-300 border border-emerald-800/80'
                                  : errorInr <= 4.0
                                  ? 'bg-amber-950/80 text-amber-300 border border-amber-800/80'
                                  : 'bg-rose-950/80 text-rose-300 border border-rose-800/80'
                              }`}
                            >
                              ±₹{errorInr.toFixed(2)}
                            </span>
                          </td>

                          {/* Net Return */}
                          <td
                            className={`py-2.5 px-3 text-right font-bold ${
                              order.net_pnl_inr > 0
                                ? 'text-emerald-400'
                                : order.net_pnl_inr < 0
                                ? 'text-rose-400'
                                : 'text-slate-400'
                            }`}
                          >
                            {order.net_pnl_inr >= 0 ? '+₹' : '-₹'}{Math.abs(order.net_pnl_inr).toFixed(2)}
                          </td>

                          {/* Outcome & Action */}
                          <td className="py-2.5 px-3 text-center">
                            {isSuccess ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-800 text-[10px] font-bold">
                                <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                                <span>SUCCESS: GAP HIT</span>
                              </span>
                            ) : isFailure ? (
                              <div className="flex items-center justify-center gap-1.5">
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-rose-950 text-rose-300 border border-rose-800 text-[10px] font-bold">
                                  <XCircle className="w-3 h-3 text-rose-400" />
                                  <span>FAILURE: MISSED GAP</span>
                                </span>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setSelectedOrder(order);
                                    setLessonModalOrder(order);
                                  }}
                                  className="px-2 py-0.5 rounded bg-purple-950 hover:bg-purple-900 text-purple-200 text-[10px] font-sans font-semibold border border-purple-700/80 hover:border-purple-500 transition shadow-sm active:scale-95 flex items-center gap-1"
                                  title="Open Gap Inversion Diagnosis and Self-Learning Lesson"
                                >
                                  <Brain className="w-3 h-3 text-purple-400" />
                                  <span>View Lesson ➔</span>
                                </button>
                              </div>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-amber-950 text-amber-300 border border-amber-800 text-[10px]">
                                <Clock className="w-3 h-3 animate-spin text-amber-400" />
                                <span>AWAITING 09:15 OPEN</span>
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* SECTION 3: PREV DAY CLOSE VS NEXT OPENING PRICE ANALYSIS       */}
      {/* ============================================================== */}
      {activeSection === 'PREV_VS_NEXT_OPEN' && (
        <div className="space-y-4">
          {/* Overview Banner */}
          <div className="bg-slate-900/90 border border-slate-800 p-4 rounded-xl flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-sm">
            <div>
              <div className="flex items-center gap-2">
                <BarChart2 className="w-5 h-5 text-amber-400" />
                <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                  Previous Day Close ➔ Next Day Open Discrepancy &amp; Gap Matrix
                </h3>
              </div>
              <p className="text-xs text-slate-400 mt-1 max-w-2xl">
                Cross-sectional analysis comparing each stock's EOD 15:30 IST closing price with next morning's 09:15 IST opening print across all 30 days. Verifies predictive model accuracy against overnight gap dynamics.
              </p>
            </div>

            {/* Gap Performance KPI cards */}
            <div className="flex flex-wrap items-center gap-2 font-mono text-xs">
              <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800 text-center min-w-[100px]">
                <div className="text-[10px] text-slate-400 uppercase">Direction Accuracy</div>
                <div className="text-sm font-bold text-emerald-400 mt-0.5">
                  {gapStats.hitRate.toFixed(1)}%
                </div>
                <div className="text-[9px] text-slate-400">
                  ({gapStats.matched}/{gapStats.total} sessions)
                </div>
              </div>

              <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800 text-center min-w-[100px]">
                <div className="text-[10px] text-slate-400 uppercase">Avg Gap Magnitude</div>
                <div className="text-sm font-bold text-amber-400 mt-0.5">
                  {gapStats.avgGapPct.toFixed(2)}%
                </div>
                <div className="text-[9px] text-slate-400">Overnight move</div>
              </div>

              <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800 text-center min-w-[100px]">
                <div className="text-[10px] text-slate-400 uppercase">Mean Price Error</div>
                <div className="text-sm font-bold text-sky-400 mt-0.5">
                  ₹{gapStats.avgErrorInr.toFixed(2)}
                </div>
                <div className="text-[9px] text-slate-400">Model vs Actual</div>
              </div>
            </div>
          </div>

          {/* Detailed Prev Close vs Next Open Table */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-xl overflow-hidden shadow-sm">
            <div className="p-3 bg-slate-950/80 border-b border-slate-800 flex items-center justify-between">
              <span className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
                <Database className="w-3.5 h-3.5 text-sky-400" />
                <span>Historical Sessions: Prev Close vs Next Opening Price</span>
              </span>
              <span className="text-[11px] font-mono text-slate-400">
                {nextDayComparisonList.length} Sessions Analyzed
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-950 border-b border-slate-800 text-slate-400 uppercase font-medium text-[11px]">
                    <th className="py-2.5 px-3">Session Date</th>
                    <th className="py-2.5 px-3">Stock Symbol</th>
                    <th className="py-2.5 px-3 text-right text-sky-400">Prev Day Close (15:30)</th>
                    <th className="py-2.5 px-3 text-right text-purple-400">Model Predicted Open</th>
                    <th className="py-2.5 px-3 text-center">Predicted Gap</th>
                    <th className="py-2.5 px-3 text-right text-amber-400">Actual Market Open (09:15)</th>
                    <th className="py-2.5 px-3 text-center">Actual Gap Realized</th>
                    <th className="py-2.5 px-3 text-center">Gap Variance (Error)</th>
                    <th className="py-2.5 px-3 text-center">Verification Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-mono">
                  {nextDayComparisonList.map((order) => {
                    const prevClose = order.prev_day_close_price || order.planned_entry;
                    const predOpen = order.predicted_next_open_price || order.planned_target;
                    const actualOpen = order.actual_next_open_price || order.exit_fill_price || prevClose;
                    const predGap = order.predicted_gap_inr || (predOpen - prevClose);
                    const predGapPct = order.predicted_gap_pct || ((predGap / prevClose) * 100);
                    const actualGap = order.actual_gap_inr || (actualOpen - prevClose);
                    const actualGapPct = order.actual_gap_pct || ((actualGap / prevClose) * 100);
                    const errorInr = order.gap_error_inr || Math.abs(actualOpen - predOpen);
                    const isSuccess =
                      order.gap_direction_matched !== undefined
                        ? order.gap_direction_matched
                        : order.outcome_status === 'SUCCESS_TARGET_HIT';

                    return (
                      <tr
                        key={order.order_id}
                        onClick={() => {
                          setSelectedOrder(order);
                          setActiveSection('NEXT_DAY');
                        }}
                        className="hover:bg-slate-850/60 cursor-pointer transition"
                      >
                        {/* Session Date */}
                        <td className="py-2.5 px-3 font-semibold text-slate-200">
                          {order.session_date || order.created_at.split('T')[0]}
                        </td>

                        {/* Stock Symbol */}
                        <td className="py-2.5 px-3 font-bold text-white">
                          {order.symbol}
                        </td>

                        {/* Prev Day Close Price */}
                        <td className="py-2.5 px-3 text-right text-sky-300 font-bold">
                          ₹{prevClose.toFixed(2)}
                        </td>

                        {/* Model Predicted Open Price */}
                        <td className="py-2.5 px-3 text-right text-purple-300 font-semibold">
                          ₹{predOpen.toFixed(2)}
                        </td>

                        {/* Predicted Gap */}
                        <td className="py-2.5 px-3 text-center text-[11px]">
                          <span
                            className={predGap >= 0 ? 'text-emerald-400 font-semibold' : 'text-rose-400 font-semibold'}
                          >
                            {predGap >= 0 ? '+' : ''}₹{predGap.toFixed(2)} ({predGapPct >= 0 ? '+' : ''}
                            {predGapPct.toFixed(2)}%)
                          </span>
                        </td>

                        {/* Actual Market Open Price */}
                        <td className="py-2.5 px-3 text-right text-amber-300 font-bold">
                          ₹{actualOpen.toFixed(2)}
                        </td>

                        {/* Actual Gap Realized */}
                        <td className="py-2.5 px-3 text-center text-[11px]">
                          <span
                            className={
                              actualGap >= 0 ? 'text-emerald-400 font-bold' : 'text-rose-400 font-bold'
                            }
                          >
                            {actualGap >= 0 ? '+' : ''}₹{actualGap.toFixed(2)} ({actualGapPct >= 0 ? '+' : ''}
                            {actualGapPct.toFixed(2)}%)
                          </span>
                        </td>

                        {/* Gap Variance / Error */}
                        <td className="py-2.5 px-3 text-center text-[11px]">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-mono ${
                              errorInr <= 1.5
                                ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                                : errorInr <= 4.0
                                ? 'bg-amber-950 text-amber-300 border border-amber-800'
                                : 'bg-rose-950 text-rose-300 border border-rose-800'
                            }`}
                          >
                            ±₹{errorInr.toFixed(2)}
                          </span>
                        </td>

                        {/* Verification Status */}
                        <td className="py-2.5 px-3 text-center">
                          {isSuccess ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-800 text-[10px] font-bold">
                              <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                              <span>ACCURATE GAP</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-rose-950 text-rose-300 border border-rose-800 text-[10px] font-bold">
                              <XCircle className="w-3 h-3 text-rose-400" />
                              <span>GAP INVERSION</span>
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* SELECTED ORDER DEEP-DIVE: AUDIT & FAILURE EXPLANATION           */}
      {/* (CUSTOMIZED SEPARATELY FOR INTRADAY VS NEXT-DAY OPENING!)       */}
      {/* ============================================================== */}
      {selectedOrder && activeSection !== 'LEARNING_STORE' && activeSection !== 'PREV_VS_NEXT_OPEN' && (
        <div className="bg-slate-900/95 border border-slate-800 rounded-xl p-4 space-y-4 shadow-lg">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-3">
            <div className="flex items-center gap-2">
              <FileText className="w-4 h-4 text-sky-400" />
              <h3 className="text-sm font-bold text-white tracking-tight">
                Order Audit &amp; Verification: {selectedOrder.symbol} ({selectedOrder.order_id})
              </h3>
              <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-300">
                Session: {selectedOrder.session_date || selectedOrder.created_at.split('T')[0]}
              </span>
            </div>

            <div className="flex items-center gap-2 text-xs font-mono">
              <span className="text-slate-400">Prediction Type:</span>
              <strong className={selectedOrder.prediction_type === 'NEXT_DAY_OPENING' ? 'text-purple-300' : 'text-sky-300'}>
                {selectedOrder.prediction_type === 'NEXT_DAY_OPENING' ? 'NEXT_DAY_OPENING (GAP)' : 'INTRADAY (1M)'}
              </strong>
            </div>
          </div>

          {/* Conditional metrics grid: Next-Day vs Intraday */}
          {selectedOrder.prediction_type === 'NEXT_DAY_OPENING' ? (
            /* NEXT-DAY OPENING METRICS GRID: PREV CLOSE & NEXT OPEN */
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-xs font-mono text-center">
              <div className="p-2 rounded bg-slate-950 border border-slate-800">
                <div className="text-[10px] text-sky-400 uppercase">Previous Day Close</div>
                <div className="font-bold text-white mt-0.5">
                  ₹{(selectedOrder.prev_day_close_price || selectedOrder.planned_entry).toFixed(2)}
                </div>
              </div>

              <div className="p-2 rounded bg-slate-950 border border-slate-800">
                <div className="text-[10px] text-purple-400 uppercase">Predicted Open Price</div>
                <div className="font-bold text-purple-300 mt-0.5">
                  ₹{(selectedOrder.predicted_next_open_price || selectedOrder.planned_target).toFixed(2)}
                </div>
              </div>

              <div className="p-2 rounded bg-slate-950 border border-slate-800">
                <div className="text-[10px] text-amber-400 uppercase">Actual Next Open Price</div>
                <div className="font-bold text-amber-300 mt-0.5">
                  ₹{(selectedOrder.actual_next_open_price || selectedOrder.exit_fill_price || selectedOrder.planned_entry).toFixed(2)}
                </div>
              </div>

              <div className="p-2 rounded bg-slate-950 border border-slate-800">
                <div className="text-[10px] text-slate-400 uppercase">Gap Error / Spread</div>
                <div className="font-bold text-slate-200 mt-0.5">
                  ±₹{(selectedOrder.gap_error_inr || Math.abs((selectedOrder.actual_next_open_price || selectedOrder.exit_fill_price || 0) - (selectedOrder.predicted_next_open_price || selectedOrder.planned_target))).toFixed(2)}
                </div>
              </div>

              <div className="p-2 rounded bg-slate-950 border border-slate-800">
                <div className="text-[10px] text-slate-400 uppercase">Net Realized P&amp;L</div>
                <div
                  className={`font-bold mt-0.5 ${
                    selectedOrder.net_pnl_inr >= 0 ? 'text-emerald-400' : 'text-rose-400'
                  }`}
                >
                  {selectedOrder.net_pnl_inr >= 0 ? '+₹' : '-₹'}{Math.abs(selectedOrder.net_pnl_inr).toFixed(2)}
                </div>
              </div>
            </div>
          ) : (
            /* INTRADAY METRICS GRID: ENTRY, EXIT, TARGET, STOP, MFE, MAE */
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-xs font-mono text-center">
              <div className="p-2 rounded bg-slate-950 border border-slate-800">
                <div className="text-[10px] text-slate-400 uppercase">Entry Price</div>
                <div className="font-bold text-white mt-0.5">
                  ₹{selectedOrder.entry_fill_price?.toFixed(2) || selectedOrder.planned_entry.toFixed(2)}
                </div>
              </div>

              <div className="p-2 rounded bg-slate-950 border border-slate-800">
                <div className="text-[10px] text-slate-400 uppercase">Exit Price</div>
                <div className="font-bold text-slate-200 mt-0.5">
                  {selectedOrder.exit_fill_price ? `₹${selectedOrder.exit_fill_price.toFixed(2)}` : 'In Market'}
                </div>
              </div>

              <div className="p-2 rounded bg-slate-950 border border-slate-800">
                <div className="text-[10px] text-slate-400 uppercase">Max Favorable (MFE)</div>
                <div className="font-bold text-emerald-400 mt-0.5">+₹{selectedOrder.mfe_inr.toFixed(2)}</div>
              </div>

              <div className="p-2 rounded bg-slate-950 border border-slate-800">
                <div className="text-[10px] text-slate-400 uppercase">Max Adverse (MAE)</div>
                <div className="font-bold text-rose-400 mt-0.5">-₹{selectedOrder.mae_inr.toFixed(2)}</div>
              </div>

              <div className="p-2 rounded bg-slate-950 border border-slate-800">
                <div className="text-[10px] text-slate-400 uppercase">Net Realized P&amp;L</div>
                <div
                  className={`font-bold mt-0.5 ${
                    selectedOrder.net_pnl_inr >= 0 ? 'text-emerald-400' : 'text-rose-400'
                  }`}
                >
                  {selectedOrder.net_pnl_inr >= 0 ? '+₹' : '-₹'}{Math.abs(selectedOrder.net_pnl_inr).toFixed(2)}
                </div>
              </div>
            </div>
          )}

          {/* FAILURE EXPLANATION & SELF-LEARNING RULE CARD (IF FAILURE) */}
          {selectedOrder.failure_analysis ? (
            <div className="p-4 rounded-xl bg-gradient-to-r from-rose-950/40 via-purple-950/30 to-slate-950 border border-rose-800/80 space-y-3">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  <Brain className="w-4 h-4 text-rose-400" />
                  <h4 className="text-xs font-bold text-rose-200 uppercase tracking-wider">
                    Failure Root-Cause Diagnosis &amp; Self-Learning Lesson
                  </h4>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-rose-950 border border-rose-700 text-rose-300 font-bold">
                    CATEGORY: {selectedOrder.failure_analysis.category.replace(/_/g, ' ')}
                  </span>
                  <button
                    onClick={() => setLessonModalOrder(selectedOrder)}
                    className="px-2.5 py-0.5 rounded bg-purple-950 hover:bg-purple-900 text-purple-200 border border-purple-700 text-[10px] font-semibold flex items-center gap-1 transition"
                  >
                    <Brain className="w-3 h-3 text-purple-400" />
                    <span>Expand Modal ➔</span>
                  </button>
                </div>
              </div>

              {/* Root Cause Diagnosis */}
              <div className="p-3 rounded-lg bg-slate-950/80 border border-slate-800 text-xs space-y-1">
                <div className="text-[11px] font-bold text-rose-300 uppercase">1. Root-Cause Explanation:</div>
                <p className="text-slate-200 leading-relaxed text-xs">
                  {selectedOrder.failure_analysis.root_cause}
                </p>
                <div className="text-[10px] text-slate-400 font-mono mt-1 pt-1 border-t border-slate-800/80">
                  Telemetry: {selectedOrder.failure_analysis.metrics_at_failure}
                </div>
              </div>

              {/* Learned Rule Formulated & Corrective Action */}
              <div className="p-3 rounded-lg bg-purple-950/40 border border-purple-800/80 text-xs space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-purple-300 uppercase flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-purple-400" />
                    <span>2. Self-Learning Rule Formulated for Future Reference:</span>
                  </span>
                  <span className="text-[10px] px-2 py-0.2 rounded bg-purple-950 text-purple-200 font-mono border border-purple-700">
                    STORED IN MEMORY
                  </span>
                </div>

                <p className="text-white font-mono text-xs font-bold bg-slate-950/90 p-2 rounded border border-purple-900/60">
                  {selectedOrder.failure_analysis.learned_rule}
                </p>

                <div className="text-slate-300 text-[11px] flex items-start gap-1 mt-1">
                  <strong className="text-slate-400 uppercase text-[10px] shrink-0">Action:</strong>
                  <span>{selectedOrder.failure_analysis.corrective_action}</span>
                </div>
              </div>
            </div>
          ) : selectedOrder.outcome_status === 'SUCCESS_TARGET_HIT' ||
            selectedOrder.exit_reason === 'TAKE_PROFIT_HIT' ||
            selectedOrder.gap_direction_matched ? (
            <div className="p-3 rounded-xl bg-emerald-950/40 border border-emerald-800/80 text-xs space-y-1.5">
              <div className="flex items-center gap-2 text-emerald-300 font-bold">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                <span>
                  {selectedOrder.prediction_type === 'NEXT_DAY_OPENING'
                    ? 'PREDICTION VERIFIED: NEXT-DAY OPENING GAP HIT (SUCCESS)'
                    : 'TRADE RESULT: TARGET ACHIEVED (SUCCESS)'}
                </span>
              </div>
              <p className="text-slate-300 leading-relaxed text-xs">
                {selectedOrder.prediction_type === 'NEXT_DAY_OPENING'
                  ? `Next-day opening prediction verified. Stock opened at ₹${(selectedOrder.actual_next_open_price || selectedOrder.exit_fill_price || 0).toFixed(2)}, confirming projected gap bias from previous close ₹${(selectedOrder.prev_day_close_price || selectedOrder.planned_entry).toFixed(2)}. Accuracy logged into memory.`
                  : `Price reached planned target ₹${selectedOrder.planned_target.toFixed(2)} with clean trend continuation. MFE reached +₹${selectedOrder.mfe_inr.toFixed(2)} with negligible adverse excursion.`}
              </p>
            </div>
          ) : (
            <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-400">
              Prediction is currently being tracked. Price monitoring active across historical sessions.
            </div>
          )}
        </div>
      )}

      {/* ============================================================== */}
      {/* SECTION 4: FAILURE POST-MORTEM & SELF-LEARNING MEMORY STORE    */}
      {/* ============================================================== */}
      {activeSection === 'LEARNING_STORE' && (
        <div className="space-y-4">
          {/* Header Explanation */}
          <div className="bg-slate-900/90 border border-slate-800 p-4 rounded-xl flex flex-col md:flex-row md:items-center justify-between gap-3 shadow-sm">
            <div>
              <div className="flex items-center gap-2">
                <Brain className="w-5 h-5 text-purple-400" />
                <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                  Self-Learning Failure Memory Store &amp; Quantitative Knowledge Base
                </h3>
              </div>
              <p className="text-xs text-slate-400 mt-1 max-w-2xl">
                Every trade loss and missed gap prediction is diagnosed by the Self-Learning Agent. Systematic root causes are translated into programmatic rules and permanently stored in memory to prevent recurring errors.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs font-mono px-3 py-1.5 rounded-lg bg-purple-950/80 border border-purple-800 text-purple-300 font-bold">
                {storedLearnedRules.length} Learned Rules Stored
              </span>
            </div>
          </div>

          {/* Filter Toolbar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-950/80 p-3 rounded-xl border border-slate-800 text-xs">
            {/* Category Filter */}
            <div className="flex items-center gap-2">
              <Filter className="w-3.5 h-3.5 text-purple-400" />
              <span className="text-slate-400 text-[11px] font-semibold">Filter Category:</span>
              <select
                value={ruleCategoryFilter}
                onChange={(e) => setRuleCategoryFilter(e.target.value)}
                className="bg-slate-900 border border-slate-700 text-slate-200 text-xs rounded-md px-2.5 py-1 font-mono focus:outline-none focus:border-purple-500"
              >
                <option value="ALL">All Failure Categories</option>
                <option value="GAP_INVERSION">Next-Day Gap Inversion</option>
                <option value="FALSE_BREAKOUT">False Breakout</option>
                <option value="COUNTER_TREND_REVERSAL">Counter-Trend Reversal</option>
                <option value="SLIPPAGE_OR_COST_DRAG">Slippage / Cost Drag</option>
                <option value="SAME_BAR_CHOP">Same-Bar Volatility Chop</option>
              </select>
            </div>

            {/* Search Input */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-2.5" />
              <input
                type="text"
                placeholder="Search rule text, stock, or root cause..."
                value={ruleSearchTerm}
                onChange={(e) => setRuleSearchTerm(e.target.value)}
                className="bg-slate-900 border border-slate-700 text-slate-200 text-xs rounded-md pl-8 pr-3 py-1.5 font-sans focus:outline-none focus:border-purple-500 w-full sm:w-64"
              />
            </div>
          </div>

          {/* Learned Rules Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredRules.length === 0 ? (
              <div className="col-span-2 py-12 text-center text-slate-400 bg-slate-900/60 rounded-xl border border-slate-800">
                No learned rules matching the selected filter criteria.
              </div>
            ) : (
              filteredRules.map((rule, idx) => (
                <div
                  key={rule.failure_id || idx}
                  className="bg-slate-900/90 border border-slate-800 hover:border-purple-800/80 rounded-xl p-4 space-y-3 transition shadow-sm"
                >
                  <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-white font-mono">{rule.symbol}</span>
                      <span className="text-[10px] px-2 py-0.2 rounded bg-slate-800 text-slate-300 font-mono">
                        {rule.prediction_type}
                      </span>
                    </div>

                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-rose-950/80 text-rose-300 border border-rose-800 font-bold">
                      {rule.category.replace(/_/g, ' ')}
                    </span>
                  </div>

                  {/* Failure Root Cause */}
                  <div className="text-xs space-y-1">
                    <div className="text-[10px] text-slate-400 uppercase font-semibold">Diagnosis:</div>
                    <p className="text-slate-300 text-xs leading-relaxed">{rule.root_cause}</p>
                  </div>

                  {/* Programmatic Learned Rule */}
                  <div className="p-2.5 rounded-lg bg-purple-950/30 border border-purple-800/60 space-y-1">
                    <div className="text-[10px] text-purple-300 uppercase font-bold flex items-center gap-1">
                      <Sparkles className="w-3 h-3 text-purple-400" />
                      <span>Self-Learning Rule:</span>
                    </div>
                    <div className="font-mono text-xs font-bold text-white">{rule.learned_rule}</div>
                  </div>

                  {/* Corrective Action */}
                  <div className="text-[11px] text-slate-400 flex items-start gap-1">
                    <strong className="text-slate-300 shrink-0 uppercase text-[10px]">Action:</strong>
                    <span>{rule.corrective_action}</span>
                  </div>

                  {/* Footer metadata */}
                  <div className="pt-2 border-t border-slate-800 flex items-center justify-between text-[10px] text-slate-500 font-mono">
                    <span>Session: {rule.session_date}</span>
                    <span className="text-purple-400 font-semibold">Stored for Future Reference ✓</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* 6-KPI Detailed Metrics Audit & Calculation Breakdown Modal */}
      <DetailedMetricsAuditModal
        isOpen={auditModalOpen}
        onClose={() => setAuditModalOpen(false)}
        initialTab={auditTab}
        initialDate={selectedDate}
        orders={orders}
        config={config}
      />

      {/* Failure Root-Cause Diagnosis & Self-Learning Lesson Modal */}
      <FailureLessonModal
        order={lessonModalOrder}
        isOpen={!!lessonModalOrder}
        onClose={() => setLessonModalOrder(null)}
        onNavigateToLearningStore={() => {
          setActiveSection('LEARNING_STORE');
        }}
      />
    </div>
  );
};
