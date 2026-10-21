import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  DEFAULT_INSTRUMENTS,
  LATEST_MARKET_REFERENCE_PRICES,
  generateHistoricalCandles,
  fetchNewsAndSocial,
  fetchFundamentals,
} from './services/marketData';
import { getSessionWindowStatus } from './services/nseCalendar';
import { roundToTick } from './services/targetValidator';
import { runTechnicalAnalysis } from './services/agents/technicalAgent';
import { runPatternRecognition } from './services/agents/patternAgent';
import { runSentimentAnalysis } from './services/agents/sentimentAgent';
import { runFundamentalAnalysis } from './services/agents/fundamentalAgent';
import { runStrategyOrchestrator } from './services/agents/orchestratorAgent';
import {
  computePositionSize,
  evaluateCandleOnOrder,
} from './services/agents/paperTradingAgent';
import { runPostMortemAudit } from './services/agents/postMortemAgent';
import { runNextSessionOpeningForecast } from './services/agents/eodForecaster';
import { SYSTEM_MONITOR } from './services/agents/systemMonitorAgent';
import { HeaderBanner } from './components/HeaderBanner';
import { Level1MarketOverview } from './components/Level1MarketOverview';
import { Level2StockDetail } from './components/Level2StockDetail';
import { Level3AgentInspection } from './components/Level3AgentInspection';
import { Level4PaperTrading } from './components/Level4PaperTrading';
import { Level5ForecastsAndBacktest } from './components/Level5ForecastsAndBacktest';
import { Level6ConfigAndMonitor } from './components/Level6ConfigAndMonitor';
import { RepoExplorerModal } from './components/RepoExplorerModal';
import { UserGuideModal } from './components/UserGuideModal';
import { MarketFeedModal } from './components/MarketFeedModal';
import { UpstoxBrokerModal } from './components/UpstoxBrokerModal';
import {
  checkUpstoxStatus,
  fetchUpstoxLiveQuotes,
  fetchUpstoxLiveCandles,
} from './services/upstoxClient';
import { load30DayHistoricalCandles } from './services/localCandleDb';
import { generateSeedDateBasedPaperOrders } from './services/learningStore';
import {
  AgentRunAudit,
  Candle,
  InstrumentConfig,
  NextSessionForecast,
  PaperOrder,
  PlatformConfig,
  SessionStatus,
  SystemMonitorEvent,
  UpstoxConnectionState,
  UpstoxLiveQuote,
} from './types/platform';
import {
  LayoutDashboard,
  LineChart,
  Workflow,
  Receipt,
  TrendingUp,
  Settings,
} from 'lucide-react';

const INITIAL_CONFIG: PlatformConfig = {
  version: '1.0.0',
  strategy_version: 'strat-v1.4.0',
  model_version: 'ridge-open-v1.2',
  target_rules: {
    min_entry_displacement_inr: 3.0,
    min_target_from_ref_inr: 3.0,
    min_target_from_entry_inr: 3.0,
    default_horizon_minutes: 45,
    signal_expiry_minutes: 15,
  },
  risk_controls: {
    starting_capital_inr: 1000000.0,
    risk_per_trade_pct: 0.01,
    max_position_value_inr: 250000.0,
    max_simultaneous_positions: 3,
    max_per_stock_exposure_inr: 250000.0,
    max_sector_exposure_inr: 500000.0,
    max_daily_loss_inr: 25000.0,
    max_trades_per_day: 10,
    min_reward_to_risk: 1.5,
    max_slippage_bps: 15.0,
    cooldown_after_consecutive_losses: 3,
    allow_short_selling: true,
    kill_switch_new_orders: false,
    auto_promote_post_mortem: false,
    post_mortem_min_sample_size: 20,
  },
  agent_weights: {
    technical: 0.4,
    pattern: 0.3,
    sentiment: 0.15,
    fundamental: 0.15,
  },
  instruments: DEFAULT_INSTRUMENTS,
};

function getStepPseudoRandom(seed: number, index: number): number {
  const x = Math.sin(seed * 997 + index * 101.37) * 10000;
  return x - Math.floor(x);
}

