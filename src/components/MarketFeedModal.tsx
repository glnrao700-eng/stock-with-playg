import React from 'react';
import { X, Radio, Wifi, Zap, ExternalLink, Play, Pause, AlertCircle, CheckCircle2 } from 'lucide-react';
import { SessionStatus } from '../types/platform';

interface MarketFeedModalProps {
  isOpen: boolean;
  onClose: () => void;
  sessionStatus: SessionStatus;
  isAutoPlaying: boolean;
  onToggleAutoPlay: () => void;
  streamSpeed: number;
  onChangeStreamSpeed: (speed: number) => void;
  isUpstoxConnected?: boolean;
  onOpenUpstoxModal?: () => void;
}

export const MarketFeedModal: React.FC<MarketFeedModalProps> = ({
  isOpen,
  onClose,
  sessionStatus,
  isAutoPlaying,
  onToggleAutoPlay,
  streamSpeed,
  onChangeStreamSpeed,
  isUpstoxConnected = false,
  onOpenUpstoxModal,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="bg-slate-900 border border-slate-700 rounded-xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-800 bg-slate-950 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded bg-sky-600 flex items-center justify-center text-white font-bold text-sm">
              <Radio className="w-4 h-4 text-white" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white tracking-wide">
                Live Market Data & Pricing Architecture
              </h2>
              <div className="text-[11px] text-slate-400">
                Why prices don't tick automatically and how live streaming works in this platform
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
          {/* Current Live Session Status Banner */}
          <div
            className={`p-3.5 rounded-lg border flex items-center justify-between gap-3 ${
              sessionStatus.is_market_open
                ? 'bg-emerald-950/50 border-emerald-800/80'
                : 'bg-indigo-950/50 border-indigo-800/80'
            }`}
          >
            <div className="flex items-center gap-3">
              <span className="relative flex h-3 w-3">
                {sessionStatus.is_market_open && (
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                )}
                <span
                  className={`relative inline-flex rounded-full h-3 w-3 ${
                    sessionStatus.is_market_open ? 'bg-emerald-500' : 'bg-indigo-500'
                  }`}
                ></span>
              </span>
              <div>
                <div className="font-semibold text-white">
                  {sessionStatus.is_market_open
                    ? 'NSE Regular Trading Session is OPEN'
                    : 'NSE Session is Currently CLOSED'}
                </div>
                <div className="text-[11px] text-slate-400 font-mono">
                  Current IST: {sessionStatus.ist_timestamp} • Phase: {sessionStatus.phase}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={onToggleAutoPlay}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-semibold shadow-sm transition ${
                  isAutoPlaying
                    ? 'bg-amber-600 hover:bg-amber-500 text-white'
                    : 'bg-emerald-600 hover:bg-emerald-500 text-white'
                }`}
              >
                {isAutoPlaying ? (
                  <>
                    <Pause className="w-3.5 h-3.5" /> Pause Stream
                  </>
                ) : (
                  <>
                    <Play className="w-3.5 h-3.5" /> Start Live Stream
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Quick Explanation */}
          <div className="bg-slate-950 p-4 rounded-lg border border-slate-800 space-y-3">
            <h3 className="text-white font-bold text-sm flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-sky-400" />
              Why wasn't the price changing during market hours?
            </h3>
            <p>
              There are two primary reasons why the price was static:
            </p>
            <ol className="list-decimal list-inside space-y-2 text-slate-300">
              <li>
                <strong className="text-white">The Multi-Agent Engine Defaults to Step Mode (Paused):</strong>{' '}
                This platform is an institutional algorithmic testing and decision workbench. By default, it stays paused at the current minute so traders can inspect agent calculations ($P_0$, Breakout Entry, Stop, Target, Sentiment, Order Flow) before advancing. To make prices move continuously, you must start the <strong>Live Stream / Auto-Run</strong>.
              </li>
              <li>
                <strong className="text-white">Exchange Licensing & WebSocket Feeds:</strong>{' '}
                Direct tick-by-tick market data from the National Stock Exchange of India (NSE) requires an authorized broker subscription (e.g., Zerodha Kite Connect WebSocket or Upstox API). Client-side web apps cannot listen to exchange multicast feeds without broker credentials.
              </li>
            </ol>
          </div>

          {/* How to Get Live Prices & Calibrate */}
          <div className="bg-slate-950 p-4 rounded-lg border border-slate-800 space-y-3">
            <h3 className="text-white font-bold text-sm flex items-center gap-2">
              <Zap className="w-4 h-4 text-amber-400" />
              How to Match App Prices With Your Trading Screen
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="p-3 rounded bg-slate-900 border border-slate-800 space-y-2">
                <div className="font-semibold text-sky-300 flex items-center gap-1.5">
                  <Play className="w-3.5 h-3.5" /> 1. Start Live Stream
                </div>
                <p className="text-[11px] text-slate-400">
                  Turns on automatic tick generation every {streamSpeed}s and recalculates all 8 agents in real time.
                </p>
                <div className="flex items-center gap-2 pt-1">
                  <span className="text-[11px] text-slate-400">Speed:</span>
                  {[1, 2, 3, 5].map((spd) => (
                    <button
                      key={spd}
                      onClick={() => onChangeStreamSpeed(spd)}
                      className={`px-2 py-0.5 rounded text-[11px] font-mono transition ${
                        streamSpeed === spd
                          ? 'bg-sky-600 text-white font-bold'
                          : 'bg-slate-800 text-slate-400 hover:text-white'
                      }`}
                    >
                      {spd}s
                    </button>
                  ))}
                </div>
              </div>

              <div className="p-3 rounded bg-slate-900 border border-slate-800 space-y-2">
                <div className="font-semibold text-amber-300 flex items-center gap-1.5">
                  <AlertCircle className="w-3.5 h-3.5" /> 2. Calibrate Price
                </div>
                <p className="text-[11px] text-slate-400">
                  In Level 2 beside "Current Price", click <strong>"Calibrate"</strong> or visit <strong>Level 6</strong> to enter the exact broker price or 1-click sync to current market reference.
                </p>
              </div>

              <div className="p-3 rounded bg-slate-900 border border-slate-800 space-y-2">
                <div className="font-semibold text-emerald-300 flex items-center gap-1.5">
                  <ExternalLink className="w-3.5 h-3.5" /> 3. TradingView Widget
                </div>
                <p className="text-[11px] text-slate-400">
                  In Level 2, toggle <strong>"TradingView (Official)"</strong> right under the chart to view direct cloud tick streams from TradingView.
                </p>
              </div>
            </div>
          </div>

          {/* Real Broker API Architecture */}
          <div className="p-3.5 rounded-lg bg-slate-950/60 border border-slate-800 text-[11px] text-slate-400 space-y-1.5">
            <div className="font-semibold text-slate-200">
              🔌 Real Indian Broker WebSocket Integration (Zerodha Kite, Upstox, Angel One)
            </div>
            <p>
              SEBI regulations prohibit open web browser apps from scraping NSE direct live streams without an authorized broker API token (due to CORS security). In production, configure your Zerodha Kite Connect WebSocket (<code>wss://ws.kite.trade</code>) or Upstox WebSocket v2 in Level 6. The multi-agent pipeline immediately consumes the direct broker feed.
            </p>
            {onOpenUpstoxModal && (
              <button
                onClick={() => {
                  onClose();
                  onOpenUpstoxModal();
                }}
                className={`mt-2 w-full py-2 rounded text-xs font-semibold flex items-center justify-center gap-2 transition shadow-sm ${
                  isUpstoxConnected
                    ? 'bg-purple-900/60 hover:bg-purple-800 border border-purple-700 text-purple-200'
                    : 'bg-purple-600 hover:bg-purple-500 text-white'
                }`}
              >
                <Radio className="w-3.5 h-3.5" />
                {isUpstoxConnected ? 'Manage Connected Upstox Live Feed' : 'Connect Your Upstox Access Token Now'}
              </button>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-slate-800 bg-slate-950 flex items-center justify-between">
          <span className="text-[11px] text-slate-500 font-mono">
            Mode: {isAutoPlaying ? `Live Streaming Active (${streamSpeed}s interval)` : 'Paused (Step Mode)'}
          </span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded bg-sky-600 hover:bg-sky-500 text-white text-xs font-semibold"
          >
            Got it, Close
          </button>
        </div>
      </div>
    </div>
  );
};
