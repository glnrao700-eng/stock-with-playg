import React, { useState, useEffect } from 'react';
import {
  Settings,
  ShieldAlert,
  Sliders,
  PlusCircle,
  Activity,
  Terminal,
  Lock,
  RefreshCw,
  Check,
  Edit3,
  DollarSign,
  Info,
  Key,
  Radio,
  Eye,
  EyeOff,
  ExternalLink,
  Zap,
  CheckCircle2,
  XCircle,
  Database,
  HardDrive,
  Download,
  FileSpreadsheet,
} from 'lucide-react';
import {
  InstrumentConfig,
  PlatformConfig,
  SystemMonitorEvent,
  UpstoxLiveQuote,
} from '../types/platform';
import { LATEST_MARKET_REFERENCE_PRICES } from '../services/marketData';
import {
  checkUpstoxStatus,
  clearUpstoxSessionToken,
  getUpstoxSessionToken,
  setUpstoxSessionToken,
} from '../services/upstoxClient';
import {
  getHistoricalDbStatus,
  triggerCollect30Days,
  CandleDbStatusItem,
} from '../services/localCandleDb';

interface Level6ConfigAndMonitorProps {
  config: PlatformConfig;
  instruments?: InstrumentConfig[];
  onUpdateConfig: (updated: Partial<PlatformConfig>) => void;
  onAddStock: (newInst: InstrumentConfig) => void;
  onUpdateInstrumentPrice?: (symbol: string, newPrice: number) => void;
  onSyncAllPricesToMarket?: () => void;
  onSyncAllPricesToUpstox?: () => void;
  upstoxQuotes?: Record<string, UpstoxLiveQuote>;
  onRefreshUpstox?: () => Promise<void>;
  systemEvents: SystemMonitorEvent[];
  onToggleKillSwitch: () => void;
  isUpstoxConnected?: boolean;
  onOpenUpstoxModal?: () => void;
}

