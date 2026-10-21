import React, { useState, useEffect } from 'react';
import {
  X,
  Radio,
  Key,
  ShieldCheck,
  CheckCircle2,
  XCircle,
  RefreshCw,
  ExternalLink,
  Zap,
  Lock,
  Eye,
  EyeOff,
  Activity,
  AlertTriangle,
  Server,
} from 'lucide-react';
import { UpstoxConnectionState, UpstoxLiveQuote } from '../types/platform';
import {
  checkUpstoxStatus,
  clearUpstoxSessionToken,
  getUpstoxSessionToken,
  setUpstoxSessionToken,
  fetchUpstoxLiveQuotes,
} from '../services/upstoxClient';

interface UpstoxBrokerModalProps {
  isOpen: boolean;
  onClose: () => void;
  connectionState: UpstoxConnectionState;
  onRefreshConnection: () => Promise<void>;
  isUpstoxFeedActive: boolean;
  onToggleUpstoxFeed: (active: boolean) => void;
  quotes: Record<string, UpstoxLiveQuote>;
}

export const UpstoxBrokerModal: React.FC<UpstoxBrokerModalProps> = ({
  isOpen,
  onClose,
  connectionState,
  onRefreshConnection,
  isUpstoxFeedActive,
  onToggleUpstoxFeed,
  quotes,
}) => {
  const [tokenInput, setTokenInput] = useState<string>('');
  const [showToken, setShowToken] = useState<boolean>(false);
  const [isVerifying, setIsVerifying] = useState<boolean>(false);
  const [verifyMessage, setVerifyMessage] = useState<{ success: boolean; text: string } | null>(null);

  useEffect(() => {
    if (isOpen) {
      const existing = getUpstoxSessionToken();
      if (existing) {
        setTokenInput(existing);
      }
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSaveAndTestToken = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tokenInput.trim()) {
      setVerifyMessage({ success: false, text: 'Please enter an Upstox access token.' });
      return;
    }

    setIsVerifying(true);
    setVerifyMessage(null);

    const clean = tokenInput.trim();
    setUpstoxSessionToken(clean);

    try {
      const status = await checkUpstoxStatus(clean);
      if (status.connected) {
        setVerifyMessage({
          success: true,
          text: `Connected to Upstox API v2! Latency: ${status.latency_ms || 120}ms. Live quotes verified.`,
        });
        onToggleUpstoxFeed(true);
        await onRefreshConnection();
      } else {
        setVerifyMessage({
          success: false,
          text: status.error || status.message || 'Token verification failed. Please check if token is valid and unexpired.',
        });
      }
    } catch (err: any) {
      setVerifyMessage({
        success: false,
        text: err.message || 'Failed to reach Upstox proxy server.',
      });
    } finally {
      setIsVerifying(false);
    }
  };

  const handleClearToken = async () => {
    clearUpstoxSessionToken();
    setTokenInput('');
    setVerifyMessage(null);
    onToggleUpstoxFeed(false);
    await onRefreshConnection();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-sm p-4">
      <div className="bg-slate-900 border border-slate-700 rounded-xl w-full max-w-2xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-800 bg-slate-950 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded bg-gradient-to-tr from-purple-600 to-indigo-600 flex items-center justify-center text-white font-bold text-sm shadow">
              <Radio className="w-4 h-4 text-white animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-bold text-white tracking-wide">
                  Upstox Broker Live Market Feed API v2
                </h2>
                <span
                  className={`px-2 py-0.5 rounded text-[10px] font-bold tracking-wide uppercase border ${
                    connectionState.connected
                      ? 'bg-emerald-950/80 text-emerald-300 border-emerald-800'
                      : 'bg-slate-800 text-slate-400 border-slate-700'
                  }`}
                >
                  {connectionState.connected ? '● Connected' : '○ Disconnected'}
                </span>
              </div>
              <div className="text-[11px] text-slate-400">
                Direct live NSE tick ingestion and intraday candles via your Upstox account
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
          {/* Status Banner */}
          <div
            className={`p-3.5 rounded-lg border flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
              connectionState.connected
                ? 'bg-emerald-950/40 border-emerald-800/80'
                : 'bg-indigo-950/30 border-indigo-900/60'
            }`}
          >
            <div className="flex items-center gap-3">
              <div
                className={`w-3 h-3 rounded-full shrink-0 ${
                  connectionState.connected ? 'bg-emerald-400 animate-pulse' : 'bg-slate-600'
                }`}
              />
              <div>
                <div className="font-semibold text-white text-xs">
                  {connectionState.connected
                    ? `Live Upstox Feed Active (${connectionState.latency_ms || 110}ms latency)`
                    : 'Upstox Feed Not Connected (Using Simulated Replay Engine)'}
                </div>
                <div className="text-[11px] text-slate-400">
                  {connectionState.connected
                    ? 'All 8 quantitative models and chart bars are actively consuming real NSE ticks.'
                    : 'Enter your Upstox access token below to switch to real live broker prices.'}
                </div>
              </div>
            </div>

            {connectionState.connected && (
              <div className="flex items-center gap-2 self-end sm:self-center">
                <button
                  onClick={() => onToggleUpstoxFeed(!isUpstoxFeedActive)}
                  className={`px-3 py-1 rounded text-xs font-semibold transition ${
                    isUpstoxFeedActive
                      ? 'bg-amber-600 hover:bg-amber-500 text-white'
                      : 'bg-emerald-600 hover:bg-emerald-500 text-white'
                  }`}
                >
                  {isUpstoxFeedActive ? 'Pause Upstox Feed' : 'Resume Upstox Feed'}
                </button>
              </div>
            )}
          </div>

          {/* Token Input Form */}
          <div className="bg-slate-950 p-4 rounded-lg border border-slate-800 space-y-3">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <div className="flex items-center gap-2 text-white font-bold text-xs">
                <Key className="w-4 h-4 text-purple-400" />
                <span>Upstox Access Token Configuration</span>
              </div>
              <div className="flex items-center gap-1 text-[11px] text-slate-400">
                <Lock className="w-3 h-3 text-emerald-400" />
                <span>Stored Private to Session</span>
              </div>
            </div>

            <form onSubmit={handleSaveAndTestToken} className="space-y-3">
              <div>
                <label className="text-slate-300 block mb-1 font-medium">
                  Upstox Bearer Access Token:
                </label>
                <div className="relative">
                  <input
                    type={showToken ? 'text' : 'password'}
                    value={tokenInput}
                    onChange={(e) => setTokenInput(e.target.value)}
                    placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
                    className="w-full pl-3 pr-10 py-2 rounded bg-slate-900 border border-slate-700 text-white font-mono text-xs focus:border-purple-500 focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => setShowToken(!showToken)}
                    className="absolute right-2.5 top-2.5 text-slate-400 hover:text-white"
                  >
                    {showToken ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                <div className="text-[10px] text-slate-500 mt-1 flex items-center justify-between">
                  <span>Tokens are valid for the active trading session. Generated via Upstox OAuth Login.</span>
                  <a
                    href="https://developer.upstox.com/"
                    target="_blank"
                    rel="noreferrer"
                    className="text-purple-400 hover:underline flex items-center gap-1"
                  >
                    Upstox Developer Portal <ExternalLink className="w-2.5 h-2.5" />
                  </a>
                </div>
              </div>

              {verifyMessage && (
                <div
                  className={`p-2.5 rounded text-xs flex items-start gap-2 ${
                    verifyMessage.success
                      ? 'bg-emerald-950/80 border border-emerald-800 text-emerald-300'
                      : 'bg-rose-950/80 border border-rose-800 text-rose-300'
                  }`}
                >
                  {verifyMessage.success ? (
                    <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-emerald-400" />
                  ) : (
                    <XCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-400" />
                  )}
                  <span className="leading-snug">{verifyMessage.text}</span>
                </div>
              )}

              <div className="flex items-center gap-2 pt-1">
                <button
                  type="submit"
                  disabled={isVerifying}
                  className="px-4 py-2 rounded bg-purple-600 hover:bg-purple-500 disabled:bg-purple-900 text-white font-semibold flex items-center gap-2 shadow-sm transition active:scale-98"
                >
                  {isVerifying ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" /> Verifying with Upstox...
                    </>
                  ) : (
                    <>
                      <Zap className="w-3.5 h-3.5" /> Save Token & Connect Live Feed
                    </>
                  )}
                </button>

                {tokenInput && (
                  <button
                    type="button"
                    onClick={handleClearToken}
                    className="px-3 py-2 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold transition"
                  >
                    Disconnect & Clear
                  </button>
                )}
              </div>
            </form>
          </div>

          {/* Live Quote Stream Preview */}
          {connectionState.connected && Object.keys(quotes).length > 0 && (
            <div className="bg-slate-950 p-4 rounded-lg border border-slate-800 space-y-2.5">
              <div className="flex items-center justify-between text-xs font-semibold text-white">
                <span className="flex items-center gap-1.5 text-emerald-400">
                  <Activity className="w-3.5 h-3.5" /> Active Live Feed Stream (NSE Equities)
                </span>
                <span className="text-[10px] text-slate-500 font-mono">
                  Updated: {new Date().toLocaleTimeString('en-IN')}
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {Object.entries(quotes).map(([sym, quote]) => (
                  <div
                    key={sym}
                    className="p-2 rounded bg-slate-900 border border-slate-800/80 font-mono text-xs flex flex-col justify-between"
                  >
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="font-bold text-white">{sym}</span>
                      <span
                        className={`text-[10px] font-semibold ${
                          (quote.net_change || 0) >= 0 ? 'text-emerald-400' : 'text-rose-400'
                        }`}
                      >
                        {(quote.net_change || 0) >= 0 ? '+' : ''}
                        {quote.net_change?.toFixed(2)}
                      </span>
                    </div>
                    <div className="text-base font-black text-emerald-400 mt-1">
                      ₹{quote.last_price.toFixed(2)}
                    </div>
                    <div className="text-[9px] text-slate-500 truncate mt-0.5">
                      Vol: {quote.volume.toLocaleString('en-IN')}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Architecture & Security Notice */}
          <div className="p-3.5 rounded-lg bg-slate-950/70 border border-slate-800 space-y-1.5 text-[11px] text-slate-400">
            <div className="font-semibold text-slate-200 flex items-center gap-1.5">
              <Server className="w-3.5 h-3.5 text-sky-400" /> Server-Side Proxy Architecture
            </div>
            <p>
              Calls to <code>api.upstox.com/v2</code> are proxied through the local backend route (<code>/api/upstox/*</code>) to prevent browser CORS blocks. The token can also be permanently placed in your server environment as <code>UPSTOX_ACCESS_TOKEN</code> in <code>.env</code>.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-slate-800 bg-slate-950 flex items-center justify-between">
          <span className="text-[11px] text-slate-500 font-mono">
            Feed Status: {connectionState.connected ? 'UPSTOX_LIVE_V2' : 'ENGINE_SIMULATION'}
          </span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded bg-sky-600 hover:bg-sky-500 text-white text-xs font-semibold transition"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
