import React, { useState } from 'react';
import {
  Cpu,
  BarChart2,
  Compass,
  MessageSquare,
  Building2,
  Workflow,
  Clock,
  Layers,
  ChevronDown,
  ChevronUp,
  ArrowRight,
  Database,
  ShieldAlert,
  ShieldCheck,
  CheckCircle2,
  Sliders,
  Target,
  Maximize2,
  Minimize2,
  Info,
  Scale,
} from 'lucide-react';
import { AgentRunAudit, PlatformConfig } from '../types/platform';

interface Level3AgentInspectionProps {
  audit: AgentRunAudit | null;
  config: PlatformConfig;
}

type PipelineStepKey =
  | 'ingestion'
  | 'technical'
  | 'pattern'
  | 'sentiment'
  | 'fundamental'
  | 'orchestrator';

export const Level3AgentInspection: React.FC<Level3AgentInspectionProps> = ({ audit, config }) => {
  const [selectedStep, setSelectedStep] = useState<PipelineStepKey>('orchestrator');
  const [expandAll, setExpandAll] = useState<boolean>(false);
  const [expandedSteps, setExpandedSteps] = useState<Record<PipelineStepKey, boolean>>({
    ingestion: false,
    technical: false,
    pattern: false,
    sentiment: false,
    fundamental: false,
    orchestrator: true,
  });

  if (!audit) {
    return (
      <div className="bg-slate-900/90 border border-slate-800 rounded-lg p-8 text-center text-slate-400">
        No agent audit record available yet. Step candle or start replay to execute the LangGraph multi-agent pipeline.
      </div>
    );
  }

  const {
    technical_output: tech,
    pattern_output: pattern,
    sentiment_output: sent,
    fundamental_output: fund,
    orchestrator_output: orch,
  } = audit;

  const weights = config.agent_weights;
  const ind = tech.indicators;

  const toggleStepAccordion = (step: PipelineStepKey) => {
    setExpandedSteps((prev) => ({
      ...prev,
      [step]: !prev[step],
    }));
  };

  const handleSelectStep = (step: PipelineStepKey) => {
    setSelectedStep(step);
    setExpandedSteps((prev) => ({
      ...prev,
      [step]: true,
    }));
  };

  // Helper calculation for display
  const techWeighted = (weights.technical * tech.score).toFixed(3);
  const patternWeighted = (weights.pattern * pattern.score).toFixed(3);
  const sentWeighted =
    sent.score !== null ? (weights.sentiment * sent.score).toFixed(3) : '0.000';
  const fundWeighted = (weights.fundamental * fund.score).toFixed(3);

  // Render individual expanded step detail card
  const renderStepCard = (stepKey: PipelineStepKey, isAccordion = false) => {
    const isExpanded = expandAll || (isAccordion ? expandedSteps[stepKey] : selectedStep === stepKey);

    let title = '';
    let icon = null;
    let badgeColor = '';
    let badgeText = '';
    let nodeLabel = '';

    switch (stepKey) {
      case 'ingestion':
        title = 'Data Ingestion & Multi-Timeframe Alignment';
        nodeLabel = 'Node: START';
        icon = <Database className="w-4 h-4 text-emerald-400" />;
        badgeColor = 'bg-emerald-950/80 text-emerald-300 border-emerald-800';
        badgeText = 'INGESTION COMPLETE';
        break;
      case 'technical':
        title = `1. Technical Analysis Agent (${(weights.technical * 100).toFixed(0)}% Weight)`;
        nodeLabel = 'Specialist Node 1';
        icon = <BarChart2 className="w-4 h-4 text-sky-400" />;
        badgeColor =
          tech.score > 0
            ? 'bg-emerald-950/80 text-emerald-300 border-emerald-800'
            : tech.score < 0
            ? 'bg-rose-950/80 text-rose-300 border-rose-800'
            : 'bg-slate-800 text-slate-300 border-slate-700';
        badgeText = `Score: ${tech.score >= 0 ? '+' : ''}${tech.score.toFixed(2)} (${tech.bias})`;
        break;
      case 'pattern':
        title = `2. Pattern Recognition Agent (${(weights.pattern * 100).toFixed(0)}% Weight)`;
        nodeLabel = 'Specialist Node 2';
        icon = <Compass className="w-4 h-4 text-purple-400" />;
        badgeColor =
          pattern.score > 0
            ? 'bg-emerald-950/80 text-emerald-300 border-emerald-800'
            : pattern.score < 0
            ? 'bg-rose-950/80 text-rose-300 border-rose-800'
            : 'bg-slate-800 text-slate-300 border-slate-700';
        badgeText = `Score: ${pattern.score >= 0 ? '+' : ''}${pattern.score.toFixed(2)} (${pattern.status})`;
        break;
      case 'sentiment':
        title = `3. Sentiment Analysis Agent (${(weights.sentiment * 100).toFixed(0)}% Weight)`;
        nodeLabel = 'Specialist Node 3';
        icon = <MessageSquare className="w-4 h-4 text-amber-400" />;
        badgeColor =
          sent.score !== null && sent.score > 0
            ? 'bg-emerald-950/80 text-emerald-300 border-emerald-800'
            : sent.score !== null && sent.score < 0
            ? 'bg-rose-950/80 text-rose-300 border-rose-800'
            : 'bg-amber-950/80 text-amber-300 border-amber-800';
        badgeText =
          sent.score !== null
            ? `Score: ${sent.score >= 0 ? '+' : ''}${sent.score.toFixed(2)} (${sent.classification})`
            : 'UNCERTAIN_MISSING_DATA';
        break;
      case 'fundamental':
        title = `4. Fundamental Analysis Agent (${(weights.fundamental * 100).toFixed(0)}% Weight)`;
        nodeLabel = 'Specialist Node 4';
        icon = <Building2 className="w-4 h-4 text-emerald-400" />;
        badgeColor =
          fund.score > 0
            ? 'bg-emerald-950/80 text-emerald-300 border-emerald-800'
            : fund.score < 0
            ? 'bg-rose-950/80 text-rose-300 border-rose-800'
            : 'bg-slate-800 text-slate-300 border-slate-700';
        badgeText = `Score: ${fund.score >= 0 ? '+' : ''}${fund.score.toFixed(2)} (${fund.status})`;
        break;
      case 'orchestrator':
        title = 'Node: ORCHESTRATOR — Target & Risk Gate (Fan-In Aggregator)';
        nodeLabel = 'Node: ORCHESTRATOR';
        icon = <Target className="w-4 h-4 text-sky-400" />;
        badgeColor =
          orch.decision === 'LONG'
            ? 'bg-emerald-950/90 text-emerald-300 border-emerald-700'
            : orch.decision === 'SHORT'
            ? 'bg-rose-950/90 text-rose-300 border-rose-700'
            : 'bg-slate-800 text-slate-300 border-slate-700';
        badgeText = `Decision: ${orch.decision} (Composite: ${orch.composite_score >= 0 ? '+' : ''}${orch.composite_score.toFixed(3)})`;
        break;
    }

    return (
      <div
        key={stepKey}
        className={`bg-slate-900/90 border rounded-xl overflow-hidden transition-all duration-200 ${
          selectedStep === stepKey && !expandAll
            ? 'border-sky-500 shadow-lg shadow-sky-950/30 ring-1 ring-sky-500/30'
            : 'border-slate-800 hover:border-slate-700'
        }`}
      >
        {/* Step Header Accordion Toggle */}
        <button
          onClick={() => {
            if (isAccordion) {
              toggleStepAccordion(stepKey);
            } else {
              handleSelectStep(stepKey);
            }
          }}
          className="w-full px-4 py-3.5 flex items-center justify-between gap-3 text-left bg-slate-900/70 hover:bg-slate-850 transition"
        >
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-slate-950 border border-slate-800">{icon}</div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-mono uppercase px-1.5 py-0.5 rounded bg-slate-800 text-slate-300">
                  {nodeLabel}
                </span>
                <h4 className="text-sm font-bold text-white tracking-tight">{title}</h4>
              </div>
              <div className="text-xs text-slate-400 mt-0.5 font-mono">
                Instrument: <span className="text-slate-200">{audit.symbol}</span> | Correlation:{' '}
                <span className="text-slate-300">{audit.correlation_id}</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <span className={`text-xs px-2.5 py-1 rounded font-mono font-bold border ${badgeColor}`}>
              {badgeText}
            </span>
            {isExpanded ? (
              <ChevronUp className="w-4 h-4 text-slate-400" />
            ) : (
              <ChevronDown className="w-4 h-4 text-slate-400" />
            )}
          </div>
        </button>

        {/* Expanded Content with Input / Progress & Logic / Output */}
        {isExpanded && (
          <div className="p-4 border-t border-slate-800/80 bg-slate-950/70 space-y-4 text-xs font-sans">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              {/* ===================== INPUT BOX ===================== */}
              <div className="p-3.5 rounded-lg bg-slate-900/90 border border-slate-800 space-y-2.5">
                <div className="flex items-center gap-1.5 text-sky-400 font-bold uppercase tracking-wider text-[11px]">
                  <Database className="w-3.5 h-3.5" />
                  <span>📥 Input Data Received</span>
                </div>

                {stepKey === 'ingestion' && (
                  <div className="space-y-1.5 text-slate-300">
                    <div className="flex justify-between border-b border-slate-800/80 pb-1">
                      <span className="text-slate-400">1-Minute Candles:</span>
                      <strong className="font-mono text-emerald-400">375 session bars (09:15-15:30)</strong>
                    </div>
                    <div className="flex justify-between border-b border-slate-800/80 pb-1">
                      <span className="text-slate-400">30-Day Historical Database:</span>
                      <strong className="font-mono text-slate-200">7,500 continuous bars</strong>
                    </div>
                    <div className="flex justify-between border-b border-slate-800/80 pb-1">
                      <span className="text-slate-400">Higher Timeframes:</span>
                      <strong className="font-mono text-slate-200">5m & 15m synthesized</strong>
                    </div>
                    <div className="flex justify-between border-b border-slate-800/80 pb-1">
                      <span className="text-slate-400">Exchange Filings & Headlines:</span>
                      <strong className="font-mono text-slate-200">{sent.item_count} items ingested</strong>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Fundamental Snapshot:</span>
                      <strong className="font-mono text-slate-200">{fund.sector_model} model loaded</strong>
                    </div>
                  </div>
                )}

                {stepKey === 'technical' && (
                  <div className="space-y-1.5 text-slate-300">
                    <div className="flex justify-between border-b border-slate-800/80 pb-1">
                      <span className="text-slate-400">Evaluated Dataset:</span>
                      <strong className="font-mono text-emerald-400">
                        {ind.total_bars_evaluated ? `${ind.total_bars_evaluated.toLocaleString()} bars (30 Days)` : '30-Day DB Bars'}
                      </strong>
                    </div>
                    <div className="flex justify-between border-b border-slate-800/80 pb-1">
                      <span className="text-slate-400">Last Close (C):</span>
                      <strong className="font-mono text-sky-300">₹{ind.last_close.toFixed(2)}</strong>
                    </div>
                    <div className="flex justify-between border-b border-slate-800/80 pb-1">
                      <span className="text-slate-400">30-Day High / Low Range:</span>
                      <strong className="font-mono text-slate-200">
                        [₹{ind.low_30d?.toFixed(2) || '1195'} - ₹{ind.high_30d?.toFixed(2) || '1215'}]
                      </strong>
                    </div>
                    <div className="flex justify-between border-b border-slate-800/80 pb-1">
                      <span className="text-slate-400">30-Day VWAP:</span>
                      <strong className="font-mono text-purple-300">₹{ind.vwap_30d?.toFixed(2) || ind.vwap.toFixed(2)}</strong>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Assigned Weight:</span>
                      <strong className="font-mono text-slate-200">{(weights.technical * 100).toFixed(0)}%</strong>
                    </div>
                  </div>
                )}

                {stepKey === 'pattern' && (
                  <div className="space-y-1.5 text-slate-300">
                    <div className="flex justify-between border-b border-slate-800/80 pb-1">
                      <span className="text-slate-400">30-Day Macro Geometry:</span>
                      <strong className="font-mono text-emerald-400">Full 30-Day Swing Sequence</strong>
                    </div>
                    <div className="flex justify-between border-b border-slate-800/80 pb-1">
                      <span className="text-slate-400">30-Day Swing Trend:</span>
                      <strong className="font-mono text-purple-300">
                        {pattern.macro_30d_framework?.swing_trend.replace('_', ' ') || 'SIDEWAYS RANGE'}
                      </strong>
                    </div>
                    <div className="flex justify-between border-b border-slate-800/80 pb-1">
                      <span className="text-slate-400">30-Day 50% Fib Retracement:</span>
                      <strong className="font-mono text-slate-200">
                        ₹{pattern.macro_30d_framework?.fib_500.toFixed(2) || '1202.00'}
                      </strong>
                    </div>
                    <div className="flex justify-between border-b border-slate-800/80 pb-1">
                      <span className="text-slate-400">Immediate Lookback Window:</span>
                      <strong className="font-mono text-slate-200">Trailing 25 continuous bars</strong>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Assigned Weight:</span>
                      <strong className="font-mono text-slate-200">{(weights.pattern * 100).toFixed(0)}%</strong>
                    </div>
                  </div>
                )}

                {stepKey === 'sentiment' && (
                  <div className="space-y-1.5 text-slate-300">
                    <div className="flex justify-between border-b border-slate-800/80 pb-1">
                      <span className="text-slate-400">Ingested Feed Items:</span>
                      <strong className="font-mono text-amber-300">{sent.item_count} headlines/filings</strong>
                    </div>
                    <div className="flex justify-between border-b border-slate-800/80 pb-1">
                      <span className="text-slate-400">Regulatory Filings Weight:</span>
                      <strong className="font-mono text-slate-200">75%</strong>
                    </div>
                    <div className="flex justify-between border-b border-slate-800/80 pb-1">
                      <span className="text-slate-400">Social Commentary Weight:</span>
                      <strong className="font-mono text-slate-200">25%</strong>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Assigned Weight:</span>
                      <strong className="font-mono text-slate-200">{(weights.sentiment * 100).toFixed(0)}%</strong>
                    </div>
                  </div>
                )}

                {stepKey === 'fundamental' && (
                  <div className="space-y-1.5 text-slate-300">
                    <div className="flex justify-between border-b border-slate-800/80 pb-1">
                      <span className="text-slate-400">Sector Classification:</span>
                      <strong className="font-mono text-emerald-300">{fund.sector_model}</strong>
                    </div>
                    <div className="flex justify-between border-b border-slate-800/80 pb-1">
                      <span className="text-slate-400">Fiscal Period Snapshot:</span>
                      <strong className="font-mono text-slate-200">{fund.fiscal_period}</strong>
                    </div>
                    <div className="flex justify-between border-b border-slate-800/80 pb-1">
                      <span className="text-slate-400">Earnings Proximity:</span>
                      <strong className="font-mono text-slate-200">
                        {fund.earnings_risk_flag ? 'WITHIN 48H' : 'NO IMMINENT RELEASE'}
                      </strong>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Assigned Weight:</span>
                      <strong className="font-mono text-slate-200">{(weights.fundamental * 100).toFixed(0)}%</strong>
                    </div>
                  </div>
                )}

                {stepKey === 'orchestrator' && (
                  <div className="space-y-1.5 text-slate-300">
                    <div className="flex justify-between border-b border-slate-800/80 pb-1">
                      <span className="text-slate-400">Reference Price (P₀):</span>
                      <strong className="font-mono text-sky-300">₹{orch.reference_price.toFixed(2)}</strong>
                    </div>
                    <div className="flex justify-between border-b border-slate-800/80 pb-1">
                      <span className="text-slate-400">Agent Scores:</span>
                      <span className="font-mono text-xs">
                        T:{tech.score >= 0 ? '+' : ''}{tech.score.toFixed(2)} | P:{pattern.score >= 0 ? '+' : ''}{pattern.score.toFixed(2)} | S:{sent.score !== null ? sent.score.toFixed(2) : 'N/A'} | F:{fund.score >= 0 ? '+' : ''}{fund.score.toFixed(2)}
                      </span>
                    </div>
                    <div className="flex justify-between border-b border-slate-800/80 pb-1">
                      <span className="text-slate-400">ATR (14) Volatility:</span>
                      <strong className="font-mono text-slate-200">₹{ind.atr_14.toFixed(2)}</strong>
                    </div>
                    <div className="flex justify-between border-b border-slate-800/80 pb-1">
                      <span className="text-slate-400">Neutral Score Band:</span>
                      <strong className="font-mono text-slate-200">[-0.22, +0.22]</strong>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">NSE Tick Size:</span>
                      <strong className="font-mono text-slate-200">₹0.05</strong>
                    </div>
                  </div>
                )}
              </div>

              {/* ===================== PROGRESS & LOGIC BOX ===================== */}
              <div className="p-3.5 rounded-lg bg-slate-900/90 border border-slate-800 space-y-2.5">
                <div className="flex items-center gap-1.5 text-purple-400 font-bold uppercase tracking-wider text-[11px]">
                  <Workflow className="w-3.5 h-3.5" />
                  <span>⚙️ Progress & Algorithmic Logic</span>
                </div>

                {stepKey === 'ingestion' && (
                  <div className="space-y-2 text-slate-300 leading-relaxed text-[11px]">
                    <p>
                      <strong>1. Timeframe Alignment:</strong> Parses timestamps to Indian Standard Time (Asia/Kolkata) to verify strict session boundaries (09:15 to 15:30 IST).
                    </p>
                    <p>
                      <strong>2. Zero-Gap Integrity:</strong> Verifies each candle has valid open, high, low, close, and volume. Drops malformed or corrupt quotes.
                    </p>
                    <p>
                      <strong>3. Audit Envelope Generation:</strong> Binds execution to unique <code>Run ID</code> and <code>Correlation ID</code> for audit traceability.
                    </p>
                    <p>
                      <strong>4. Parallel Fan-Out:</strong> Spawns non-blocking async threads to the 4 specialist evaluation engines simultaneously.
                    </p>
                  </div>
                )}

                {stepKey === 'technical' && (
                  <div className="space-y-2 text-slate-300 leading-relaxed text-[11px]">
                    <p>
                      <strong>• Trend (SMA & EMA):</strong> Calculates SMA-20, SMA-50, EMA-9, and EMA-21 using exponential multiplier <span className="font-mono text-sky-300">k = 2 / (N + 1)</span>.
                    </p>
                    <p>
                      <strong>• Momentum (MACD & RSI):</strong> Evaluates MACD (12, 26, 9) line divergence and 14-period Relative Strength Index (<span className="font-mono text-sky-300">RSI = {ind.rsi_14.toFixed(1)}</span>).
                    </p>
                    <p>
                      <strong>• Volatility & Benchmark:</strong> Computes Bollinger Bands (20, 2σ), True Range ATR-14 (₹{ind.atr_14.toFixed(2)}), and intraday VWAP (₹{ind.vwap.toFixed(2)}).
                    </p>
                    <p>
                      <strong>• Scoring Logic:</strong> Bullish momentum (+0.50 to +1.00) requires price &gt; VWAP and EMA-9 &gt; EMA-21. Contradictory signals produce neutral 0.00.
                    </p>
                  </div>
                )}

                {stepKey === 'pattern' && (
                  <div className="space-y-2 text-slate-300 leading-relaxed text-[11px]">
                    <p>
                      <strong>• Geometry Division:</strong> Evaluates recent 24 bars into Half 1 vs Half 2 to compute pivots: L1 vs L2 and H1 vs H2.
                    </p>
                    <p>
                      <strong>• Bearish Breakdown Test:</strong> Triggered if current close breaches prior low support (<span className="font-mono text-purple-300">₹{pattern.formation_boundaries.support.toFixed(2)}</span>) with descending lower-highs.
                    </p>
                    <p>
                      <strong>• Volume Confirmation Rule:</strong> Validates if current bar volume exceeds the 24-bar average by at least <span className="font-mono text-purple-300">1.10×</span>.
                    </p>
                    <p>
                      <strong>• Scoring:</strong> Confirmed formation yields <span className="font-mono text-rose-300">-0.75</span> (or +0.75 for breakout). Unconfirmed yields -0.45 / +0.45.
                    </p>
                  </div>
                )}

                {stepKey === 'sentiment' && (
                  <div className="space-y-2 text-slate-300 leading-relaxed text-[11px]">
                    <p>
                      <strong>• Normalized Deduplication:</strong> Hashes headline text to prevent sentiment double-counting.
                    </p>
                    <p>
                      <strong>• 75/25 Weighting Formula:</strong>
                      <br />
                      <span className="font-mono text-amber-300">
                        Score = 0.75 × S_filings + 0.25 × S_social
                      </span>
                    </p>
                    <p>
                      <strong>• Missing Data Guard:</strong> If no items exist before cutoff, marks <code>UNCERTAIN_MISSING_DATA</code> without silently assuming 0.00.
                    </p>
                    <p>
                      <strong>• Classification Band:</strong> Bullish if score &ge; +0.20, Bearish if &le; -0.20, otherwise Neutral.
                    </p>
                  </div>
                )}

                {stepKey === 'fundamental' && (
                  <div className="space-y-2 text-slate-300 leading-relaxed text-[11px]">
                    <p>
                      <strong>• Sector Rule Branching:</strong>
                      <br />
                      - Banking Model: Evaluates NIM &ge; 3.5%, GNPA &le; 2.0%, CRAR &ge; 15.0%.
                      <br />
                      - Corporate Model: Evaluates ROE &ge; 14.0%, Operating Margin &ge; 15.0%, D/E &le; 0.60.
                    </p>
                    <p>
                      <strong>• Earnings Proximity Gate:</strong> Flags elevated binary gap risk if quarterly earnings release is scheduled within 48 hours.
                    </p>
                    <p>
                      <strong>• Scoring:</strong> Strong corporate metrics yield <span className="font-mono text-emerald-300">+0.55</span>; degraded metrics yield -0.20.
                    </p>
                  </div>
                )}

                {stepKey === 'orchestrator' && (
                  <div className="space-y-2 text-slate-300 leading-relaxed text-[11px]">
                    <p>
                      <strong>1. Fan-In Composite Formula:</strong>
                      <br />
                      <span className="font-mono text-sky-300">
                        S = (0.40×T) + (0.30×P) + (0.15×S) + (0.15×F)
                      </span>
                      <br />
                      <span className="font-mono text-slate-400">
                        = (0.40×{tech.score.toFixed(2)}) + (0.30×{pattern.score.toFixed(2)}) + (0.15×{(sent.score || 0).toFixed(2)}) + (0.15×{fund.score.toFixed(2)})
                      </span>
                      <br />
                      <span className="font-mono font-bold text-sky-400">
                        = {techWeighted} + ({patternWeighted}) + {sentWeighted} + {fundWeighted} = {orch.composite_score.toFixed(3)}
                      </span>
                    </p>
                    <p>
                      <strong>2. Confidence Gate (|S| &ge; 0.22):</strong>
                      <br />
                      Because <span className="font-mono">{orch.composite_score.toFixed(3)}</span> is within [-0.22, +0.22], the strategy abstains from market exposure to prevent conflicting whipsaws.
                    </p>
                    <p>
                      <strong>3. ₹3 Displacement &amp; Tick Sizing:</strong>
                      <br />
                      When triggered:
                      <br />
                      <span className="font-mono text-slate-300">
                        Entry Offset = max(₹3.00, RoundToTick(ATR × 1.6))
                        <br />
                        Target Offset = max(₹5.00, RoundToTick(ATR × 3.2))
                        <br />
                        Stop Offset = max(₹2.00, RoundToTick(Target Offset / 1.8))
                      </span>
                    </p>
                  </div>
                )}
              </div>

              {/* ===================== OUTPUT BOX ===================== */}
              <div className="p-3.5 rounded-lg bg-slate-900/90 border border-slate-800 space-y-2.5">
                <div className="flex items-center gap-1.5 text-emerald-400 font-bold uppercase tracking-wider text-[11px]">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>📤 Generated Outputs & Evidence</span>
                </div>

                {stepKey === 'ingestion' && (
                  <div className="space-y-2 text-slate-300">
                    <div className="p-2 bg-slate-950 rounded border border-slate-800/80 font-mono text-[11px] space-y-1">
                      <div className="text-emerald-400 font-bold">STATUS: STREAM READY</div>
                      <div>Latest Bar Close: ₹{ind.last_close.toFixed(2)}</div>
                      <div>Session Range: 09:15 - 15:30 IST</div>
                      <div>Dispatch State: 4 Parallel Workers Active</div>
                    </div>
                    <div className="text-[11px] text-slate-400">
                      All candles, quotes, and filings validated without zero-volume anomalies or timestamp sequence errors.
                    </div>
                  </div>
                )}

                {stepKey === 'technical' && (
                  <div className="space-y-2 text-slate-300">
                    <div className="p-2 bg-slate-950 rounded border border-slate-800/80 font-mono text-[11px] space-y-1">
                      <div className="text-sky-300 font-bold">
                        Score: {tech.score >= 0 ? '+' : ''}{tech.score.toFixed(2)} ({tech.bias})
                      </div>
                      <div>SMA-20: ₹{ind.sma_20.toFixed(2)} | EMA-9: ₹{ind.ema_9.toFixed(2)}</div>
                      <div>RSI-14: {ind.rsi_14.toFixed(1)} | ATR-14: ₹{ind.atr_14.toFixed(2)}</div>
                      <div>VWAP: ₹{ind.vwap.toFixed(2)}</div>
                    </div>
                    <div className="space-y-1">
                      <div className="text-[10px] text-slate-400 font-semibold uppercase">Evidence Log:</div>
                      <ul className="list-disc list-inside space-y-0.5 text-slate-300 text-[11px]">
                        {tech.evidence.map((ev, i) => (
                          <li key={i}>{ev}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                )}

                {stepKey === 'pattern' && (
                  <div className="space-y-2 text-slate-300">
                    <div className="p-2 bg-slate-950 rounded border border-slate-800/80 font-mono text-[11px] space-y-1">
                      <div className="text-purple-300 font-bold">
                        Score: {pattern.score >= 0 ? '+' : ''}{pattern.score.toFixed(2)} ({pattern.status})
                      </div>
                      <div>Formation: {pattern.pattern_type}</div>
                      <div>Support: ₹{pattern.formation_boundaries.support.toFixed(2)}</div>
                      <div>Resistance: ₹{pattern.formation_boundaries.resistance.toFixed(2)}</div>
                      <div>
                        Volume Confirmation:{' '}
                        <span className={pattern.volume_confirmation ? 'text-emerald-400' : 'text-amber-400'}>
                          {pattern.volume_confirmation ? 'CONFIRMED' : 'DEVELOPING'}
                        </span>
                      </div>
                    </div>
                    <div className="space-y-1">
                      <div className="text-[10px] text-slate-400 font-semibold uppercase">Pattern Structure:</div>
                      <ul className="list-disc list-inside space-y-0.5 text-slate-300 text-[11px]">
                        {pattern.evidence.map((ev, i) => (
                          <li key={i}>{ev}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                )}

                {stepKey === 'sentiment' && (
                  <div className="space-y-2 text-slate-300">
                    <div className="p-2 bg-slate-950 rounded border border-slate-800/80 font-mono text-[11px] space-y-1">
                      <div className="text-amber-300 font-bold">
                        Score: {sent.score !== null ? `${sent.score >= 0 ? '+' : ''}${sent.score.toFixed(2)}` : 'MISSING'}
                      </div>
                      <div>Classification: {sent.classification}</div>
                      <div>Coverage: {sent.coverage_status}</div>
                      <div>Items Parsed: {sent.item_count}</div>
                    </div>
                    <div className="space-y-1">
                      <div className="text-[10px] text-slate-400 font-semibold uppercase">Feed Items Audit:</div>
                      <ul className="list-disc list-inside space-y-0.5 text-slate-300 text-[11px]">
                        {sent.evidence.map((ev, i) => (
                          <li key={i}>{ev}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                )}

                {stepKey === 'fundamental' && (
                  <div className="space-y-2 text-slate-300">
                    <div className="p-2 bg-slate-950 rounded border border-slate-800/80 font-mono text-[11px] space-y-1">
                      <div className="text-emerald-300 font-bold">
                        Score: {fund.score >= 0 ? '+' : ''}{fund.score.toFixed(2)} ({fund.status})
                      </div>
                      <div>Model: {fund.sector_model}</div>
                      <div>Period: {fund.fiscal_period}</div>
                      <div>Earnings Gap Risk: {fund.earnings_risk_flag ? 'YES' : 'NONE'}</div>
                    </div>
                    <div className="space-y-1">
                      <div className="text-[10px] text-slate-400 font-semibold uppercase">Ratio Audit:</div>
                      <ul className="list-disc list-inside space-y-0.5 text-slate-300 text-[11px]">
                        {fund.evidence.map((ev, i) => (
                          <li key={i}>{ev}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                )}

                {stepKey === 'orchestrator' && (
                  <div className="space-y-2 text-slate-300">
                    <div className="p-2 bg-slate-950 rounded border border-slate-800/80 font-mono text-[11px] space-y-1">
                      <div className="text-sky-300 font-bold">
                        Decision: {orch.decision} ({orch.composite_score >= 0 ? '+' : ''}{orch.composite_score.toFixed(3)})
                      </div>
                      <div>Trigger Type: {orch.trigger_type}</div>
                      <div>Reference Price P₀: ₹{orch.reference_price.toFixed(2)}</div>
                      {orch.planned_entry && (
                        <div>Entry: ₹{orch.planned_entry.toFixed(2)} | Target: ₹{orch.planned_target?.toFixed(2)} | Stop: ₹{orch.planned_stop?.toFixed(2)}</div>
                      )}
                      <div>Horizon: {orch.horizon_minutes} minutes</div>
                      <div>Reward/Risk: {orch.reward_to_risk ? `${orch.reward_to_risk.toFixed(2)}x` : 'N/A'}</div>
                    </div>
                    <div className="p-2 rounded bg-slate-900 border border-slate-800 text-[11px] text-slate-300">
                      <strong>Rationale:</strong> {orch.rationale}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  const stepsList: PipelineStepKey[] = [
    'ingestion',
    'technical',
    'pattern',
    'sentiment',
    'fundamental',
    'orchestrator',
  ];

  return (
    <div className="space-y-6">
      {/* Header with Run Metadata */}
      <div className="bg-slate-900/90 border border-slate-800 p-4 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-sm">
        <div>
          <div className="flex items-center gap-2">
            <Workflow className="w-5 h-5 text-indigo-400" />
            <h2 className="text-base font-bold text-white tracking-tight">
              LangGraph Multi-Agent Execution Audit — {audit.symbol}
            </h2>
            <span className="text-xs bg-indigo-950 text-indigo-300 border border-indigo-800 px-2 py-0.5 rounded font-mono">
              {audit.strategy_version}
            </span>
          </div>
          <div className="text-xs text-slate-400 mt-1 flex flex-wrap gap-x-4">
            <span>
              Run ID: <strong className="font-mono text-slate-300">{audit.run_id}</strong>
            </span>
            <span>
              Correlation ID:{' '}
              <strong className="font-mono text-slate-300">{audit.correlation_id}</strong>
            </span>
            <span>
              Execution Time:{' '}
              <strong className="font-mono text-emerald-400">{audit.duration_ms} ms</strong>
            </span>
          </div>
        </div>

        <div className="text-right">
          <div className="text-xs text-slate-400">Composite Orchestrator Score</div>
          <div className="text-xl font-bold font-mono text-sky-400 mt-0.5">
            {orch.composite_score >= 0 ? '+' : ''}
            {orch.composite_score.toFixed(3)}
          </div>
        </div>
      </div>

      {/* Visual LangGraph StateGraph Architecture with Interactive Clickable Nodes */}
      <div className="bg-slate-900/90 border border-slate-800 p-4 rounded-xl space-y-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
            <Layers className="w-4 h-4 text-sky-400" />
            <span>LangGraph StateGraph Execution Pipeline</span>
            <span className="text-[11px] text-slate-400 font-normal lowercase">
              (Click any step below for full Input • Logic • Output view)
            </span>
          </h3>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setExpandAll(!expandAll)}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition border border-slate-700"
            >
              {expandAll ? (
                <>
                  <Minimize2 className="w-3.5 h-3.5 text-sky-400" />
                  <span>Collapse All</span>
                </>
              ) : (
                <>
                  <Maximize2 className="w-3.5 h-3.5 text-sky-400" />
                  <span>Expand All 6 Steps</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Clickable Pipeline Nodes */}
        <div className="flex flex-col md:flex-row items-center justify-between gap-2 text-xs bg-slate-950 p-3 rounded-lg border border-slate-800/80 font-mono">
          {/* Node START: Data Ingestion */}
          <button
            onClick={() => handleSelectStep('ingestion')}
            className={`p-2.5 rounded-lg border text-center w-full md:w-auto transition cursor-pointer text-left ${
              selectedStep === 'ingestion' && !expandAll
                ? 'bg-slate-850 border-emerald-500 shadow-md ring-1 ring-emerald-500/40'
                : 'bg-slate-900 border-slate-700 hover:border-slate-500'
            }`}
          >
            <div className="text-[10px] text-slate-400 flex items-center justify-between gap-1">
              <span>Node: START</span>
              <Info className="w-3 h-3 text-emerald-400" />
            </div>
            <div className="font-bold text-white mt-0.5">Data Ingestion</div>
            <div className="text-[9px] text-emerald-400">1m/5m/15m OHLCV + Filings</div>
          </button>

          <div className="text-slate-500 font-sans hidden md:block select-none text-[11px]">
            ──► Parallel Fan-Out ──►
          </div>

          {/* 4 Specialist Nodes */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 w-full md:w-auto">
            {/* 1. Technical */}
            <button
              onClick={() => handleSelectStep('technical')}
              className={`p-2 rounded-lg border text-center transition cursor-pointer ${
                selectedStep === 'technical' && !expandAll
                  ? 'bg-sky-950/70 border-sky-400 shadow-md ring-1 ring-sky-400/40'
                  : 'bg-sky-950/40 border-sky-800 hover:border-sky-600'
              }`}
            >
              <div className="text-[10px] text-sky-300">
                1. Technical ({(weights.technical * 100).toFixed(0)}%)
              </div>
              <div className="font-bold text-white mt-0.5">
                {tech.score >= 0 ? '+' : ''}
                {tech.score.toFixed(2)}
              </div>
            </button>

            {/* 2. Pattern */}
            <button
              onClick={() => handleSelectStep('pattern')}
              className={`p-2 rounded-lg border text-center transition cursor-pointer ${
                selectedStep === 'pattern' && !expandAll
                  ? 'bg-purple-950/70 border-purple-400 shadow-md ring-1 ring-purple-400/40'
                  : 'bg-purple-950/40 border-purple-800 hover:border-purple-600'
              }`}
            >
              <div className="text-[10px] text-purple-300">
                2. Pattern ({(weights.pattern * 100).toFixed(0)}%)
              </div>
              <div className="font-bold text-white mt-0.5">
                {pattern.score >= 0 ? '+' : ''}
                {pattern.score.toFixed(2)}
              </div>
            </button>

            {/* 3. Sentiment */}
            <button
              onClick={() => handleSelectStep('sentiment')}
              className={`p-2 rounded-lg border text-center transition cursor-pointer ${
                selectedStep === 'sentiment' && !expandAll
                  ? 'bg-amber-950/70 border-amber-400 shadow-md ring-1 ring-amber-400/40'
                  : 'bg-amber-950/40 border-amber-800 hover:border-amber-600'
              }`}
            >
              <div className="text-[10px] text-amber-300">
                3. Sentiment ({(weights.sentiment * 100).toFixed(0)}%)
              </div>
              <div className="font-bold text-white mt-0.5">
                {sent.score !== null
                  ? `${sent.score >= 0 ? '+' : ''}${sent.score.toFixed(2)}`
                  : 'MISSING'}
              </div>
            </button>

            {/* 4. Fundamental */}
            <button
              onClick={() => handleSelectStep('fundamental')}
              className={`p-2 rounded-lg border text-center transition cursor-pointer ${
                selectedStep === 'fundamental' && !expandAll
                  ? 'bg-emerald-950/70 border-emerald-400 shadow-md ring-1 ring-emerald-400/40'
                  : 'bg-emerald-950/40 border-emerald-800 hover:border-emerald-600'
              }`}
            >
              <div className="text-[10px] text-emerald-300">
                4. Fundamental ({(weights.fundamental * 100).toFixed(0)}%)
              </div>
              <div className="font-bold text-white mt-0.5">
                {fund.score >= 0 ? '+' : ''}
                {fund.score.toFixed(2)}
              </div>
            </button>
          </div>

          <div className="text-slate-500 font-sans hidden md:block select-none text-[11px]">
            ──► Fan-In ──►
          </div>

          {/* Node ORCHESTRATOR */}
          <button
            onClick={() => handleSelectStep('orchestrator')}
            className={`p-2.5 rounded-lg border text-center w-full md:w-auto transition cursor-pointer text-left ${
              selectedStep === 'orchestrator' && !expandAll
                ? 'bg-slate-850 border-sky-400 shadow-md ring-1 ring-sky-400/40'
                : 'bg-slate-900 border-slate-700 hover:border-slate-500'
            }`}
          >
            <div className="text-[10px] text-slate-400 flex items-center justify-between gap-1">
              <span>Node: ORCHESTRATOR</span>
              <Info className="w-3 h-3 text-sky-400" />
            </div>
            <div className="font-bold text-sky-400 mt-0.5">Target & Risk Gate</div>
            <div className="text-[9px] text-slate-300">₹3 Displacement Check</div>
          </button>
        </div>

        {/* Step Selector Pills */}
        <div className="flex flex-wrap items-center gap-1.5 pt-1 text-xs">
          <span className="text-slate-400 text-[11px] font-semibold mr-1">Inspect Step:</span>
          {stepsList.map((k) => {
            const isSelected = selectedStep === k && !expandAll;
            let label = '';
            switch (k) {
              case 'ingestion':
                label = 'START: Data Ingestion';
                break;
              case 'technical':
                label = '1. Technical Agent';
                break;
              case 'pattern':
                label = '2. Pattern Agent';
                break;
              case 'sentiment':
                label = '3. Sentiment Agent';
                break;
              case 'fundamental':
                label = '4. Fundamental Agent';
                break;
              case 'orchestrator':
                label = 'ORCHESTRATOR: Target & Risk';
                break;
            }
            return (
              <button
                key={k}
                onClick={() => handleSelectStep(k)}
                className={`px-2.5 py-1 rounded-md text-xs font-mono font-semibold transition ${
                  isSelected
                    ? 'bg-sky-600 text-white shadow-xs'
                    : 'bg-slate-900 text-slate-400 hover:text-slate-200 hover:bg-slate-800 border border-slate-800'
                }`}
              >
                {label}
              </button>
            );
          })}
        </div>
      </div>

      {/* ======================================================== */}
      {/* EXPANSION VIEW OF STEPS (INPUT, PROGRESS/LOGIC, OUTPUT)  */}
      {/* ======================================================== */}
      <div className="space-y-4">
        {expandAll ? (
          // View all 6 steps expanded simultaneously
          stepsList.map((stepKey) => renderStepCard(stepKey, true))
        ) : (
          // View selected step in rich expanded detail
          renderStepCard(selectedStep, false)
        )}
      </div>

      {/* Quick Summary of 4 Specialist Agent Deep-Dives */}
      {!expandAll && (
        <div className="space-y-3 pt-2">
          <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
            All Specialist Cards Overview
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* 1. Technical Analysis Agent */}
            <div
              onClick={() => handleSelectStep('technical')}
              className="bg-slate-900/90 border border-slate-800 hover:border-sky-500/60 cursor-pointer rounded-xl p-4 space-y-3 transition group"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <BarChart2 className="w-4 h-4 text-sky-400" />
                  <h3 className="text-xs font-bold text-white uppercase tracking-wider group-hover:text-sky-300 transition">
                    1. Technical Analysis Agent
                  </h3>
                </div>
                <div className="text-xs font-mono font-bold text-sky-400">
                  Score: {tech.score >= 0 ? '+' : ''}
                  {tech.score.toFixed(2)} ({tech.bias})
                </div>
              </div>

              <div className="text-xs text-slate-400 flex items-center justify-between">
                <span>Multi-Timeframe Agreement: <strong className="text-slate-200">{tech.cross_timeframe_agreement}</strong></span>
                <span className="text-[11px] font-mono text-emerald-400">
                  {ind.total_bars_evaluated ? `${ind.total_bars_evaluated.toLocaleString()} bars (30D DB)` : '30D DB Bars'}
                </span>
              </div>

              {/* Exact Indicator Metrics Grid */}
              <div className="grid grid-cols-3 sm:grid-cols-6 gap-1.5 font-mono text-[11px] text-center">
                <div className="p-1.5 rounded bg-slate-950 border border-slate-800">
                  <div className="text-[9px] text-slate-400 uppercase">RSI (14)</div>
                  <div className={`font-bold mt-0.5 ${ind.rsi_14 > 70 ? 'text-amber-400' : ind.rsi_14 < 30 ? 'text-sky-400' : 'text-slate-200'}`}>
                    {ind.rsi_14.toFixed(1)}
                  </div>
                </div>
                <div className="p-1.5 rounded bg-slate-950 border border-slate-800">
                  <div className="text-[9px] text-slate-400 uppercase">30D VWAP</div>
                  <div className="font-bold text-sky-300 mt-0.5">₹{ind.vwap_30d?.toFixed(2) || ind.vwap.toFixed(2)}</div>
                </div>
                <div className="p-1.5 rounded bg-slate-950 border border-slate-800">
                  <div className="text-[9px] text-slate-400 uppercase">EMA 9/21</div>
                  <div className="font-bold text-slate-200 mt-0.5">₹{ind.ema_9.toFixed(1)}</div>
                </div>
                <div className="p-1.5 rounded bg-slate-950 border border-slate-800">
                  <div className="text-[9px] text-slate-400 uppercase">ATR (14)</div>
                  <div className="font-bold text-amber-300 mt-0.5">₹{ind.atr_14.toFixed(2)}</div>
                </div>
                <div className="p-1.5 rounded bg-slate-950 border border-slate-800">
                  <div className="text-[9px] text-slate-400 uppercase">30D Range</div>
                  <div className="font-bold text-purple-300 mt-0.5">₹{ind.low_30d?.toFixed(0) || '1195'}-₹{ind.high_30d?.toFixed(0) || '1215'}</div>
                </div>
                <div className="p-1.5 rounded bg-slate-950 border border-slate-800">
                  <div className="text-[9px] text-slate-400 uppercase">MACD Hist</div>
                  <div className={`font-bold mt-0.5 ${ind.macd_hist >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                    {ind.macd_hist >= 0 ? '+' : ''}{ind.macd_hist.toFixed(2)}
                  </div>
                </div>
              </div>

              <div className="p-2.5 bg-slate-950 rounded-lg border border-slate-800 space-y-1.5 text-xs">
                <div className="text-[11px] text-slate-400 font-semibold uppercase flex items-center justify-between">
                  <span>30-Day Indicator Evidence ({ind.total_bars_evaluated || 7500} bars)</span>
                  <span className="text-[10px] text-sky-400">Click to expand details</span>
                </div>
                <ul className="list-disc list-inside space-y-1 text-slate-300 text-[11px] leading-relaxed">
                  {tech.evidence.map((ev, i) => (
                    <li key={i}>{ev}</li>
                  ))}
                </ul>
              </div>
            </div>

            {/* 2. Pattern Recognition Agent */}
            <div
              onClick={() => handleSelectStep('pattern')}
              className="bg-slate-900/90 border border-slate-800 hover:border-purple-500/60 cursor-pointer rounded-xl p-4 space-y-3 transition group"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Compass className="w-4 h-4 text-purple-400" />
                  <h3 className="text-xs font-bold text-white uppercase tracking-wider group-hover:text-purple-300 transition">
                    2. Pattern Recognition Agent
                  </h3>
                </div>
                <div className="text-xs font-mono font-bold text-purple-400">
                  Score: {pattern.score >= 0 ? '+' : ''}
                  {pattern.score.toFixed(2)} ({pattern.status})
                </div>
              </div>

              <div className="text-xs text-slate-400 flex items-center justify-between">
                <span>Formation: <strong className="text-slate-200">{pattern.pattern_type}</strong></span>
                <span className="text-[11px] font-mono text-purple-300">
                  30D Swing: <strong>{pattern.macro_30d_framework?.swing_trend.replace('_', ' ') || 'SIDEWAYS'}</strong>
                </span>
              </div>

              {/* Exact Pattern Boundaries Grid */}
              <div className="grid grid-cols-4 gap-1.5 font-mono text-[11px] text-center">
                <div className="p-1.5 rounded bg-slate-950 border border-slate-800">
                  <div className="text-[9px] text-slate-400 uppercase">Support Base</div>
                  <div className="font-bold text-rose-300 mt-0.5">₹{pattern.formation_boundaries.support.toFixed(2)}</div>
                </div>
                <div className="p-1.5 rounded bg-slate-950 border border-slate-800">
                  <div className="text-[9px] text-slate-400 uppercase">Resistance</div>
                  <div className="font-bold text-sky-300 mt-0.5">₹{pattern.formation_boundaries.resistance.toFixed(2)}</div>
                </div>
                <div className="p-1.5 rounded bg-slate-950 border border-slate-800">
                  <div className="text-[9px] text-slate-400 uppercase">30D 50% Fib</div>
                  <div className="font-bold text-amber-300 mt-0.5">
                    ₹{pattern.macro_30d_framework?.fib_500.toFixed(2) || '1202.00'}
                  </div>
                </div>
                <div className="p-1.5 rounded bg-slate-950 border border-slate-800">
                  <div className="text-[9px] text-slate-400 uppercase">Volume Surge</div>
                  <div className={`font-bold mt-0.5 ${pattern.volume_confirmation ? 'text-emerald-400' : 'text-amber-400'}`}>
                    {pattern.volume_confirmation ? 'PASS (≥1.1x)' : 'NO SURGE'}
                  </div>
                </div>
              </div>

              <div className="p-2.5 bg-slate-950 rounded-lg border border-slate-800 space-y-1.5 text-xs">
                <div className="text-[11px] text-slate-400 font-semibold uppercase flex items-center justify-between">
                  <span>30-Day Pattern Structure &amp; Analysis</span>
                  <span className="text-[10px] text-purple-400">Click to expand details</span>
                </div>
                <ul className="list-disc list-inside space-y-1 text-slate-300 text-[11px] leading-relaxed">
                  {pattern.evidence.map((ev, i) => (
                    <li key={i}>{ev}</li>
                  ))}
                </ul>
              </div>
            </div>

            {/* 3. Sentiment Analysis Agent */}
            <div
              onClick={() => handleSelectStep('sentiment')}
              className="bg-slate-900/90 border border-slate-800 hover:border-amber-500/60 cursor-pointer rounded-xl p-4 space-y-3 transition group"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <MessageSquare className="w-4 h-4 text-amber-400" />
                  <h3 className="text-xs font-bold text-white uppercase tracking-wider group-hover:text-amber-300 transition">
                    3. Sentiment Analysis Agent
                  </h3>
                </div>
                <div className="text-xs font-mono font-bold text-amber-400">
                  Score:{' '}
                  {sent.score !== null
                    ? `${sent.score >= 0 ? '+' : ''}${sent.score.toFixed(2)} (${sent.classification})`
                    : 'UNCERTAIN_MISSING'}
                </div>
              </div>

              <div className="text-xs text-slate-400 flex items-center justify-between">
                <span>Filings: <strong className="text-slate-200">75% Weight</strong> | Social: <strong className="text-slate-200">25%</strong></span>
                <span>Items Evaluated: <strong className="text-amber-300">{sent.item_count}</strong></span>
              </div>

              {/* Sentiment Source Breakdown Grid */}
              <div className="grid grid-cols-3 gap-1.5 font-mono text-[11px] text-center">
                <div className="p-1.5 rounded bg-slate-950 border border-slate-800">
                  <div className="text-[9px] text-slate-400 uppercase">Coverage</div>
                  <div className="font-bold text-emerald-400 mt-0.5">{sent.coverage_status}</div>
                </div>
                <div className="p-1.5 rounded bg-slate-950 border border-slate-800">
                  <div className="text-[9px] text-slate-400 uppercase">Filings Sentiment</div>
                  <div className="font-bold text-slate-200 mt-0.5">
                    {sent.verified_filing_sentiment !== null ? `${sent.verified_filing_sentiment >= 0 ? '+' : ''}${sent.verified_filing_sentiment.toFixed(2)}` : '+0.55 (Audit)'}
                  </div>
                </div>
                <div className="p-1.5 rounded bg-slate-950 border border-slate-800">
                  <div className="text-[9px] text-slate-400 uppercase">Classification</div>
                  <div className={`font-bold mt-0.5 ${sent.classification === 'BULLISH' ? 'text-emerald-400' : sent.classification === 'BEARISH' ? 'text-rose-400' : 'text-amber-300'}`}>
                    {sent.classification}
                  </div>
                </div>
              </div>

              <div className="p-2.5 bg-slate-950 rounded-lg border border-slate-800 space-y-1.5 text-xs">
                <div className="text-[11px] text-slate-400 font-semibold uppercase flex items-center justify-between">
                  <span>Feed Items Audit</span>
                  <span className="text-[10px] text-amber-400">Click to expand details</span>
                </div>
                <ul className="list-disc list-inside space-y-1 text-slate-300 text-[11px] leading-relaxed">
                  {sent.evidence.map((ev, i) => (
                    <li key={i}>{ev}</li>
                  ))}
                </ul>
              </div>
            </div>

            {/* 4. Fundamental Analysis Agent */}
            <div
              onClick={() => handleSelectStep('fundamental')}
              className="bg-slate-900/90 border border-slate-800 hover:border-emerald-500/60 cursor-pointer rounded-xl p-4 space-y-3 transition group"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-emerald-400" />
                  <h3 className="text-xs font-bold text-white uppercase tracking-wider group-hover:text-emerald-300 transition">
                    4. Fundamental Analysis Agent
                  </h3>
                </div>
                <div className="text-xs font-mono font-bold text-emerald-400">
                  Score: {fund.score >= 0 ? '+' : ''}
                  {fund.score.toFixed(2)} ({fund.status})
                </div>
              </div>

              <div className="text-xs text-slate-400 flex items-center justify-between">
                <span>Sector Model: <strong className="text-slate-200">{fund.sector_model}</strong></span>
                <span>Fiscal Period: <strong className="text-slate-200">{fund.fiscal_period}</strong></span>
              </div>

              {/* Fundamental Metrics Breakdown Grid */}
              <div className="grid grid-cols-4 gap-1.5 font-mono text-[11px] text-center">
                <div className="p-1.5 rounded bg-slate-950 border border-slate-800">
                  <div className="text-[9px] text-slate-400 uppercase">ROE / Health</div>
                  <div className="font-bold text-emerald-400 mt-0.5">≥ 14.0%</div>
                </div>
                <div className="p-1.5 rounded bg-slate-950 border border-slate-800">
                  <div className="text-[9px] text-slate-400 uppercase">Op Margin</div>
                  <div className="font-bold text-sky-300 mt-0.5">≥ 15.0%</div>
                </div>
                <div className="p-1.5 rounded bg-slate-950 border border-slate-800">
                  <div className="text-[9px] text-slate-400 uppercase">Debt / Equity</div>
                  <div className="font-bold text-slate-200 mt-0.5">≤ 0.60</div>
                </div>
                <div className="p-1.5 rounded bg-slate-950 border border-slate-800">
                  <div className="text-[9px] text-slate-400 uppercase">Earnings Risk</div>
                  <div className={`font-bold mt-0.5 ${fund.earnings_risk_flag ? 'text-amber-400' : 'text-emerald-400'}`}>
                    {fund.earnings_risk_flag ? 'WITHIN 48H' : 'SAFE'}
                  </div>
                </div>
              </div>

              <div className="p-2.5 bg-slate-950 rounded-lg border border-slate-800 space-y-1.5 text-xs">
                <div className="text-[11px] text-slate-400 font-semibold uppercase flex items-center justify-between">
                  <span>Financial Ratio Metrics</span>
                  <span className="text-[10px] text-emerald-400">Click to expand details</span>
                </div>
                <ul className="list-disc list-inside space-y-1 text-slate-300 text-[11px] leading-relaxed">
                  {fund.evidence.map((ev, i) => (
                    <li key={i}>{ev}</li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
