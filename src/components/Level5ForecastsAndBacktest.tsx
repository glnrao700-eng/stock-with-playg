import React, { useState } from 'react';
import {
  Calendar,
  CheckCircle2,
  TrendingUp,
  AlertTriangle,
  Play,
  RotateCw,
  Sliders,
  ShieldCheck,
} from 'lucide-react';
import {
  InstrumentConfig,
  NextSessionForecast,
  PlatformConfig,
} from '../types/platform';
import { BacktestResult, runWalkForwardBacktest } from '../services/agents/walkForwardBacktester';

interface Level5ForecastsAndBacktestProps {
  forecasts: NextSessionForecast[];
  instruments: InstrumentConfig[];
  config: PlatformConfig;
}

export const Level5ForecastsAndBacktest: React.FC<Level5ForecastsAndBacktestProps> = ({
  forecasts,
  instruments,
  config,
}) => {
  const [isRunningBacktest, setIsRunningBacktest] = useState(false);
  const [backtestResults, setBacktestResults] = useState<BacktestResult[]>(() =>
    instruments.slice(0, 4).map((inst) => runWalkForwardBacktest(inst, config, 70))
  );

  const handleRunAllBacktests = () => {
    setIsRunningBacktest(true);
    setTimeout(() => {
      const results = instruments.map((inst) => runWalkForwardBacktest(inst, config, 80));
      setBacktestResults(results);
      setIsRunningBacktest(false);
    }, 400);
  };

  return (
    <div className="space-y-6">
      {/* SECTION 1: 15:30-16:00 NEXT-SESSION OPENING FORECASTER */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-lg p-4 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
          <div>
            <div className="flex items-center gap-2">
              <Calendar className="w-5 h-5 text-sky-400" />
              <h2 className="text-sm font-bold text-white uppercase tracking-wider">
                15:30–16:00 IST Next-Session Opening Forecasts vs Naive Baseline
              </h2>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Ridge regression model (Model: <span className="font-mono text-slate-300">{config.model_version}</span>) utilizing Closing Location Value (CLV), session momentum, and verified filings.
            </p>
          </div>

          <div className="text-xs bg-slate-950 px-3 py-1.5 rounded border border-slate-800 text-slate-400">
            Prediction Interval Coverage:{' '}
            <strong className="text-emerald-400 font-mono">80% Gaussian Band</strong>
          </div>
        </div>

        {/* Overnight Risk Disclaimer */}
        <div className="bg-slate-950/70 border border-amber-900/60 rounded p-3 flex items-start gap-3 text-xs text-slate-300">
          <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
          <p leading-relaxed>
            <strong className="text-amber-300">OVERNIGHT CUTOFF DISCLAIMER:</strong> All next-session opening forecasts are conditioned strictly on market microstructure and verified filings available up to the 16:00 IST post-market cutoff. They explicitly do NOT claim awareness of overnight global macroeconomic announcements, geopolitical developments, or post-cutoff exchange disclosures.
          </p>
        </div>

        {/* Forecast Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-950/70 border-b border-slate-800 text-slate-400 uppercase font-medium">
                <th className="py-2.5 px-3">Symbol</th>
                <th className="py-2.5 px-3">Session Date</th>
                <th className="py-2.5 px-3">Next Trading Session</th>
                <th className="py-2.5 px-3 text-right">Naive Baseline (Close)</th>
                <th className="py-2.5 px-3 text-right">Predicted Open</th>
                <th className="py-2.5 px-3 text-center">Predicted Gap</th>
                <th className="py-2.5 px-3 text-center">80% Prediction Interval [L₈₀, H₈₀]</th>
                <th className="py-2.5 px-3">Data Completeness</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-mono">
              {forecasts.map((fc) => (
                <tr key={fc.forecast_id} className="hover:bg-slate-800/40 transition">
                  <td className="py-2.5 px-3 font-bold text-white font-sans">{fc.symbol}</td>
                  <td className="py-2.5 px-3 text-slate-400">{fc.session_date}</td>
                  <td className="py-2.5 px-3 text-slate-200 font-semibold">{fc.next_trading_date}</td>
                  <td className="py-2.5 px-3 text-right text-slate-300">
                    ₹{fc.baseline_prev_close.toFixed(2)}
                  </td>
                  <td className="py-2.5 px-3 text-right text-sky-400 font-bold">
                    ₹{fc.predicted_open_price.toFixed(2)}
                  </td>
                  <td className="py-2.5 px-3 text-center">
                    <span
                      className={`px-1.5 py-0.5 rounded text-[11px] font-semibold ${
                        fc.predicted_gap_inr >= 0
                          ? 'bg-emerald-950 text-emerald-300'
                          : 'bg-rose-950 text-rose-300'
                      }`}
                    >
                      {fc.predicted_gap_inr >= 0 ? '+' : ''}₹{fc.predicted_gap_inr.toFixed(2)} (
                      {fc.predicted_gap_pct}%)
                    </span>
                  </td>
                  <td className="py-2.5 px-3 text-center text-slate-300">
                    [₹{fc.interval_low_80.toFixed(2)}, ₹{fc.interval_high_80.toFixed(2)}]
                  </td>
                  <td className="py-2.5 px-3 font-sans text-slate-400 text-[11px]">
                    <span className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-300">
                      {fc.data_completeness}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* SECTION 2: CHRONOLOGICAL WALK-FORWARD BACKTESTER */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-lg p-4 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
          <div>
            <div className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-emerald-400" />
              <h2 className="text-sm font-bold text-white uppercase tracking-wider">
                Chronological Walk-Forward Backtest (Zero Lookahead Bias)
              </h2>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              At candle bar <code className="text-sky-300 font-mono">i</code>, agents strictly receive slice <code className="text-sky-300 font-mono">candles[0..i]</code> without future peek.
            </p>
          </div>

          <button
            onClick={handleRunAllBacktests}
            disabled={isRunningBacktest}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-semibold shadow-sm transition"
          >
            <RotateCw className={`w-3.5 h-3.5 ${isRunningBacktest ? 'animate-spin' : ''}`} />
            {isRunningBacktest ? 'Simulating Replay...' : 'Re-Run All Walk-Forward Tests'}
          </button>
        </div>

        {/* Backtest Result Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {backtestResults.map((bt) => (
            <div
              key={bt.symbol}
              className="bg-slate-950 p-3.5 rounded border border-slate-800 space-y-2 text-xs"
            >
              <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                <span className="font-bold text-sm text-white">{bt.symbol}</span>
                <span
                  className={`font-mono font-bold ${
                    bt.net_pnl_after_costs_inr >= 0 ? 'text-emerald-400' : 'text-rose-400'
                  }`}
                >
                  {bt.net_pnl_after_costs_inr >= 0 ? '+' : ''}₹{bt.net_pnl_after_costs_inr.toFixed(2)}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2 text-[11px] font-mono text-slate-300">
                <div>
                  Bars Evaluated: <strong className="text-white">{bt.bars_evaluated}</strong>
                </div>
                <div>
                  Trades Closed: <strong className="text-white">{bt.closed_trades_count}</strong>
                </div>
                <div>
                  Win Rate: <strong className="text-emerald-400">{bt.win_rate_pct}%</strong>
                </div>
                <div>
                  Abstention Rate: <strong className="text-slate-200">{bt.abstention_rate_pct}%</strong>
                </div>
                <div>
                  Wins / Losses: <strong className="text-white">{bt.win_count}W / {bt.loss_count}L</strong>
                </div>
                <div>
                  Statutory Costs: <strong className="text-amber-400">₹{bt.total_costs_inr.toFixed(2)}</strong>
                </div>
              </div>

              <div className="text-[10px] text-emerald-400 pt-1 border-t border-slate-800/80 flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                {bt.lookahead_leakage_check}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
