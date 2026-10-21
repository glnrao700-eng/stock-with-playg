import React from 'react';
import {
  Play,
  Pause,
  FastForward,
  RotateCcw,
  FolderCode,
  ShieldAlert,
  Lock,
  Unlock,
  Radio,
  HelpCircle,
} from 'lucide-react';
import { SessionStatus } from '../types/platform';

interface HeaderBannerProps {
  sessionStatus: SessionStatus;
  stepCount: number;
  isAutoPlaying: boolean;
  enforceRealMarketHours: boolean;
  onToggleEnforceMarketHours: () => void;
  onStep: () => void;
  onToggleAutoPlay: () => void;
  onReset: () => void;
  onOpenRepoExplorer: () => void;
  onOpenGuide: () => void;
  isLoading: boolean;
  killSwitchActive: boolean;
  onToggleKillSwitch: () => void;
  streamSpeed: number;
  onChangeStreamSpeed: (speed: number) => void;
  onOpenFeedModal: () => void;
  isUpstoxConnected?: boolean;
  onOpenUpstoxModal?: () => void;
}

export const HeaderBanner: React.FC<HeaderBannerProps> = ({
  sessionStatus,
  stepCount,
  isAutoPlaying,
  enforceRealMarketHours,
  onToggleEnforceMarketHours,
  onStep,
  onToggleAutoPlay,
  onReset,
  onOpenRepoExplorer,
  onOpenGuide,
  isLoading,
  killSwitchActive,
  onToggleKillSwitch,
  streamSpeed,
  onChangeStreamSpeed,
  onOpenFeedModal,
  isUpstoxConnected = false,
  onOpenUpstoxModal,
}) => {
  return (
    <header className="bg-slate-900 border-b border-slate-800 text-slate-100 px-4 py-3 sticky top-0 z-30 shadow-md">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        {/* Brand & Market Clock */}
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded bg-gradient-to-tr from-sky-500 to-indigo-600 flex items-center justify-center font-black text-white text-base shadow-sm">
            IN
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base font-bold tracking-tight text-white">
                Indian Market Multi-Agent Intelligence Platform (IMMIP)
              </h1>
              <span className="text-[11px] font-semibold px-2 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-800/60">
                NSE EQUITIES
              </span>
              <span className="text-[11px] font-semibold px-2 py-0.5 rounded bg-amber-950 text-amber-300 border border-amber-800/60">
                MODE: DEMO_REPLAY
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-400 mt-0.5">
              <span>
                IST Clock:{' '}
                <strong className="text-sky-400 font-mono font-medium">
                  {sessionStatus.ist_timestamp}
                </strong>
              </span>
              <span>•</span>
              <span>
                Session Phase:{' '}
                <strong className="text-amber-400 font-medium">
                  {sessionStatus.phase}
                </strong>
              </span>
              <span>•</span>
              <span>
                Next Trading Day:{' '}
                <strong className="text-slate-200 font-medium">
                  {sessionStatus.next_trading_day}
                </strong>
              </span>
              <span>•</span>
              <span className="text-slate-400 font-mono">
                Sim Step: <strong className="text-white">#{stepCount}</strong>
              </span>
            </div>
          </div>
        </div>

        {/* Global Action Toolbar */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Real Market Hours Enforcement Toggle */}
          <button
            onClick={onToggleEnforceMarketHours}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-semibold transition border ${
              enforceRealMarketHours
                ? sessionStatus.is_market_open
                  ? 'bg-emerald-950 text-emerald-300 border-emerald-800'
                  : 'bg-indigo-950 text-indigo-300 border-indigo-800 shadow-sm'
                : 'bg-amber-950 text-amber-300 border-amber-800'
            }`}
            title={
              enforceRealMarketHours
                ? 'Enforces real NSE trading hours: prices stay strictly frozen when exchange is closed'
                : 'Simulation replay mode: allows testing candles outside market hours'
            }
          >
            {enforceRealMarketHours ? (
              <>
                <Lock className="w-3.5 h-3.5 text-indigo-400" />
                <span>
                  {sessionStatus.is_market_open
                    ? 'NSE Live Hours'
                    : 'Real Market Locked (Frozen)'}
                </span>
              </>
            ) : (
              <>
                <Unlock className="w-3.5 h-3.5 text-amber-400" />
                <span>Practice Replay Active</span>
              </>
            )}
          </button>

          {/* How to Run / Guide */}
          <button
            onClick={onOpenGuide}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-semibold transition active:scale-95"
          >
            <span>Guide</span>
          </button>

          {/* Kill Switch Toggle */}
          <button
            onClick={onToggleKillSwitch}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded text-xs font-semibold transition border ${
              killSwitchActive
                ? 'bg-rose-950/80 text-rose-300 border-rose-700 animate-pulse'
                : 'bg-slate-800/80 text-slate-300 border-slate-700 hover:bg-slate-700'
            }`}
            title="Halts all new paper orders across all agents"
          >
            <ShieldAlert className="w-3.5 h-3.5 text-rose-400" />
            {killSwitchActive ? 'Kill Switch ACTIVE' : 'Kill Switch Arm'}
          </button>

          {/* Single Step 1m Candle */}
          <button
            onClick={onStep}
            disabled={isLoading || (enforceRealMarketHours && !sessionStatus.is_market_open)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-sky-600 hover:bg-sky-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-semibold shadow-sm transition active:scale-95"
            title={
              enforceRealMarketHours && !sessionStatus.is_market_open
                ? 'Exchange is closed. Switch to Practice Replay to simulate candles.'
                : 'Advances historical feed by 1 bar and triggers all 8 LangGraph agents'
            }
          >
            <FastForward className="w-3.5 h-3.5" />
            {enforceRealMarketHours && !sessionStatus.is_market_open
              ? 'Market Closed (Frozen)'
              : isLoading
              ? 'Running 8 Agents...'
              : '+ Step 1m Candle'}
          </button>

          {/* Auto-Play / Live Stream Toggle */}
          <div className="flex items-center rounded bg-slate-950 border border-slate-700/80 p-0.5">
            <button
              onClick={onToggleAutoPlay}
              disabled={enforceRealMarketHours && !sessionStatus.is_market_open}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-semibold transition disabled:opacity-40 disabled:cursor-not-allowed ${
                isAutoPlaying
                  ? 'bg-amber-600 hover:bg-amber-500 text-white shadow'
                  : sessionStatus.is_market_open
                  ? 'bg-emerald-600 hover:bg-emerald-500 text-white'
                  : 'bg-slate-800 hover:bg-slate-700 text-slate-200'
              }`}
              title={
                enforceRealMarketHours && !sessionStatus.is_market_open
                  ? 'Auto-Run disabled because real NSE market is closed.'
                  : `Streams 1-minute price updates every ${streamSpeed}s`
              }
            >
              {isAutoPlaying ? (
                <>
                  <Pause className="w-3.5 h-3.5" /> Pause Stream
                </>
              ) : sessionStatus.is_market_open ? (
                <>
                  <Play className="w-3.5 h-3.5" /> Start Live Stream
                </>
              ) : (
                <>
                  <Play className="w-3.5 h-3.5" /> Auto-Run {streamSpeed}s
                </>
              )}
            </button>

            {/* Speed Selector */}
            <div className="flex items-center px-1 gap-0.5 border-l border-slate-800 ml-1">
              {[1, 3, 5].map((spd) => (
                <button
                  key={spd}
                  onClick={() => onChangeStreamSpeed(spd)}
                  className={`px-1.5 py-0.5 rounded text-[10px] font-mono transition ${
                    streamSpeed === spd
                      ? 'bg-sky-600 text-white font-bold'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                  }`}
                  title={`Run stream step every ${spd} second${spd > 1 ? 's' : ''}`}
                >
                  {spd}s
                </button>
              ))}
            </div>
          </div>

          {/* Feed Info Explainer Button */}
          {/* Upstox Live Broker Feed */}
          {onOpenUpstoxModal && (
            <button
              onClick={onOpenUpstoxModal}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded text-xs font-semibold border transition active:scale-95 ${
                isUpstoxConnected
                  ? 'bg-purple-950/80 text-purple-300 border-purple-700 hover:bg-purple-900 shadow-sm'
                  : 'bg-slate-800 hover:bg-slate-700 text-purple-300 border-slate-700'
              }`}
              title="Connect your Upstox Access Token for real live NSE tick quotes & candles"
            >
              <Radio className={`w-3.5 h-3.5 ${isUpstoxConnected ? 'text-purple-400 animate-pulse' : 'text-purple-400/80'}`} />
              <span>Upstox {isUpstoxConnected ? 'LIVE' : 'Feed'}</span>
            </button>
          )}

          {/* Feed Info / Market Architecture */}
          <button
            onClick={onOpenFeedModal}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded bg-slate-800 hover:bg-slate-700 text-sky-400 hover:text-sky-300 border border-slate-700 text-xs font-semibold transition"
            title="Why isn't pricing moving live? Click to see market feed architecture"
          >
            <HelpCircle className="w-3.5 h-3.5 text-sky-400" />
            <span className="hidden sm:inline">Feed Info</span>
          </button>

          {/* Reset */}
          <button
            onClick={onReset}
            className="p-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-slate-200 border border-slate-700 transition"
            title="Reset simulation step and restart virtual book"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>

          {/* View Code & Repository Tree */}
          <button
            onClick={onOpenRepoExplorer}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-indigo-600/90 hover:bg-indigo-500 text-white text-xs font-semibold shadow-sm transition"
          >
            <FolderCode className="w-3.5 h-3.5" />
            <span>Code & Repo Tree</span>
          </button>
        </div>
      </div>
    </header>
  );
};
