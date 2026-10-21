import React, { useEffect, useState } from 'react';
import {
  Brain,
  X,
  Sparkles,
  ShieldAlert,
  ArrowRight,
  TrendingDown,
  TrendingUp,
  Check,
  Copy,
  Layers,
  Database,
  Activity,
  AlertTriangle,
} from 'lucide-react';
import { PaperOrder, FailureAnalysis } from '../types/platform';
import { diagnoseFailureAndFormulateRule } from '../services/learningStore';

interface FailureLessonModalProps {
  order: PaperOrder | null;
  isOpen: boolean;
  onClose: () => void;
  onNavigateToLearningStore?: () => void;
}

export const FailureLessonModal: React.FC<FailureLessonModalProps> = ({
  order,
  isOpen,
  onClose,
  onNavigateToLearningStore,
}) => {
  const [copied, setCopied] = useState(false);

  // Close on Escape key press
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !order) return null;

  // Resolve failure analysis (from order or dynamically diagnosed)
  const analysis: FailureAnalysis =
    order.failure_analysis || diagnoseFailureAndFormulateRule(order);

  const isNextDay = order.prediction_type === 'NEXT_DAY_OPENING';
  const sessionDate = order.session_date || order.created_at.split('T')[0];
  const isShort = order.direction === 'SHORT';

  const handleCopyRule = () => {
    if (!analysis.learned_rule) return;
    navigator.clipboard.writeText(analysis.learned_rule);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/85 backdrop-blur-md animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-3xl max-h-[92vh] flex flex-col bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden text-slate-200 animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="px-5 py-4 bg-gradient-to-r from-purple-950/60 via-slate-900 to-rose-950/50 border-b border-slate-800 flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="p-2.5 rounded-xl bg-purple-900/40 border border-purple-700/60 text-purple-300 shrink-0 mt-0.5">
              <Brain className="w-6 h-6 text-purple-400" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-purple-950 border border-purple-700 text-purple-300">
                  AI Self-Learning Lesson
                </span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
                  {order.symbol} • {isNextDay ? 'Next-Day Opening Gap' : 'Intraday 1-Min'}
                </span>
                <span className="text-[10px] font-mono text-slate-400">
                  Session: {sessionDate}
                </span>
              </div>
              <h2 className="text-base sm:text-lg font-bold text-white mt-1">
                Root-Cause Diagnosis &amp; Formulated Learning Rule
              </h2>
              <p className="text-xs text-slate-400 mt-0.5 font-mono">
                Order ID: {order.order_id}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white border border-slate-700 transition"
            title="Close dialog (Esc)"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body - Scrollable */}
        <div className="p-5 space-y-4 overflow-y-auto">
          {/* Top Execution Summary Ribbon */}
          <div className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs font-mono">
            <div className="flex items-center gap-2">
              <span
                className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                  isShort
                    ? 'bg-rose-950 text-rose-300 border border-rose-800'
                    : 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                }`}
              >
                {order.direction}
              </span>
              <span className="px-2 py-0.5 rounded bg-rose-950/80 text-rose-300 border border-rose-800 text-[11px] font-bold">
                {isNextDay ? 'FAILURE: MISSED GAP' : 'FAILURE: STOP HIT'}
              </span>
            </div>

            <div className="flex items-center gap-4 text-xs">
              <div>
                <span className="text-slate-400 text-[10px] uppercase block">Net Loss</span>
                <span className="font-bold text-rose-400 text-sm">
                  -₹{Math.abs(order.net_pnl_inr).toFixed(2)}
                </span>
              </div>

              {isNextDay ? (
                <>
                  <div>
                    <span className="text-slate-400 text-[10px] uppercase block">Prev Close</span>
                    <span className="font-bold text-white">
                      ₹{(order.prev_day_close_price || order.planned_entry).toFixed(2)}
                    </span>
                  </div>
                  <div>
                    <span className="text-purple-400 text-[10px] uppercase block">Predicted Open</span>
                    <span className="font-bold text-purple-300">
                      ₹{(order.predicted_next_open_price || order.planned_target).toFixed(2)}
                    </span>
                  </div>
                  <div>
                    <span className="text-amber-400 text-[10px] uppercase block">Actual Open</span>
                    <span className="font-bold text-amber-300">
                      ₹{(order.actual_next_open_price || order.exit_fill_price || order.planned_entry).toFixed(2)}
                    </span>
                  </div>
                </>
              ) : (
                <>
                  <div>
                    <span className="text-slate-400 text-[10px] uppercase block">Planned Entry</span>
                    <span className="font-bold text-white">
                      ₹{order.planned_entry.toFixed(2)}
                    </span>
                  </div>
                  <div>
                    <span className="text-emerald-400 text-[10px] uppercase block">Target</span>
                    <span className="font-bold text-emerald-300">
                      ₹{order.planned_target.toFixed(2)}
                    </span>
                  </div>
                  <div>
                    <span className="text-rose-400 text-[10px] uppercase block">Stop Loss</span>
                    <span className="font-bold text-rose-300">
                      ₹{order.planned_stop.toFixed(2)}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 text-[10px] uppercase block">Max Fav / Adv</span>
                    <span className="font-bold text-slate-300">
                      <span className="text-emerald-400">+{order.mfe_inr.toFixed(1)}</span> /{' '}
                      <span className="text-rose-400">-{order.mae_inr.toFixed(1)}</span>
                    </span>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Section 1: Root Cause Diagnosis */}
          <div className="p-4 rounded-xl bg-gradient-to-r from-rose-950/25 via-slate-950 to-slate-950 border border-rose-900/50 space-y-2.5">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 text-rose-400" />
                <h3 className="text-xs font-bold text-rose-200 uppercase tracking-wider">
                  1. Root-Cause Explanation (Post-Mortem Audit)
                </h3>
              </div>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-rose-950 border border-rose-700 text-rose-300 font-bold">
                DIAGNOSIS CATEGORY: {analysis.category.replace(/_/g, ' ')}
              </span>
            </div>

            <p className="text-slate-200 text-xs sm:text-sm leading-relaxed bg-slate-950/60 p-3 rounded-lg border border-slate-800">
              {analysis.root_cause}
            </p>

            {analysis.metrics_at_failure && (
              <div className="text-[11px] font-mono text-slate-400 bg-slate-950/40 p-2 rounded border border-slate-800 flex items-center gap-2">
                <Activity className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                <span>
                  <strong className="text-slate-300 uppercase">Telemetry At Failure:</strong>{' '}
                  {analysis.metrics_at_failure}
                </span>
              </div>
            )}
          </div>

          {/* Section 2: Formulated Self-Learning Rule */}
          <div className="p-4 rounded-xl bg-gradient-to-r from-purple-950/35 via-slate-950 to-indigo-950/30 border border-purple-800/60 space-y-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-purple-400" />
                <h3 className="text-xs font-bold text-purple-200 uppercase tracking-wider">
                  2. Self-Learning Rule Formulated &amp; Stored in Memory
                </h3>
              </div>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-purple-950 border border-purple-700 text-purple-300 font-bold flex items-center gap-1">
                <Database className="w-3 h-3 text-purple-400" />
                STORED IN SYSTEM MEMORY
              </span>
            </div>

            <div className="relative group">
              <div className="p-3.5 rounded-lg bg-slate-950 border border-purple-700/50 text-white font-mono text-xs sm:text-sm font-semibold leading-relaxed shadow-inner">
                {analysis.learned_rule}
              </div>

              <button
                onClick={handleCopyRule}
                className="absolute top-2.5 right-2.5 px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] font-mono flex items-center gap-1 border border-slate-700 transition"
                title="Copy rule to clipboard"
              >
                {copied ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                    <span className="text-emerald-400">Copied!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>Copy Rule</span>
                  </>
                )}
              </button>
            </div>

            <p className="text-[11px] text-slate-400 italic">
              * This rule is automatically applied by the Orchestrator to filter out recurring failure setups under similar market volatility conditions.
            </p>
          </div>

          {/* Section 3: Corrective Action */}
          <div className="p-4 rounded-xl bg-slate-950/70 border border-slate-800 space-y-2">
            <div className="flex items-center gap-2 text-xs font-bold text-sky-300 uppercase tracking-wider">
              <AlertTriangle className="w-3.5 h-3.5 text-sky-400" />
              <span>3. Algorithmic Corrective Action Enforced</span>
            </div>

            <div className="p-3 rounded-lg bg-slate-900 border border-slate-800 text-xs sm:text-sm text-slate-300 font-sans leading-relaxed">
              {analysis.corrective_action}
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-5 py-3.5 bg-slate-950 border-t border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="text-xs text-slate-400 flex items-center gap-1.5">
            <Layers className="w-3.5 h-3.5 text-purple-400" />
            <span>Learning engine prevents repetitive capital leakage.</span>
          </div>

          <div className="flex items-center gap-2.5 w-full sm:w-auto justify-end">
            {onNavigateToLearningStore && (
              <button
                onClick={() => {
                  onClose();
                  onNavigateToLearningStore();
                }}
                className="px-3 py-1.5 rounded-lg bg-purple-950 hover:bg-purple-900 text-purple-200 border border-purple-700/80 text-xs font-semibold flex items-center gap-1.5 transition active:scale-95"
              >
                <Brain className="w-3.5 h-3.5 text-purple-400" />
                <span>View All Rules in Store</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            )}

            <button
              onClick={onClose}
              className="px-4 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold border border-slate-700 transition"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