function generateContinuationBars(
  inst: InstrumentConfig,
  baseCandles: Candle[],
  steps: number,
  timeframe: '1m' | '5m' | '15m' = '1m'
): Candle[] {
  if (!baseCandles || baseCandles.length === 0 || steps <= 0) return [];
  const lastBase = baseCandles[baseCandles.length - 1];
  const tfSeconds = timeframe === '1m' ? 60 : timeframe === '5m' ? 300 : 900;
  const seed = inst.symbol.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
  const tfMultiplier = timeframe === '1m' ? 1 : timeframe === '5m' ? 2.1 : 3.6;
  const barVolRup = Math.max(inst.tick_size * 2, (inst.base_demo_price || 1000) * 0.00065 * tfMultiplier);

  const continuation: Candle[] = [];
  let prevClose = lastBase.close;

  for (let s = 1; s <= steps; s++) {
    const barTime = lastBase.time + s * tfSeconds;
    const r1 = getStepPseudoRandom(seed, s * 7 + 1);
    const r2 = getStepPseudoRandom(seed, s * 13 + 3);
    const r3 = getStepPseudoRandom(seed, s * 19 + 5);

    const cycle = Math.sin(s / 6 + (seed % 5)) * 0.4;
    const delta = (r1 - 0.49 + cycle * 0.25) * barVolRup;
    const close = roundToTick(prevClose + delta, inst.tick_size);
    const open = prevClose;
    const high = roundToTick(Math.max(open, close) + r2 * barVolRup * 0.75 + inst.tick_size, inst.tick_size);
    const low = roundToTick(Math.min(open, close) - r3 * barVolRup * 0.75 - inst.tick_size, inst.tick_size);
    const volume = Math.floor((30000 + ((seed * 111) % 20000) + r1 * 15000) * tfMultiplier);

    continuation.push({
      time: barTime,
      open,
      high,
      low,
      close,
      volume,
    });
    prevClose = close;
  }

  return continuation;
}

