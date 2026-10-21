import React from 'react';
import {
  X,
  Play,
  FastForward,
  Layers,
  Terminal,
  FolderCode,
  ShieldCheck,
  CheckCircle2,
  Cpu,
  LineChart,
} from 'lucide-react';

interface UserGuideModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenRepoExplorer: () => void;
}

export const UserGuideModal: React.FC<UserGuideModalProps> = ({
  isOpen,
  onClose,
  onOpenRepoExplorer,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="bg-slate-900 border border-slate-700 rounded-xl w-full max-w-3xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-800 bg-slate-950 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded bg-sky-600 flex items-center justify-center text-white font-bold text-sm">
              ?
            </div>
            <div>
              <h2 className="text-sm font-bold text-white tracking-wide">
                How to Run & Use the Platform
              </h2>
              <div className="text-[11px] text-slate-400">
                Guide for running the app in this browser or running locally on your computer
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 overflow-y-auto space-y-5 text-xs text-slate-300 leading-relaxed">
          {/* Section 1: Running in this Browser */}
          <div className="bg-slate-950 p-4 rounded-lg border border-slate-800 space-y-3">
            <div className="flex items-center gap-2 text-sky-400 font-bold text-sm">
              <Play className="w-4 h-4" />
              <span>1. Run Immediately (Already Active in Your Browser)</span>
            </div>
            <p>
              The application is <strong>already compiled, running, and interactive right now</strong> in this window. You do not need to install anything to explore all 6 levels:
            </p>

            <ul className="space-y-2 list-disc list-inside text-slate-300">
              <li>
                <strong className="text-white">+ Step 1m Candle</strong> (Top Bar): Advances the market by 1 minute, runs the 8 LangGraph agents in parallel, updates VWAP/RSI, and evaluates virtual orders against newly closed candles.
              </li>
              <li>
                <strong className="text-white">Auto-Run 3s</strong>: Automatically advances time every 3 seconds so you can watch signals and virtual trades unfold live.
              </li>
              <li>
                <strong className="text-white">Level 1 (Market Overview)</strong>: View the live NSE watchlist (Reliance, TCS, HDFC Bank, Infosys, ICICI Bank, SBI), portfolio equity, realized P&L, and next-day open forecasts.
              </li>
              <li>
                <strong className="text-white">Level 2 (Stock Detail & Charts)</strong>: Click any stock to view TradingView candlesticks with exact interactive lines for <strong>Reference (P₀)</strong>, <strong>Breakout Entry (E)</strong>, <strong>Target (T)</strong>, and <strong>Stop-Loss (S)</strong>, plus the mathematical verification card that $|E - P_0| \ge ₹3.00$ and Reward:Risk $\ge 1.50$.
              </li>
              <li>
                <strong className="text-white">Level 3 (Agent Inspection)</strong>: Inspect the execution audit of the 4 specialized analytical agents + Strategy Orchestrator.
              </li>
              <li>
                <strong className="text-white">Level 4 (Paper Trading)</strong>: Check the virtual order blotter, MFE/MAE excursions, statutory charges (STT, GST, Brokerage), and automated post-mortem audits.
              </li>
              <li>
                <strong className="text-white">Level 5 (Forecasts & Backtest)</strong>: Inspect the 15:30-16:00 IST Next-Session Opening price model vs baseline, and run walk-forward backtests without lookahead bias.
              </li>
              <li>
                <strong className="text-white">Level 6 (Config & Telemetry)</strong>: Add new NSE stocks dynamically, tune agent weights, toggle the Master Kill Switch, and inspect secret-redacted telemetry logs.
              </li>
            </ul>
          </div>

          {/* Section 2: Running Locally on Your Machine */}
          <div className="bg-slate-950 p-4 rounded-lg border border-slate-800 space-y-3">
            <div className="flex items-center gap-2 text-emerald-400 font-bold text-sm">
              <Terminal className="w-4 h-4" />
              <span>2. Running Locally on Your Machine (Docker or Python)</span>
            </div>
            <p>
              If you want to run the full stack (PostgreSQL 16 + FastAPI + React frontend) on your own computer:
            </p>

            <div className="space-y-2">
              <div className="p-2.5 rounded bg-slate-900 border border-slate-800 font-mono text-[11px]">
                <div className="text-slate-400 mb-1 font-sans font-semibold text-xs">
                  Option A: One-Command Docker Compose (Recommended)
                </div>
                <div className="text-emerald-300 select-all">docker compose up --build</div>
                <div className="text-slate-400 text-[10px] mt-1 font-sans">
                  Starts Postgres on port 5432, FastAPI backend on port 8000, and Frontend on port 5173.
                </div>
              </div>

              <div className="p-2.5 rounded bg-slate-900 border border-slate-800 font-mono text-[11px]">
                <div className="text-slate-400 mb-1 font-sans font-semibold text-xs">
                  Option B: Automated Setup Scripts
                </div>
                <div className="text-slate-300">
                  <span className="text-sky-400">Windows PowerShell:</span> .\\scripts\\setup_and_run.ps1
                </div>
                <div className="text-slate-300 mt-0.5">
                  <span className="text-sky-400">Linux / macOS:</span> bash scripts/setup_and_run.sh
                </div>
              </div>
            </div>
          </div>

          {/* Section 3: Accessing Code Files */}
          <div className="bg-slate-950 p-4 rounded-lg border border-slate-800 flex items-center justify-between gap-4">
            <div>
              <div className="font-bold text-white text-xs flex items-center gap-1.5">
                <FolderCode className="w-4 h-4 text-indigo-400" />
                <span>Need the full source files or repository tree?</span>
              </div>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Click the &quot;Code &amp; Repo Tree&quot; button to view, copy, or download any backend file, test suite, or config.
              </p>
            </div>
            <button
              onClick={() => {
                onClose();
                onOpenRepoExplorer();
              }}
              className="px-3 py-1.5 rounded bg-indigo-600 hover:bg-indigo-500 text-white font-semibold transition shrink-0"
            >
              Open Repo Explorer
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