export const Level6ConfigAndMonitor: React.FC<Level6ConfigAndMonitorProps> = ({
  config,
  instruments = [],
  onUpdateConfig,
  onAddStock,
  onUpdateInstrumentPrice,
  onSyncAllPricesToMarket,
  onSyncAllPricesToUpstox,
  upstoxQuotes = {},
  onRefreshUpstox,
  systemEvents,
  onToggleKillSwitch,
  isUpstoxConnected = false,
  onOpenUpstoxModal,
}) => {
  const [newSymbol, setNewSymbol] = useState('');
  const [newCompanyName, setNewCompanyName] = useState('');
  const [newSector, setNewSector] = useState<InstrumentConfig['sector']>('BANKING');
  const [newBasePrice, setNewBasePrice] = useState('1500.00');
  const [addedSuccess, setAddedSuccess] = useState(false);

  // Editable Target Rules state
  const [minDisplacement, setMinDisplacement] = useState(
    config.target_rules.min_entry_displacement_inr
  );
  const [minTargetFromRef, setMinTargetFromRef] = useState(
    config.target_rules.min_target_from_ref_inr
  );
  const [minRR, setMinRR] = useState(config.risk_controls.min_reward_to_risk);

  // Editable weights
  const [weights, setWeights] = useState({ ...config.agent_weights });

  const handleAddStockSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSymbol.trim() || !newCompanyName.trim()) return;

    const cleanSymbol = newSymbol.trim().toUpperCase();
    const inst: InstrumentConfig = {
      instrument_id: `NSE_${cleanSymbol}`,
      company_name: newCompanyName.trim(),
      exchange: 'NSE',
      symbol: cleanSymbol,
      provider_token: String(Math.floor(100000 + Math.random() * 900000)),
      tradingview_symbol: `NSE:${cleanSymbol}`,
      currency: 'INR',
      tick_size: 0.05,
      lot_size: 1,
      enabled: true,
      sector: newSector,
      historical_coverage_from: '2018-01-01',
      base_demo_price: parseFloat(newBasePrice) || 1000.0,
    };

    onAddStock(inst);
    setNewSymbol('');
    setNewCompanyName('');
    setAddedSuccess(true);
    setTimeout(() => setAddedSuccess(false), 2500);
  };

  const handleSaveRules = () => {
    onUpdateConfig({
      target_rules: {
        ...config.target_rules,
        min_entry_displacement_inr: minDisplacement,
        min_target_from_ref_inr: minTargetFromRef,
      },
      risk_controls: {
        ...config.risk_controls,
        min_reward_to_risk: minRR,
      },
      agent_weights: weights,
    });
  };

  // Price Calibration state
  const [editingPrices, setEditingPrices] = useState<Record<string, string>>({});
  const [priceSuccessSymbol, setPriceSuccessSymbol] = useState<string | null>(null);
  const [allSyncedSuccess, setAllSyncedSuccess] = useState<boolean>(false);
  const [allUpstoxSyncedSuccess, setAllUpstoxSyncedSuccess] = useState<boolean>(false);

  // Direct Inline Upstox Token State
  const [inlineToken, setInlineToken] = useState<string>(() => getUpstoxSessionToken() || '');
  const [showInlineToken, setShowInlineToken] = useState<boolean>(false);
  const [isVerifyingToken, setIsVerifyingToken] = useState<boolean>(false);
  const [tokenFeedback, setTokenFeedback] = useState<{ success: boolean; text: string } | null>(null);

  // 30-Day Local Candle Database State
  const [dbStatusList, setDbStatusList] = useState<CandleDbStatusItem[]>([]);
  const [isCollectingAllDb, setIsCollectingAllDb] = useState<boolean>(false);
  const [dbCollectionFeedback, setDbCollectionFeedback] = useState<string | null>(null);

  const refreshDbStatus = async () => {
    try {
      const items = await getHistoricalDbStatus();
      setDbStatusList(items);
    } catch (e) {
      console.warn('Could not fetch DB status:', e);
    }
  };

  useEffect(() => {
    refreshDbStatus();
  }, []);

  const handleCollectAll30d = async () => {
    setIsCollectingAllDb(true);
    setDbCollectionFeedback(null);
    try {
      const res = await triggerCollect30Days('ALL');
      setDbCollectionFeedback(
        `✓ 30-Day collection complete for ${res.results?.length || 6} instruments!`
      );
      await refreshDbStatus();
    } catch (err: any) {
      setDbCollectionFeedback(`Notice: ${err.message || 'Upstox token required for live download'}`);
    } finally {
      setIsCollectingAllDb(false);
      setTimeout(() => setDbCollectionFeedback(null), 6000);
    }
  };

  useEffect(() => {
    const existing = getUpstoxSessionToken();
    if (existing) setInlineToken(existing);
  }, []);

  const handlePriceInputChange = (symbol: string, value: string) => {
    setEditingPrices((prev) => ({ ...prev, [symbol]: value }));
  };

  const handleSaveStockPrice = (symbol: string) => {
    const rawVal = editingPrices[symbol];
    if (rawVal === undefined) return;
    const num = parseFloat(rawVal);
    if (!isNaN(num) && num > 0 && onUpdateInstrumentPrice) {
      onUpdateInstrumentPrice(symbol, num);
      setPriceSuccessSymbol(symbol);
      setTimeout(() => setPriceSuccessSymbol(null), 2000);
    }
  };

  const handleSyncSingleStock = (symbol: string, refPrice: number) => {
    if (onUpdateInstrumentPrice) {
      onUpdateInstrumentPrice(symbol, refPrice);
      setEditingPrices((prev) => ({ ...prev, [symbol]: String(refPrice) }));
      setPriceSuccessSymbol(symbol);
      setTimeout(() => setPriceSuccessSymbol(null), 2000);
    }
  };

  const handleSyncAllClick = () => {
    if (onSyncAllPricesToMarket) {
      onSyncAllPricesToMarket();
      setAllSyncedSuccess(true);
      setTimeout(() => setAllSyncedSuccess(false), 2500);
    }
  };

  const handleSyncAllUpstoxClick = () => {
    if (onSyncAllPricesToUpstox) {
      onSyncAllPricesToUpstox();
      setAllUpstoxSyncedSuccess(true);
      setTimeout(() => setAllUpstoxSyncedSuccess(false), 2500);
    }
  };

  const handleSaveAndTestInlineToken = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inlineToken.trim()) {
      setTokenFeedback({ success: false, text: 'Please paste your Upstox access token.' });
      return;
    }

    setIsVerifyingToken(true);
    setTokenFeedback(null);
    const clean = inlineToken.trim();
    setUpstoxSessionToken(clean);

    try {
      const status = await checkUpstoxStatus(clean);
      if (status.connected) {
        setTokenFeedback({
          success: true,
          text: `Connected to Upstox API v2! Latency: ${status.latency_ms || 120}ms. Live quotes active.`,
        });
        if (onRefreshUpstox) await onRefreshUpstox();
      } else {
        setTokenFeedback({
          success: false,
          text: status.error || status.message || 'Token verification failed. Upstox tokens expire daily at 3:30 AM IST.',
        });
      }
    } catch (err: any) {
      setTokenFeedback({
        success: false,
        text: err.message || 'Failed to reach Upstox proxy endpoint.',
      });
    } finally {
      setIsVerifyingToken(false);
    }
  };

  const handleClearInlineToken = async () => {
    clearUpstoxSessionToken();
    setInlineToken('');
    setTokenFeedback({ success: true, text: 'Upstox session token removed.' });
    if (onRefreshUpstox) await onRefreshUpstox();
  };

  return (
    <div className="space-y-6">
      {/* 2-Column Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left Column: Dynamic Universe & Risk Controls */}
        <div className="space-y-6">
          {/* Upstox Live Broker Feed Integration Card */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-lg p-4 space-y-3">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded bg-purple-600 flex items-center justify-center text-white font-bold text-xs">
                  <Radio className={`w-3.5 h-3.5 ${isUpstoxConnected ? 'animate-pulse' : ''}`} />
                </div>
                <div>
                  <h3 className="text-xs font-bold text-white uppercase tracking-wider">
                    Upstox Broker Live Feed API v2
                  </h3>
                </div>
              </div>
              <span
                className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border ${
                  isUpstoxConnected
                    ? 'bg-emerald-950/80 text-emerald-300 border-emerald-800'
                    : 'bg-slate-800 text-slate-400 border-slate-700'
                }`}
              >
                {isUpstoxConnected ? '● Live Feed Active' : '○ Offline Replay'}
              </span>
            </div>

            <p className="text-[11px] text-slate-400 leading-relaxed">
              Connect your active Upstox access token to stream authentic NSE tick quotes and replace synthetic candles with broker live market data.
            </p>

            {/* Direct Token Form */}
            <form onSubmit={handleSaveAndTestInlineToken} className="space-y-2 bg-slate-950/90 p-3 rounded border border-slate-800/80">
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-slate-300 font-semibold flex items-center gap-1.5">
                  <Key className="w-3.5 h-3.5 text-purple-400" /> Upstox Access Token:
                </span>
                <span className="text-[10px] text-slate-500 font-mono">
                  Upstox API v2
                </span>
              </div>

              <div className="relative">
                <input
                  type={showInlineToken ? 'text' : 'password'}
                  value={inlineToken}
                  onChange={(e) => setInlineToken(e.target.value)}
                  placeholder="Paste Upstox access token here..."
                  className="w-full pl-3 pr-20 py-1.5 rounded bg-slate-900 border border-slate-700 text-white font-mono text-[11px] focus:border-purple-500 focus:outline-none placeholder:text-slate-600"
                />
                <button
                  type="button"
                  onClick={() => setShowInlineToken(!showInlineToken)}
                  className="absolute right-2 top-1.5 text-slate-400 hover:text-white transition p-0.5"
                  title={showInlineToken ? 'Hide token' : 'Show token'}
                >
                  {showInlineToken ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                </button>
              </div>

              <div className="flex items-center justify-between gap-2 pt-1">
                <button
                  type="submit"
                  disabled={isVerifyingToken || !inlineToken.trim()}
                  className="flex-1 py-1.5 rounded bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white font-semibold text-xs flex items-center justify-center gap-1.5 transition shadow-sm"
                >
                  {isVerifyingToken ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" /> Verifying...
                    </>
                  ) : (
                    <>
                      <Zap className="w-3.5 h-3.5" /> Verify & Connect Live Stream
                    </>
                  )}
                </button>

                {inlineToken && (
                  <button
                    type="button"
                    onClick={handleClearInlineToken}
                    className="px-2.5 py-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-rose-300 text-xs font-semibold transition"
                  >
                    Clear
                  </button>
                )}

                {onOpenUpstoxModal && (
                  <button
                    type="button"
                    onClick={onOpenUpstoxModal}
                    className="px-2.5 py-1.5 rounded bg-slate-800 hover:bg-slate-700 text-purple-300 text-xs font-semibold flex items-center gap-1 transition"
                    title="Open Stream Settings & Diagnostics"
                  >
                    <Sliders className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {tokenFeedback && (
                <div
                  className={`p-2 rounded text-[11px] flex items-start gap-1.5 ${
                    tokenFeedback.success
                      ? 'bg-emerald-950/80 border border-emerald-800 text-emerald-300'
                      : 'bg-rose-950/80 border border-rose-800 text-rose-300'
                  }`}
                >
                  {tokenFeedback.success ? (
                    <CheckCircle2 className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                  ) : (
                    <XCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                  )}
                  <div className="leading-snug">{tokenFeedback.text}</div>
                </div>
              )}
            </form>

            {/* Live Quotes Preview Chips from Upstox API */}
            {Object.keys(upstoxQuotes).length > 0 && (
              <div className="space-y-1.5 pt-1">
                <div className="flex items-center justify-between text-[10px] text-slate-400">
                  <span className="font-semibold text-purple-300 uppercase tracking-wider flex items-center gap-1">
                    <Radio className="w-3 h-3 text-emerald-400 animate-pulse" /> Live Upstox LTP Ticks:
                  </span>
                  {onSyncAllPricesToUpstox && (
                    <button
                      onClick={handleSyncAllUpstoxClick}
                      className="text-purple-300 hover:text-purple-200 underline font-semibold flex items-center gap-1 transition"
                    >
                      <RefreshCw className="w-2.5 h-2.5" />
                      {allUpstoxSyncedSuccess ? 'Applied!' : 'Apply All Upstox Prices'}
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-3 gap-1.5 text-[10px] font-mono">
                  {Object.entries(upstoxQuotes)
                    .filter(([sym]) => !sym.includes(':') && !sym.includes('|'))
                    .map(([sym, q]) => (
                      <div
                        key={sym}
                        className="p-1.5 rounded bg-slate-950 border border-slate-800 flex items-center justify-between"
                      >
                        <span className="font-bold text-slate-300">{sym}</span>
                        <span className="text-emerald-400 font-bold">₹{q.last_price.toFixed(2)}</span>
                      </div>
                    ))}
                </div>
              </div>
            )}
          </div>

          {/* 30-Day 1-Minute Candle Database Card */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-lg p-4 space-y-3">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
              <div className="flex items-center gap-2">
                <Database className="w-4 h-4 text-sky-400" />
                <h3 className="text-xs font-bold text-white uppercase tracking-wider">
                  Local 30-Day 1m Candle Database
                </h3>
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  onClick={handleCollectAll30d}
                  disabled={isCollectingAllDb}
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-sky-950/80 hover:bg-sky-900 border border-sky-800 text-sky-300 text-[11px] font-semibold transition disabled:opacity-50"
                  title="Download fresh 30-day 1-minute historical data for all universe instruments"
                >
                  {isCollectingAllDb ? (
                    <>
                      <RefreshCw className="w-3 h-3 animate-spin text-sky-400" />
                      <span>Syncing All...</span>
                    </>
                  ) : (
                    <>
                      <Download className="w-3 h-3 text-sky-400" />
                      <span>Sync 30D All</span>
                    </>
                  )}
                </button>
                <button
                  onClick={refreshDbStatus}
                  className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 transition"
                  title="Refresh Database Status"
                >
                  <RefreshCw className="w-3 h-3" />
                </button>
              </div>
            </div>

            <div className="text-[11px] text-slate-400 leading-relaxed">
              Stores continuous 1-minute candles for the last 30 days locally in{' '}
              <code className="text-sky-300 font-mono bg-slate-950 px-1 py-0.5 rounded">/data/candles/</code>{' '}
              and synchronizes with browser <strong className="text-slate-200">IndexedDB</strong> for instant offline charting without network latency.
            </div>

            {dbCollectionFeedback && (
              <div className="p-2 rounded bg-sky-950/80 border border-sky-800 text-sky-300 text-[11px] font-mono animate-fade-in">
                {dbCollectionFeedback}
              </div>
            )}

            {/* Database Files List */}
            <div className="space-y-1.5 max-h-[220px] overflow-y-auto pr-1">
              {dbStatusList.length === 0 ? (
                <div className="p-3 text-center text-xs text-slate-500 font-mono">
                  Loading database files...
                </div>
              ) : (
                dbStatusList.map((item) => (
                  <div
                    key={item.symbol}
                    className="p-2 rounded bg-slate-950 border border-slate-800/80 flex items-center justify-between text-xs font-mono"
                  >
                    <div className="flex items-center gap-2">
                      <HardDrive className="w-3.5 h-3.5 text-slate-500" />
                      <div>
                        <span className="font-bold text-white">{item.symbol}</span>
                        <span className="text-[10px] text-slate-400 ml-1.5">
                          {item.interval} • {item.total_bars.toLocaleString()} bars
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 text-[10px]">
                      <span className="text-slate-400">{item.file_size_kb} KB</span>
                      <span className="px-1.5 py-0.2 rounded bg-emerald-950 text-emerald-300 border border-emerald-800 font-semibold">
                        Ready
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Active Stock Universe & Live Price Calibration */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-lg p-4 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
              <div className="flex items-center gap-2">
                <Sliders className="w-4 h-4 text-emerald-400" />
                <h3 className="text-xs font-bold text-white uppercase tracking-wider">
                  Active Universe & Live Price Calibration
                </h3>
              </div>
              <div className="flex items-center gap-1.5">
                {onSyncAllPricesToUpstox && Object.keys(upstoxQuotes).length > 0 && (
                  <button
                    onClick={handleSyncAllUpstoxClick}
                    className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-purple-950/80 hover:bg-purple-900 border border-purple-800 text-purple-300 text-[11px] font-semibold transition"
                    title="Align all in-engine prices to live Upstox broker prices"
                  >
                    <Zap className="w-3 h-3 text-purple-400" />
                    {allUpstoxSyncedSuccess ? 'Upstox Synced!' : 'Sync All Upstox'}
                  </button>
                )}
                {onSyncAllPricesToMarket && (
                  <button
                    onClick={handleSyncAllClick}
                    className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-emerald-950/80 hover:bg-emerald-900 border border-emerald-800 text-emerald-300 text-[11px] font-semibold transition"
                  >
                    <RefreshCw className="w-3 h-3" />
                    {allSyncedSuccess ? 'Market Ref Synced!' : 'Sync Market Ref'}
                  </button>
                )}
              </div>
            </div>

            <div className="p-2.5 rounded bg-slate-950/80 border border-slate-800 text-[11px] text-slate-400 flex items-start gap-2">
              <Info className="w-4 h-4 text-sky-400 shrink-0 mt-0.5" />
              <div>
                <strong className="text-slate-300">Why prices may differ:</strong> Direct web-browser scraping of NSE is blocked by CORS/SEBI without broker API keys. Calibrate prices below to match your live broker or TradingView app; all 8 agents instantly re-calculate.
              </div>
            </div>

            {/* Instruments Table */}
            <div className="space-y-2 max-h-[320px] overflow-y-auto pr-1">
              {instruments.map((inst) => {
                const currentPriceVal = inst.base_demo_price;
                const inputVal = editingPrices[inst.symbol] !== undefined ? editingPrices[inst.symbol] : String(currentPriceVal);
                const marketRef = LATEST_MARKET_REFERENCE_PRICES[inst.symbol];
                const upstoxQuote = upstoxQuotes[inst.symbol] || (inst.upstox_instrument_key ? upstoxQuotes[inst.upstox_instrument_key] : undefined);
                const isJustSaved = priceSuccessSymbol === inst.symbol;

                return (
                  <div
                    key={inst.symbol}
                    className="p-2.5 rounded bg-slate-950 border border-slate-800/80 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-white font-mono">{inst.symbol}</span>
                        <span className="text-[10px] text-slate-400 truncate max-w-[140px]">
                          {inst.company_name}
                        </span>
                      </div>
                      <div className="text-[10px] text-slate-500 font-mono mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5">
                        <span>
                          Current In-Engine: <span className="text-emerald-400 font-bold">₹{inst.base_demo_price.toFixed(2)}</span>
                        </span>
                        {upstoxQuote && (
                          <span className="text-purple-300 font-semibold">
                            (Upstox LTP: ₹{upstoxQuote.last_price.toFixed(2)})
                          </span>
                        )}
                        {marketRef && !upstoxQuote && (
                          <span className="text-slate-400">
                            (Market Ref: ₹{marketRef.toFixed(2)})
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 self-end sm:self-center">
                      <div className="flex items-center gap-1">
                        <span className="text-slate-500 text-[11px]">₹</span>
                        <input
                          type="number"
                          step="0.05"
                          value={inputVal}
                          onChange={(e) => handlePriceInputChange(inst.symbol, e.target.value)}
                          className="w-20 px-1.5 py-1 rounded bg-slate-900 border border-slate-700 text-white font-mono text-[11px] focus:border-sky-500 focus:outline-none"
                        />
                      </div>
                      <button
                        onClick={() => handleSaveStockPrice(inst.symbol)}
                        className={`px-2 py-1 rounded text-[11px] font-semibold transition ${
                          isJustSaved
                            ? 'bg-emerald-600 text-white'
                            : 'bg-sky-600 hover:bg-sky-500 text-white'
                        }`}
                      >
                        {isJustSaved ? 'Saved' : 'Set'}
                      </button>
                      {upstoxQuote && Math.abs(inst.base_demo_price - upstoxQuote.last_price) > 0.05 && (
                        <button
                          onClick={() => handleSyncSingleStock(inst.symbol, upstoxQuote.last_price)}
                          className="px-2 py-1 rounded bg-purple-950 hover:bg-purple-900 text-purple-200 border border-purple-800 text-[10px] font-mono transition"
                          title={`Sync to Upstox LTP ₹${upstoxQuote.last_price}`}
                        >
                          Use Upstox
                        </button>
                      )}
                      {marketRef && Math.abs(inst.base_demo_price - marketRef) > 0.05 && (
                        <button
                          onClick={() => handleSyncSingleStock(inst.symbol, marketRef)}
                          className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-sky-300 text-[10px] font-mono transition"
                          title={`Sync to market reference ₹${marketRef}`}
                        >
                          Use Ref
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
          {/* Add New NSE Stock */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-lg p-4 space-y-4">
            <div className="flex items-center gap-2 border-b border-slate-800 pb-2.5">
              <PlusCircle className="w-4 h-4 text-emerald-400" />
              <h3 className="text-xs font-bold text-white uppercase tracking-wider">
                Add NSE Stock to Live Universe (Zero Code Changes)
              </h3>
            </div>

            <form onSubmit={handleAddStockSubmit} className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-slate-400 block mb-1">NSE Symbol (e.g. SBIN, TATAMOTORS)</label>
                  <input
                    type="text"
                    value={newSymbol}
                    onChange={(e) => setNewSymbol(e.target.value)}
                    placeholder="e.g. AXISBANK"
                    className="w-full px-2.5 py-1.5 rounded bg-slate-950 border border-slate-800 text-white font-mono uppercase focus:border-sky-500 focus:outline-none"
                    required
                  />
                </div>
                <div>
                  <label className="text-slate-400 block mb-1">Company Full Name</label>
                  <input
                    type="text"
                    value={newCompanyName}
                    onChange={(e) => setNewCompanyName(e.target.value)}
                    placeholder="e.g. Axis Bank Limited"
                    className="w-full px-2.5 py-1.5 rounded bg-slate-950 border border-slate-800 text-white focus:border-sky-500 focus:outline-none"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-slate-400 block mb-1">Sector Evaluation Model</label>
                  <select
                    value={newSector}
                    onChange={(e) => setNewSector(e.target.value as any)}
                    className="w-full px-2.5 py-1.5 rounded bg-slate-950 border border-slate-800 text-slate-200 focus:border-sky-500 focus:outline-none"
                  >
                    <option value="BANKING">Banking & Financials (NIM/GNPA/CRAR)</option>
                    <option value="IT_SERVICES">IT Services (ROE/OpMargin/CashFlow)</option>
                    <option value="ENERGY_CONGLOMERATE">Energy & Conglomerate</option>
                    <option value="AUTOMOBILE">Automobile & Mobility</option>
                    <option value="INDUSTRIALS">Industrials & Manufacturing</option>
                  </select>
                </div>
                <div>
                  <label className="text-slate-400 block mb-1">Base Price (INR ₹)</label>
                  <input
                    type="number"
                    step="0.05"
                    value={newBasePrice}
                    onChange={(e) => setNewBasePrice(e.target.value)}
                    className="w-full px-2.5 py-1.5 rounded bg-slate-950 border border-slate-800 text-white font-mono focus:border-sky-500 focus:outline-none"
                    required
                  />
                </div>
              </div>

              <button
                type="submit"
                className="w-full py-2 rounded bg-emerald-600 hover:bg-emerald-500 text-white font-semibold transition active:scale-98 flex items-center justify-center gap-1.5 text-xs shadow-sm"
              >
                {addedSuccess ? (
                  <>
                    <Check className="w-4 h-4 text-white" /> Stock Added & Ingested Successfully!
                  </>
                ) : (
                  '+ Add Stock to Multi-Agent Universe'
                )}
              </button>
            </form>
          </div>

          {/* Platform Target Rules & Kill Switch */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-lg p-4 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
              <div className="flex items-center gap-2">
                <Sliders className="w-4 h-4 text-sky-400" />
                <h3 className="text-xs font-bold text-white uppercase tracking-wider">
                  Target Displacement & Risk Controls
                </h3>
              </div>

              {/* Master Kill Switch */}
              <button
                onClick={onToggleKillSwitch}
                className={`px-2.5 py-1 rounded text-xs font-bold transition flex items-center gap-1 ${
                  config.risk_controls.kill_switch_new_orders
                    ? 'bg-rose-950 text-rose-300 border border-rose-800'
                    : 'bg-slate-800 text-slate-300 border border-slate-700'
                }`}
              >
                <ShieldAlert className="w-3.5 h-3.5" />
                {config.risk_controls.kill_switch_new_orders ? 'KILL SWITCH ACTIVE' : 'Kill Switch Disarmed'}
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="grid grid-cols-3 gap-2 font-mono">
                <div>
                  <label className="text-slate-400 block mb-1 text-[11px]">Min |E - P₀| (₹)</label>
                  <input
                    type="number"
                    step="0.5"
                    value={minDisplacement}
                    onChange={(e) => setMinDisplacement(parseFloat(e.target.value) || 3.0)}
                    className="w-full px-2 py-1 rounded bg-slate-950 border border-slate-800 text-white text-xs"
                  />
                </div>
                <div>
                  <label className="text-slate-400 block mb-1 text-[11px]">Min |T - P₀| (₹)</label>
                  <input
                    type="number"
                    step="0.5"
                    value={minTargetFromRef}
                    onChange={(e) => setMinTargetFromRef(parseFloat(e.target.value) || 3.0)}
                    className="w-full px-2 py-1 rounded bg-slate-950 border border-slate-800 text-white text-xs"
                  />
                </div>
                <div>
                  <label className="text-slate-400 block mb-1 text-[11px]">Min Reward:Risk</label>
                  <input
                    type="number"
                    step="0.1"
                    value={minRR}
                    onChange={(e) => setMinRR(parseFloat(e.target.value) || 1.5)}
                    className="w-full px-2 py-1 rounded bg-slate-950 border border-slate-800 text-white text-xs"
                  />
                </div>
              </div>

              {/* Agent Weights */}
              <div className="pt-2 border-t border-slate-800 space-y-2">
                <div className="text-[11px] font-semibold text-slate-300">
                  Specialized Agent Weights (Must Sum to 1.00)
                </div>
                <div className="grid grid-cols-2 gap-2 font-mono text-[11px]">
                  <div>
                    <span className="text-slate-400">Technical (0.40):</span>
                    <input
                      type="number"
                      step="0.05"
                      value={weights.technical}
                      onChange={(e) =>
                        setWeights({ ...weights, technical: parseFloat(e.target.value) || 0.4 })
                      }
                      className="w-full px-2 py-0.5 rounded bg-slate-950 border border-slate-800 text-white mt-0.5"
                    />
                  </div>
                  <div>
                    <span className="text-slate-400">Pattern (0.30):</span>
                    <input
                      type="number"
                      step="0.05"
                      value={weights.pattern}
                      onChange={(e) =>
                        setWeights({ ...weights, pattern: parseFloat(e.target.value) || 0.3 })
                      }
                      className="w-full px-2 py-0.5 rounded bg-slate-950 border border-slate-800 text-white mt-0.5"
                    />
                  </div>
                  <div>
                    <span className="text-slate-400">Sentiment (0.15):</span>
                    <input
                      type="number"
                      step="0.05"
                      value={weights.sentiment}
                      onChange={(e) =>
                        setWeights({ ...weights, sentiment: parseFloat(e.target.value) || 0.15 })
                      }
                      className="w-full px-2 py-0.5 rounded bg-slate-950 border border-slate-800 text-white mt-0.5"
                    />
                  </div>
                  <div>
                    <span className="text-slate-400">Fundamental (0.15):</span>
                    <input
                      type="number"
                      step="0.05"
                      value={weights.fundamental}
                      onChange={(e) =>
                        setWeights({ ...weights, fundamental: parseFloat(e.target.value) || 0.15 })
                      }
                      className="w-full px-2 py-0.5 rounded bg-slate-950 border border-slate-800 text-white mt-0.5"
                    />
                  </div>
                </div>
              </div>

              <button
                onClick={handleSaveRules}
                className="w-full py-1.5 rounded bg-sky-600 hover:bg-sky-500 text-white font-semibold transition active:scale-98 text-xs mt-2"
              >
                Apply Updated Rules & Weights
              </button>
            </div>
          </div>
        </div>

        {/* Right Column: System Monitor Agent & Telemetry Log */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-lg p-4 flex flex-col h-full">
          <div className="flex items-center justify-between border-b border-slate-800 pb-2.5 mb-3">
            <div className="flex items-center gap-2">
              <Terminal className="w-4 h-4 text-emerald-400" />
              <h3 className="text-xs font-bold text-white uppercase tracking-wider">
                8. System Monitor Agent — Structured Telemetry Stream
              </h3>
            </div>
            <div className="flex items-center gap-1 text-[11px] text-slate-400">
              <Lock className="w-3 h-3 text-amber-400" />
              <span>Token Redaction: ACTIVE</span>
            </div>
          </div>

          <div className="bg-slate-950 rounded border border-slate-800 p-3 font-mono text-[11px] overflow-y-auto max-h-[580px] space-y-2 flex-1">
            {systemEvents.length === 0 ? (
              <div className="text-slate-500 py-6 text-center">
                Telemetry queue empty. Step candles to generate execution node events.
              </div>
            ) : (
              systemEvents.map((evt) => (
                <div
                  key={evt.id}
                  className="p-2 rounded bg-slate-900/70 border border-slate-800/80 space-y-1"
                >
                  <div className="flex items-center justify-between text-slate-400 text-[10px]">
                    <span className="text-sky-300 font-bold">{evt.component}</span>
                    <span>{new Date(evt.timestamp).toLocaleTimeString('en-IN')}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-white font-semibold">
                      [{evt.event_type}] {evt.correlation_id}
                    </span>
                    <span className="text-emerald-400 font-bold">{evt.latency_ms} ms</span>
                  </div>
                  <pre className="text-[10px] text-slate-400 overflow-x-auto whitespace-pre-wrap">
                    {JSON.stringify(evt.details)}
                  </pre>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