export default function App() {
  const [activeLevel, setActiveLevel] = useState<number>(1);
  const [selectedSymbol, setSelectedSymbol] = useState<string>('RELIANCE');
  const [timeframe, setTimeframe] = useState<'1m' | '5m' | '15m'>('1m');
  const [stepCount, setStepCount] = useState<number>(0);
  const [isAutoPlaying, setIsAutoPlaying] = useState<boolean>(true);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [repoExplorerOpen, setRepoExplorerOpen] = useState<boolean>(false);
  const [userGuideOpen, setUserGuideOpen] = useState<boolean>(false);
  const [feedModalOpen, setFeedModalOpen] = useState<boolean>(false);
  const [upstoxModalOpen, setUpstoxModalOpen] = useState<boolean>(false);
  const [upstoxConnection, setUpstoxConnection] = useState<UpstoxConnectionState>({
    connected: false,
    hasServerToken: false,
  });
  const [isUpstoxFeedActive, setIsUpstoxFeedActive] = useState<boolean>(true);
  const [upstoxQuotes, setUpstoxQuotes] = useState<Record<string, UpstoxLiveQuote>>({});
  const [upstoxCandlesCache, setUpstoxCandlesCache] = useState<Record<string, Candle[]>>({});
  const [dbCandlesMap, setDbCandlesMap] = useState<Record<string, Candle[]>>({});
  const [streamSpeed, setStreamSpeed] = useState<number>(3);
  const [enforceRealMarketHours, setEnforceRealMarketHours] = useState<boolean>(false);

  const [platformConfig, setPlatformConfig] = useState<PlatformConfig>(INITIAL_CONFIG);
  const [instruments, setInstruments] = useState<InstrumentConfig[]>(DEFAULT_INSTRUMENTS);
  const [orders, setOrders] = useState<PaperOrder[]>(() =>
    generateSeedDateBasedPaperOrders(DEFAULT_INSTRUMENTS, [])
  );
  const [systemEvents, setSystemEvents] = useState<SystemMonitorEvent[]>([]);

  // Load 30-Day 1m candles from local database
  const load30DayDbCandles = useCallback(async (sym: string) => {
    try {
      const res = await load30DayHistoricalCandles(sym);
      if (res.candles && res.candles.length > 0) {
        setDbCandlesMap((prev) => ({ ...prev, [sym]: res.candles }));
      }
    } catch (err) {
      console.warn('Notice: could not load 30d candles for', sym, err);
    }
  }, []);

  // Preload 30-day 1m candle database for active stock and all instruments
  useEffect(() => {
    load30DayDbCandles(selectedSymbol);
    DEFAULT_INSTRUMENTS.forEach((inst) => {
      if (inst.symbol !== selectedSymbol) {
        load30DayDbCandles(inst.symbol);
      }
    });
  }, [selectedSymbol, load30DayDbCandles]);

  // Session status clock
  const [sessionStatus, setSessionStatus] = useState<SessionStatus>(() =>
    getSessionWindowStatus(new Date())
  );

  // Periodic clock refresh
  useEffect(() => {
    const timer = setInterval(() => {
      setSessionStatus(getSessionWindowStatus(new Date()));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Compute selected instrument
  const currentInstrument = useMemo(() => {
    return (
      instruments.find((i) => i.symbol === selectedSymbol) ||
      instruments[0] ||
      DEFAULT_INSTRUMENTS[0]
    );
  }, [instruments, selectedSymbol]);

  // Compute candles for selected stock:
  // 1. If Upstox live feed is streaming and has live bars -> use Upstox live bars
  // 2. If 30-day local database has stored 1m continuous candles -> use local DB (7,500 continuous bars!)
  // 3. Fallback to generator
  const currentCandles = useMemo(() => {
    if (
      upstoxConnection.connected &&
      isUpstoxFeedActive &&
      upstoxCandlesCache[currentInstrument.symbol]?.length
    ) {
      return upstoxCandlesCache[currentInstrument.symbol];
    }
    if (dbCandlesMap[currentInstrument.symbol]?.length) {
      const base = dbCandlesMap[currentInstrument.symbol];
      if (stepCount > 0) {
        const continuation = generateContinuationBars(currentInstrument, base, stepCount, timeframe);
        return [...base, ...continuation];
      }
      return base;
    }
    return generateHistoricalCandles(currentInstrument, timeframe, 80, stepCount, sessionStatus);
  }, [
    currentInstrument,
    timeframe,
    stepCount,
    sessionStatus,
    upstoxConnection.connected,
    isUpstoxFeedActive,
    upstoxCandlesCache,
    dbCandlesMap,
  ]);

  // Execute multi-agent pipeline for a given instrument
  const runAgentPipelineForStock = useCallback(
    (inst: InstrumentConfig, step: number) => {
      const t0 = performance.now();
      const corrId = `corr-${inst.symbol.toLowerCase()}-${step}`;

      // Ingest 1m, 5m, 15m candles (seamlessly using authentic 30D DB bars or Upstox live stream)
      const liveCandles =
        upstoxConnection.connected &&
        isUpstoxFeedActive &&
        upstoxCandlesCache[inst.symbol]?.length
          ? upstoxCandlesCache[inst.symbol]
          : null;

      const dbCandles = dbCandlesMap[inst.symbol]?.length
        ? dbCandlesMap[inst.symbol]
        : null;

      // Provide the entire 30-day continuous candle dataset (all 7,500 bars) plus live streaming bars to every agent
      const c1m = (() => {
        if (dbCandles && dbCandles.length >= 10) {
          if (liveCandles && liveCandles.length > 0) {
            const lastDbTime = dbCandles[dbCandles.length - 1].time;
            const newLiveBars = liveCandles.filter((c) => c.time > lastDbTime);
            return newLiveBars.length > 0 ? [...dbCandles, ...newLiveBars] : dbCandles;
          }
          if (step > 0) {
            const continuation = generateContinuationBars(inst, dbCandles, step, '1m');
            return [...dbCandles, ...continuation];
          }
          return dbCandles; // Complete 30-day continuous 1m database (7,500 bars!)
        }
        if (liveCandles && liveCandles.length >= 10) {
          return liveCandles;
        }
        return generateHistoricalCandles(inst, '1m', 75, step, sessionStatus);
      })();

      const c5m = generateHistoricalCandles(inst, '5m', 25, step, sessionStatus);
      const c15m = generateHistoricalCandles(inst, '15m', 15, step, sessionStatus);
      const news = fetchNewsAndSocial(inst);
      const fund = fetchFundamentals(inst);

      SYSTEM_MONITOR.record(
        corrId,
        'DataIngestionNode',
        'OHLCV_FETCHED',
        {
          symbol: inst.symbol,
          bars: c1m.length,
          mode: liveCandles ? 'UPSTOX_LIVE' : dbCandles ? 'LOCAL_30D_DB' : 'DEMO_REPLAY',
        },
        Math.round(performance.now() - t0)
      );

      // Node 1: Technical Analysis
      const t1 = performance.now();
      const tech = runTechnicalAnalysis(c1m, c5m, c15m);
      SYSTEM_MONITOR.record(
        corrId,
        'TechnicalAgent',
        'COMPLETED',
        { score: tech.score, bias: tech.bias },
        Math.round(performance.now() - t1)
      );

      // Node 2: Pattern Recognition
      const t2 = performance.now();
      const pattern = runPatternRecognition(c1m);
      SYSTEM_MONITOR.record(
        corrId,
        'PatternAgent',
        'COMPLETED',
        { pattern: pattern.pattern_type, status: pattern.status },
        Math.round(performance.now() - t2)
      );

      // Node 3: Sentiment Analysis
      const t3 = performance.now();
      const sent = runSentimentAnalysis(news);
      SYSTEM_MONITOR.record(
        corrId,
        'SentimentAgent',
        'COMPLETED',
        { score: sent.score, class: sent.classification },
        Math.round(performance.now() - t3)
      );

      // Node 4: Fundamental Analysis
      const t4 = performance.now();
      const fundOut = runFundamentalAnalysis(inst.symbol, inst.sector, fund);
      SYSTEM_MONITOR.record(
        corrId,
        'FundamentalAgent',
        'COMPLETED',
        { score: fundOut.score, sectorModel: fundOut.sector_model },
        Math.round(performance.now() - t4)
      );

      // Node 5: Strategy Orchestrator & Deterministic Target Validator
      const t5 = performance.now();
      const orch = runStrategyOrchestrator(
        inst,
        platformConfig,
        tech,
        pattern,
        sent,
        fundOut,
        new Date(),
        'DEMO_REPLAY'
      );
      SYSTEM_MONITOR.record(
        corrId,
        'StrategyOrchestrator',
        'DECISION_EMITTED',
        { decision: orch.decision, score: orch.composite_score },
        Math.round(performance.now() - t5)
      );

      // EOD Next-Session Forecast
      const fc = runNextSessionOpeningForecast(
        inst,
        c1m,
        sent.score,
        platformConfig,
        new Date(),
        step
      );

      const audit: AgentRunAudit = {
        run_id: `run-${inst.symbol.toLowerCase()}-${step}`,
        correlation_id: corrId,
        instrument_id: inst.instrument_id,
        symbol: inst.symbol,
        as_of_timestamp: new Date().toISOString(),
        technical_output: tech,
        pattern_output: pattern,
        sentiment_output: sent,
        fundamental_output: fundOut,
        orchestrator_output: orch,
        strategy_version: platformConfig.strategy_version,
        duration_ms: Math.round(performance.now() - t0),
      };

      return { audit, forecast: fc, latestCandle: c1m[c1m.length - 1] };
    },
    [platformConfig, sessionStatus, upstoxConnection.connected, isUpstoxFeedActive, upstoxCandlesCache]
  );

  // Compute live multi-agent outputs for ALL stocks in universe
  const universeAnalysis = useMemo(() => {
    return instruments.map((inst) => {
      const res = runAgentPipelineForStock(inst, stepCount);
      return {
        instrument: inst,
        audit: res.audit,
        forecast: res.forecast,
        latestCandle: res.latestCandle,
      };
    });
  }, [instruments, stepCount, runAgentPipelineForStock]);

  // Selected Stock Audit Data
  const currentAuditData = useMemo(() => {
    const found = universeAnalysis.find((u) => u.instrument.symbol === currentInstrument.symbol);
    return found ? found.audit : null;
  }, [universeAnalysis, currentInstrument]);

  const stepCountRef = useRef<number>(0);
  useEffect(() => {
    stepCountRef.current = stepCount;
  }, [stepCount]);

  // Step Simulation Handler
  const handleStepSimulation = useCallback(() => {
    if (enforceRealMarketHours && !sessionStatus.is_market_open) {
      return;
    }
    const nextStep = stepCountRef.current + 1;
    stepCountRef.current = nextStep;
    setStepCount(nextStep);

    // Evaluate existing virtual orders against new candles
    setOrders((prevOrders) => {
      let updatedOrders = [...prevOrders];

      // 1. Advance existing orders with current candle of their respective instrument
      updatedOrders = updatedOrders.map((ord) => {
        if (ord.status === 'CLOSED' || ord.status === 'EXPIRED') return ord;
        const analysis = universeAnalysis.find((u) => u.instrument.symbol === ord.symbol);
        if (!analysis) return ord;

        const evaluated = evaluateCandleOnOrder(ord, analysis.latestCandle, analysis.instrument.tick_size);

        // If order just closed, attach post-mortem audit
        if (evaluated.status === 'CLOSED' && !evaluated.post_mortem) {
          const closedCount = updatedOrders.filter((o) => o.status === 'CLOSED').length + 1;
          const pm = runPostMortemAudit(evaluated, closedCount, platformConfig);
          return { ...evaluated, post_mortem: pm };
        }
        return evaluated;
      });

      // 2. Check if any new signals should generate a paper order (unless Kill Switch is active)
      if (!platformConfig.risk_controls.kill_switch_new_orders) {
        universeAnalysis.forEach(({ instrument, audit, latestCandle }) => {
          const orch = audit.orchestrator_output;
          if (
            (orch.decision === 'LONG' || orch.decision === 'SHORT') &&
            orch.planned_entry &&
            orch.planned_target &&
            orch.planned_stop
          ) {
            // Check if active order already exists for this symbol
            const hasActive = updatedOrders.some(
              (o) => o.symbol === instrument.symbol && (o.status === 'PENDING' || o.status === 'FILLED')
            );

            if (!hasActive && updatedOrders.length < 15) {
              const qty = computePositionSize(
                orch.planned_entry,
                orch.planned_stop,
                platformConfig,
                platformConfig.risk_controls.starting_capital_inr
              );

              const newOrd: PaperOrder = {
                order_id: `ord-${instrument.symbol.toLowerCase()}-${nextStep}-${Math.random().toString(36).slice(2, 5)}`,
                signal_id: `sig-${instrument.symbol.toLowerCase()}-${nextStep}`,
                instrument_id: instrument.instrument_id,
                symbol: instrument.symbol,
                direction: orch.decision,
                quantity: qty,
                status: 'PENDING',
                planned_entry: orch.planned_entry,
                planned_target: orch.planned_target,
                planned_stop: orch.planned_stop,
                entry_fill_price: null,
                exit_fill_price: null,
                entry_time: null,
                exit_time: null,
                expiry_time: orch.expiry_timestamp,
                exit_reason: null,
                gross_pnl_inr: 0,
                total_costs_inr: 0,
                net_pnl_inr: 0,
                mfe_inr: 0,
                mae_inr: 0,
                created_at: new Date().toISOString(),
                prediction_type: 'INTRADAY',
                session_date: new Date().toISOString().split('T')[0],
                outcome_status: 'ACTIVE_TRACKING',
              };

              // Evaluate against current candle immediately to simulate entry trigger
              const checked = evaluateCandleOnOrder(newOrd, latestCandle, instrument.tick_size);
              updatedOrders.unshift(checked);
            }
          }
        });
      }

      return updatedOrders;
    });

    // Dynamically update base price across all universe instruments from streaming candle
    setInstruments((prevInsts) =>
      prevInsts.map((inst) => {
        const found = universeAnalysis.find((u) => u.instrument.symbol === inst.symbol);
        if (found && found.latestCandle && found.latestCandle.close > 0) {
          return { ...inst, base_demo_price: found.latestCandle.close };
        }
        return inst;
      })
    );

    // Update telemetry log
    setSystemEvents(SYSTEM_MONITOR.getRecentEvents(50));
  }, [universeAnalysis, platformConfig, enforceRealMarketHours, sessionStatus.is_market_open]);

  // Keep ref to latest handleStepSimulation so interval timer never resets prematurely
  const handleStepSimulationRef = useRef(handleStepSimulation);
  useEffect(() => {
    handleStepSimulationRef.current = handleStepSimulation;
  });

  // Auto-play timer — stable interval keyed strictly to isAutoPlaying and streamSpeed
  useEffect(() => {
    if (!isAutoPlaying) return;
    const interval = setInterval(() => {
      handleStepSimulationRef.current();
    }, streamSpeed * 1000);
    return () => clearInterval(interval);
  }, [isAutoPlaying, streamSpeed]);

  // Reset simulation
  const handleReset = () => {
    setStepCount(1);
    setOrders([]);
    SYSTEM_MONITOR.clear();
    setSystemEvents([]);
  };

  // Upstox live feed fetcher
  const handleRefreshUpstox = useCallback(async () => {
    try {
      const status = await checkUpstoxStatus();
      setUpstoxConnection(status);

      if (status.connected) {
        const keys = instruments
          .map((i) => i.upstox_instrument_key)
          .filter(Boolean) as string[];

        if (keys.length > 0) {
          const quotes = await fetchUpstoxLiveQuotes(keys);
          setUpstoxQuotes(quotes);

          // Dynamically update base prices for all instruments from Upstox LTP
          setInstruments((prev) =>
            prev.map((inst) => {
              const q = quotes[inst.symbol] || (inst.upstox_instrument_key ? quotes[inst.upstox_instrument_key] : undefined);
              return q && q.last_price > 0 ? { ...inst, base_demo_price: q.last_price } : inst;
            })
          );
        }

        // Fetch intraday candles for current instrument if not yet cached
        const currentKey = currentInstrument.upstox_instrument_key;
        if (currentKey && !upstoxCandlesCache[currentInstrument.symbol]?.length) {
          const interval = timeframe === '15m' ? '30minute' : '1minute';
          const candles = await fetchUpstoxLiveCandles(currentKey, interval);
          if (candles.length > 0) {
            setUpstoxCandlesCache((prev) => ({
              ...prev,
              [currentInstrument.symbol]: candles,
            }));
          }
        }
      }
    } catch (err: any) {
      console.warn('Upstox refresh notice:', err);
    }
  }, [instruments, currentInstrument, timeframe, upstoxCandlesCache]);

  // Initial check on mount
  useEffect(() => {
    handleRefreshUpstox();
  }, [handleRefreshUpstox]);

  // Refetch candles when selected instrument or timeframe changes
  useEffect(() => {
    if (!upstoxConnection.connected || !isUpstoxFeedActive) return;
    const currentKey = currentInstrument.upstox_instrument_key;
    if (!currentKey) return;

    const interval = timeframe === '15m' ? '30minute' : '1minute';
    fetchUpstoxLiveCandles(currentKey, interval)
      .then((candles) => {
        if (candles.length > 0) {
          setUpstoxCandlesCache((prev) => ({
            ...prev,
            [currentInstrument.symbol]: candles,
          }));
        }
      })
      .catch((e) => console.warn('Candle fetch error:', e));
  }, [currentInstrument.symbol, timeframe, upstoxConnection.connected, isUpstoxFeedActive]);

  // Periodic polling for quotes when Upstox is active (5 seconds cadence)
  useEffect(() => {
    if (!upstoxConnection.connected || !isUpstoxFeedActive) return;
    const interval = setInterval(() => {
      handleRefreshUpstox();
    }, Math.max(4500, streamSpeed * 1000));
    return () => clearInterval(interval);
  }, [upstoxConnection.connected, isUpstoxFeedActive, streamSpeed, handleRefreshUpstox]);

  // Toggle Master Kill Switch
  const handleToggleKillSwitch = () => {
    const nextVal = !platformConfig.risk_controls.kill_switch_new_orders;
    setPlatformConfig((prev) => ({
      ...prev,
      risk_controls: {
        ...prev.risk_controls,
        kill_switch_new_orders: nextVal,
      },
    }));

    SYSTEM_MONITOR.record(
      `corr-admin-kill-switch`,
      'AdminRiskControl',
      nextVal ? 'KILL_SWITCH_ENGAGED' : 'KILL_SWITCH_DISARMED',
      { status: nextVal ? 'NEW_ORDERS_HALTED' : 'NORMAL_EXECUTION' },
      0,
      nextVal ? 'WARN' : 'INFO'
    );
    setSystemEvents(SYSTEM_MONITOR.getRecentEvents(50));
  };

  // Add new stock to universe dynamically
  const handleAddStock = (newInst: InstrumentConfig) => {
    setInstruments((prev) => [...prev, newInst]);
    SYSTEM_MONITOR.record(
      `corr-universe-add`,
      'UniverseManager',
      'STOCK_ADDED',
      { symbol: newInst.symbol, company: newInst.company_name, sector: newInst.sector },
      0,
      'INFO'
    );
    setSystemEvents(SYSTEM_MONITOR.getRecentEvents(50));
  };

  // Calibrate stock market price (e.g. for bonus splits or real-time alignment)
  const handleUpdateInstrumentPrice = (symbol: string, newPrice: number) => {
    setInstruments((prev) =>
      prev.map((inst) =>
        inst.symbol === symbol ? { ...inst, base_demo_price: newPrice } : inst
      )
    );
    SYSTEM_MONITOR.record(
      `corr-price-calibration-${symbol.toLowerCase()}`,
      'MarketDataCalibration',
      'BASE_PRICE_CALIBRATED',
      { symbol, calibrated_base_price: newPrice },
      0,
      'INFO'
    );
    setSystemEvents(SYSTEM_MONITOR.getRecentEvents(50));
  };

  // Sync all instruments to current market reference prices
  const handleSyncAllPricesToMarket = () => {
    setInstruments((prev) =>
      prev.map((inst) => {
        const refPrice = LATEST_MARKET_REFERENCE_PRICES[inst.symbol];
        return refPrice ? { ...inst, base_demo_price: refPrice } : inst;
      })
    );
    SYSTEM_MONITOR.record(
      `corr-sync-all-market-ref`,
      'MarketDataCalibration',
      'ALL_PRICES_SYNCED_TO_MARKET_REF',
      { timestamp: new Date().toISOString() },
      0,
      'INFO'
    );
    setSystemEvents(SYSTEM_MONITOR.getRecentEvents(50));
  };

  // Sync all instruments to live Upstox LTP
  const handleSyncAllPricesToUpstox = () => {
    setInstruments((prev) =>
      prev.map((inst) => {
        const q = upstoxQuotes[inst.symbol] || (inst.upstox_instrument_key ? upstoxQuotes[inst.upstox_instrument_key] : undefined);
        return q && q.last_price > 0 ? { ...inst, base_demo_price: q.last_price } : inst;
      })
    );
    SYSTEM_MONITOR.record(
      `corr-sync-all-upstox`,
      'MarketDataCalibration',
      'ALL_PRICES_SYNCED_TO_UPSTOX_LTP',
      { timestamp: new Date().toISOString() },
      0,
      'INFO'
    );
    setSystemEvents(SYSTEM_MONITOR.getRecentEvents(50));
  };

  // Instant Paper Trade from Level 2 Chart Buy/Sell buttons
  const handleQuickTrade = (symbol: string, direction: 'LONG' | 'SHORT', price: number, qty: number) => {
    const inst = instruments.find((i) => i.symbol === symbol) || currentInstrument;
    const targetOffset = 3.0; // INR 3.00 minimum displacement
    const stopOffset = 1.5;

    const newOrd: PaperOrder = {
      order_id: `ord-quick-${symbol.toLowerCase()}-${Date.now().toString(36)}`,
      signal_id: `sig-chart-manual-${Date.now().toString(36)}`,
      instrument_id: inst.instrument_id,
      symbol: symbol,
      direction: direction,
      quantity: qty,
      status: 'FILLED',
      planned_entry: price,
      planned_target: direction === 'LONG' ? price + targetOffset : price - targetOffset,
      planned_stop: direction === 'LONG' ? price - stopOffset : price + stopOffset,
      entry_fill_price: price,
      exit_fill_price: null,
      entry_time: new Date().toISOString(),
      exit_time: null,
      expiry_time: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
      exit_reason: null,
      gross_pnl_inr: 0,
      total_costs_inr: Math.round(price * qty * 0.0003 * 100) / 100,
      net_pnl_inr: -(Math.round(price * qty * 0.0003 * 100) / 100),
      mfe_inr: 0,
      mae_inr: 0,
      created_at: new Date().toISOString(),
      prediction_type: 'INTRADAY',
      session_date: new Date().toISOString().split('T')[0],
      outcome_status: 'ACTIVE_TRACKING',
    };

    setOrders((prev) => [newOrd, ...prev]);

    SYSTEM_MONITOR.record(
      `corr-quick-trade-${symbol.toLowerCase()}`,
      'PaperTradingAgent',
      'CHART_QUICK_ORDER_EXECUTED',
      { symbol, direction, fill_price: price, quantity: qty },
      0,
      'INFO'
    );
    setSystemEvents(SYSTEM_MONITOR.getRecentEvents(50));
  };

  // Update Config
  const handleUpdateConfig = (updated: Partial<PlatformConfig>) => {
    setPlatformConfig((prev) => ({ ...prev, ...updated }));
  };

  // Prepare Level 1 Watchlist rows
  const watchlistRows = useMemo(() => {
    return universeAnalysis.map(({ instrument, audit, forecast, latestCandle }) => {
      const ind = audit.technical_output.indicators;
      const orch = audit.orchestrator_output;
      return {
        instrument,
        lastClose: ind.last_close || latestCandle.close,
        vwap: ind.vwap,
        rsi14: ind.rsi_14,
        atr14: ind.atr_14,
        direction: orch.decision,
        plannedEntry: orch.planned_entry,
        plannedTarget: orch.planned_target,
        plannedStop: orch.planned_stop,
        rewardRisk: orch.reward_to_risk,
        score: orch.composite_score,
        validation: orch.validation,
        forecast,
      };
    });
  }, [universeAnalysis]);

  // All forecasts for Level 5
  const allForecasts = useMemo(() => {
    return universeAnalysis.map((u) => u.forecast);
  }, [universeAnalysis]);

  return (
    <div className="min-h-screen bg-[#070b12] text-slate-100 flex flex-col font-sans selection:bg-sky-500 selection:text-white">
      {/* Top Banner with Real-Time Clock & Action Toolbar */}
      <HeaderBanner
        sessionStatus={sessionStatus}
        stepCount={stepCount}
        isAutoPlaying={isAutoPlaying}
        enforceRealMarketHours={enforceRealMarketHours}
        onToggleEnforceMarketHours={() => setEnforceRealMarketHours((prev) => !prev)}
        onStep={handleStepSimulation}
        onToggleAutoPlay={() => setIsAutoPlaying(!isAutoPlaying)}
        onReset={handleReset}
        onOpenRepoExplorer={() => setRepoExplorerOpen(true)}
        onOpenGuide={() => setUserGuideOpen(true)}
        isLoading={isLoading}
        killSwitchActive={platformConfig.risk_controls.kill_switch_new_orders}
        onToggleKillSwitch={handleToggleKillSwitch}
        streamSpeed={streamSpeed}
        onChangeStreamSpeed={setStreamSpeed}
        onOpenFeedModal={() => setFeedModalOpen(true)}
        isUpstoxConnected={upstoxConnection.connected && isUpstoxFeedActive}
        onOpenUpstoxModal={() => setUpstoxModalOpen(true)}
      />

      {/* 6-Level Navigation Tabs */}
      <nav className="bg-slate-950/80 border-b border-slate-800 px-4 py-2 sticky top-[61px] z-20 backdrop-blur-md">
        <div className="flex items-center gap-1.5 overflow-x-auto text-xs no-scrollbar">
          {[
            { id: 1, label: 'Level 1: Market Overview', icon: LayoutDashboard },
            { id: 2, label: `Level 2: Stock Detail (${selectedSymbol})`, icon: LineChart },
            { id: 3, label: `Level 3: Agent Inspection (${selectedSymbol})`, icon: Workflow },
            {
              id: 4,
              label: `Level 4: Paper Trading & Post-Mortem`,
              icon: Receipt,
              badge: orders.length > 0 ? String(orders.length) : undefined,
            },
            { id: 5, label: 'Level 5: Forecasts & Backtest', icon: TrendingUp },
            { id: 6, label: 'Level 6: Config & System Monitor', icon: Settings },
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeLevel === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveLevel(tab.id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md font-semibold transition shrink-0 ${
                  isActive
                    ? 'bg-sky-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
                }`}
              >
                <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-white' : 'text-slate-400'}`} />
                <span>{tab.label}</span>
                {tab.badge && (
                  <span className="ml-0.5 px-1.5 py-0.2 rounded-full text-[10px] bg-sky-950 text-sky-300 font-mono border border-sky-700">
                    {tab.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </nav>

      {/* Main Tab Panels */}
      <main className="flex-1 p-4 md:p-6 max-w-7xl mx-auto w-full">
        {activeLevel === 1 && (
          <Level1MarketOverview
            watchlist={watchlistRows}
            portfolioOrders={orders}
            config={platformConfig}
            onSelectSymbol={(sym) => setSelectedSymbol(sym)}
            onGoToLevel={(lvl) => setActiveLevel(lvl)}
          />
        )}

        {activeLevel === 2 && currentAuditData && (
          <Level2StockDetail
            instrument={currentInstrument}
            allInstruments={instruments}
            candles={currentCandles}
            timeframe={timeframe}
            onTimeframeChange={(tf) => setTimeframe(tf)}
            onSelectSymbol={(sym) => setSelectedSymbol(sym)}
            onUpdatePrice={handleUpdateInstrumentPrice}
            technicalOutput={currentAuditData.technical_output}
            orchestratorOutput={currentAuditData.orchestrator_output}
            validationResult={currentAuditData.orchestrator_output.validation}
            onInspectAgents={() => setActiveLevel(3)}
            sessionStatus={sessionStatus}
            isAutoPlaying={isAutoPlaying}
            onToggleAutoPlay={() => setIsAutoPlaying((prev) => !prev)}
            streamSpeed={streamSpeed}
            onChangeStreamSpeed={(speed) => setStreamSpeed(speed)}
            enforceRealMarketHours={enforceRealMarketHours}
            onToggleEnforceMarketHours={() => setEnforceRealMarketHours((prev) => !prev)}
            onStepSimulation={handleStepSimulation}
            isUpstoxConnected={upstoxConnection.connected && isUpstoxFeedActive}
            onOpenUpstoxModal={() => setUpstoxModalOpen(true)}
            onQuickTrade={handleQuickTrade}
            onReload30dDb={() => load30DayDbCandles(currentInstrument.symbol)}
          />
        )}

        {activeLevel === 3 && (
          <Level3AgentInspection audit={currentAuditData} config={platformConfig} />
        )}

        {activeLevel === 4 && (
          <Level4PaperTrading orders={orders} config={platformConfig} />
        )}

        {activeLevel === 5 && (
          <Level5ForecastsAndBacktest
            forecasts={allForecasts}
            instruments={instruments}
            config={platformConfig}
          />
        )}

        {activeLevel === 6 && (
          <Level6ConfigAndMonitor
            config={platformConfig}
            instruments={instruments}
            onUpdateConfig={handleUpdateConfig}
            onAddStock={handleAddStock}
            onUpdateInstrumentPrice={handleUpdateInstrumentPrice}
            onSyncAllPricesToMarket={handleSyncAllPricesToMarket}
            onSyncAllPricesToUpstox={handleSyncAllPricesToUpstox}
            upstoxQuotes={upstoxQuotes}
            onRefreshUpstox={handleRefreshUpstox}
            systemEvents={systemEvents}
            onToggleKillSwitch={handleToggleKillSwitch}
            isUpstoxConnected={upstoxConnection.connected && isUpstoxFeedActive}
            onOpenUpstoxModal={() => setUpstoxModalOpen(true)}
          />
        )}
      </main>

      {/* Code Repository & File Explorer Modal */}
      <RepoExplorerModal
        isOpen={repoExplorerOpen}
        onClose={() => setRepoExplorerOpen(false)}
      />

      {/* User Guide Modal */}
      <UserGuideModal
        isOpen={userGuideOpen}
        onClose={() => setUserGuideOpen(false)}
        onOpenRepoExplorer={() => {
          setUserGuideOpen(false);
          setRepoExplorerOpen(true);
        }}
      />

      {/* Market Feed & Live Stream Architecture Modal */}
      <MarketFeedModal
        isOpen={feedModalOpen}
        onClose={() => setFeedModalOpen(false)}
        sessionStatus={sessionStatus}
        isAutoPlaying={isAutoPlaying}
        onToggleAutoPlay={() => setIsAutoPlaying((prev) => !prev)}
        streamSpeed={streamSpeed}
        onChangeStreamSpeed={setStreamSpeed}
        isUpstoxConnected={upstoxConnection.connected && isUpstoxFeedActive}
        onOpenUpstoxModal={() => setUpstoxModalOpen(true)}
      />

      {/* Upstox Broker Live Market Feed API v2 Modal */}
      <UpstoxBrokerModal
        isOpen={upstoxModalOpen}
        onClose={() => setUpstoxModalOpen(false)}
        connectionState={upstoxConnection}
        onRefreshConnection={handleRefreshUpstox}
        isUpstoxFeedActive={isUpstoxFeedActive}
        onToggleUpstoxFeed={setIsUpstoxFeedActive}
        quotes={upstoxQuotes}
      />

      {/* Footer */}
      <footer className="bg-slate-950 border-t border-slate-900 px-4 py-3 text-center text-xs text-slate-500 flex flex-col sm:flex-row items-center justify-between max-w-7xl mx-auto w-full">
        <div>
          Indian Market Multi-Agent Intelligence Platform • National Stock Exchange of India (NSE)
        </div>
        <div className="text-[11px] text-slate-400 font-mono mt-1 sm:mt-0">
          Strategy {platformConfig.strategy_version} • Model {platformConfig.model_version}
        </div>
      </footer>
    </div>
  );
}
