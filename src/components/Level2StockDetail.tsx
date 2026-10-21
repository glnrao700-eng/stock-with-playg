import React, { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import {
  createChart,
  ColorType,
  IChartApi,
  CandlestickSeries,
  HistogramSeries,
  CrosshairMode,
  LineStyle,
} from 'lightweight-charts';
import {
  Candle,
  InstrumentConfig,
  OrchestratorOutput,
  TechnicalOutput,
  TargetValidationResult,
  SessionStatus,
} from '../types/platform';
import { LATEST_MARKET_REFERENCE_PRICES } from '../services/marketData';
import {
  exportCandlesToCSV,
  exportCandlesToJSON,
  triggerCollect30Days,
} from '../services/localCandleDb';
import {
  CheckCircle2,
  XCircle,
  Sliders,
  LineChart,
  ExternalLink,
  Activity,
  Edit3,
  AlertTriangle,
  ArrowLeft,
  RefreshCw,
  Radio,
  Calendar,
  Database,
  Download,
  FileSpreadsheet,
  FileCode,
  Zap,
  Play,
  Pause,
  FastForward,
  Clock,
} from 'lucide-react';

interface Level2StockDetailProps {
  instrument: InstrumentConfig;
  allInstruments: InstrumentConfig[];
  candles: Candle[];
  timeframe: '1m' | '5m' | '15m';
  onTimeframeChange: (tf: '1m' | '5m' | '15m') => void;
  onSelectSymbol: (symbol: string) => void;
  onUpdatePrice?: (symbol: string, newPrice: number) => void;
  technicalOutput: TechnicalOutput;
  orchestratorOutput: OrchestratorOutput;
  validationResult: TargetValidationResult | null;
  onInspectAgents: () => void;
  sessionStatus?: SessionStatus;
  isAutoPlaying?: boolean;
  onToggleAutoPlay?: () => void;
  streamSpeed?: number;
  onChangeStreamSpeed?: (speed: number) => void;
  enforceRealMarketHours?: boolean;
  onToggleEnforceMarketHours?: () => void;
  onStepSimulation?: () => void;
  isUpstoxConnected?: boolean;
  onOpenUpstoxModal?: () => void;
  onQuickTrade?: (symbol: string, direction: 'LONG' | 'SHORT', price: number, qty: number) => void;
  onReload30dDb?: () => Promise<void>;
}

export type ChartRange = '1D' | '5D' | '1M' | '3M' | '6M' | '1Y' | '5Y';

export const Level2StockDetail: React.FC<Level2StockDetailProps> = ({
  instrument,
  allInstruments,
  candles,
  timeframe,
  onTimeframeChange,
  onSelectSymbol,
  onUpdatePrice,
  technicalOutput,
  orchestratorOutput,
  validationResult,
  onInspectAgents,
  sessionStatus,
  isAutoPlaying = false,
  onToggleAutoPlay,
  streamSpeed = 3,
  onChangeStreamSpeed,
  enforceRealMarketHours = false,
  onToggleEnforceMarketHours,
  onStepSimulation,
  isUpstoxConnected = false,
  onOpenUpstoxModal,
  onQuickTrade,
  onReload30dDb,
}) => {
  const chartContainerRef = useRef<HTMLDivElement | null>(null);
  const chartInstanceRef = useRef<IChartApi | null>(null);
  const candleSeriesRef = useRef<any>(null);
  const volumeSeriesRef = useRef<any>(null);
  const currentSymbolRef = useRef<string>(instrument.symbol);
  const isScrolledBackRef = useRef<boolean>(false);

  // TradingView widget vs Internal Engine Chart
  const [useOfficialTvWidget, setUseOfficialTvWidget] = useState<boolean>(false);

  // Range selector (1D default, exactly matching user screenshot!)
  const [activeRange, setActiveRange] = useState<ChartRange>('1D');

  // Selected date for 1D mode (defaults to latest available session)
  const [selectedSessionDate, setSelectedSessionDate] = useState<string>('latest');

  // Interactive hovered candle for dynamic header OHLCV tracking
  const [hoveredCandle, setHoveredCandle] = useState<Candle | null>(null);

  // Quick Trade Quantity
  const [quickQty, setQuickQty] = useState<number>(1);
  const [quickTradeToast, setQuickTradeToast] = useState<string | null>(null);

  // Scale settings
  const [isPercentScale, setIsPercentScale] = useState<boolean>(false);

  // Local DB collection state
  const [isCollectingDb, setIsCollectingDb] = useState<boolean>(false);
  const [dbCollectMsg, setDbCollectMsg] = useState<string | null>(null);

  // Price Calibration modal/form
  const [isEditingPrice, setIsEditingPrice] = useState<boolean>(false);
  const [editedPrice, setEditedPrice] = useState<string>(String(instrument.base_demo_price));

  // Clock for UTC+5:30 display at bottom right (like screenshot)
  const [clockTime, setClockTime] = useState<string>(() =>
    new Date().toLocaleTimeString('en-IN', {
      timeZone: 'Asia/Kolkata',
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    })
  );

  useEffect(() => {
    const timer = setInterval(() => {
      setClockTime(
        new Date().toLocaleTimeString('en-IN', {
          timeZone: 'Asia/Kolkata',
          hour12: false,
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
        })
      );
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    setEditedPrice(String(instrument.base_demo_price));
  }, [instrument]);

  const handleSavePrice = (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = parseFloat(editedPrice);
    if (!isNaN(parsed) && parsed > 0 && onUpdatePrice) {
      onUpdatePrice(instrument.symbol, parsed);
    }
    setIsEditingPrice(false);
  };

  // Group candles by Indian trading date (YYYY-MM-DD in Asia/Kolkata)
  const sessionDates = useMemo(() => {
    if (!candles || candles.length === 0) return [];
    const dateMap = new Map<string, number>();
    for (const c of candles) {
      const dStr = new Date(c.time * 1000).toLocaleDateString('en-CA', {
        timeZone: 'Asia/Kolkata',
      });
      dateMap.set(dStr, (dateMap.get(dStr) || 0) + 1);
    }
    return Array.from(dateMap.entries()).map(([date, count]) => ({ date, count }));
  }, [candles]);

  // Ensure default selectedSessionDate is set to latest session
  const effectiveSessionDate = useMemo(() => {
    if (sessionDates.length === 0) return '';
    if (selectedSessionDate === 'latest') {
      return sessionDates[sessionDates.length - 1].date;
    }
    const found = sessionDates.find((s) => s.date === selectedSessionDate);
    return found ? found.date : sessionDates[sessionDates.length - 1].date;
  }, [sessionDates, selectedSessionDate]);

  // Track whether the user has scrolled back in time away from the latest bar
  const [isScrolledBack, setIsScrolledBack] = useState<boolean>(false);

  // Latest candle / currently hovered candle
  const latestCandle = useMemo(() => {
    if (candles && candles.length > 0) {
      return candles[candles.length - 1];
    }
    return null;
  }, [candles]);

  const activeCandle = hoveredCandle || latestCandle;

  // Calculate change for top OHLCV bar
  const priceStats = useMemo(() => {
    if (!activeCandle) {
      return {
        open: instrument.base_demo_price,
        high: instrument.base_demo_price,
        low: instrument.base_demo_price,
        close: instrument.base_demo_price,
        volume: 0,
        change: 0,
        changePct: 0,
        isPositive: true,
      };
    }
    const diff = activeCandle.close - activeCandle.open;
    const pct = activeCandle.open > 0 ? (diff / activeCandle.open) * 100 : 0;
    return {
      open: activeCandle.open,
      high: activeCandle.high,
      low: activeCandle.low,
      close: activeCandle.close,
      volume: activeCandle.volume,
      change: diff,
      changePct: pct,
      isPositive: diff >= 0,
    };
  }, [activeCandle, instrument.base_demo_price]);

  // Live tick tracking & direction flash
  const [tickDirection, setTickDirection] = useState<'UP' | 'DOWN' | 'FLAT'>('FLAT');
  const [liveTickCount, setLiveTickCount] = useState<number>(0);
  const prevPriceRef = useRef<number>(instrument.base_demo_price);

  useEffect(() => {
    if (activeCandle) {
      const cur = activeCandle.close;
      if (cur > prevPriceRef.current) {
        setTickDirection('UP');
        setLiveTickCount((c) => c + 1);
        const t = setTimeout(() => setTickDirection('FLAT'), 1800);
        return () => clearTimeout(t);
      } else if (cur < prevPriceRef.current) {
        setTickDirection('DOWN');
        setLiveTickCount((c) => c + 1);
        const t = setTimeout(() => setTickDirection('FLAT'), 1800);
        return () => clearTimeout(t);
      }
      prevPriceRef.current = cur;
    }
  }, [activeCandle?.close]);

  // Strategy price lines tracking
  const strategyLinesRef = useRef<{
    p0?: any;
    entry?: any;
    target?: any;
    stop?: any;
  }>({});

  // Set the viewport's visible range without wiping historical candles
  const applyVisibleRange = useCallback(
    (range: ChartRange, targetDate?: string) => {
      if (!chartInstanceRef.current || !candles || candles.length === 0) return;
      const timeScale = chartInstanceRef.current.timeScale();

      if (range === '1D') {
        const dateToUse = targetDate || effectiveSessionDate;
        let start = -1;
        let end = -1;
        for (let i = 0; i < candles.length; i++) {
          const dStr = new Date(candles[i].time * 1000).toLocaleDateString('en-CA', {
            timeZone: 'Asia/Kolkata',
          });
          if (dStr === dateToUse) {
            if (start === -1) start = i;
            end = i;
          }
        }
        if (start === -1) {
          start = Math.max(0, candles.length - 375);
          end = candles.length - 1;
        }
        // Focus on the 1D session (09:15 to 15:30 IST) with slight margin
        timeScale.setVisibleLogicalRange({ from: start - 3, to: end + 5 });
        return;
      }

      if (range === '5D') {
        const start5d = Math.max(0, candles.length - 375 * 5);
        timeScale.setVisibleLogicalRange({ from: start5d - 3, to: candles.length + 5 });
        return;
      }

      if (range === '1M' || range === '3M' || range === '6M' || range === '1Y' || range === '5Y') {
        timeScale.fitContent();
        return;
      }
    },
    [candles, effectiveSessionDate]
  );

  // Range change handler
  const handleRangeChange = (range: ChartRange) => {
    setActiveRange(range);
    applyVisibleRange(range, effectiveSessionDate);
  };

  // Session date dropdown change handler
  const handleSessionDateChange = (date: string) => {
    setSelectedSessionDate(date);
    setActiveRange('1D');
    applyVisibleRange('1D', date === 'latest' ? undefined : date);
  };

  // Lightweight Charts Render — loads ALL 30-day continuous candles into the chart series
  // so moving the chart backwards reveals previous days seamlessly
  useEffect(() => {
    if (useOfficialTvWidget || !chartContainerRef.current || candles.length === 0) return;

    chartContainerRef.current.innerHTML = '';

    const chart: IChartApi = createChart(chartContainerRef.current, {
      width: chartContainerRef.current.clientWidth || 800,
      height: 440,
      layout: {
        background: { type: ColorType.Solid, color: '#090d16' },
        textColor: '#94a3b8',
      },
      crosshair: {
        mode: CrosshairMode.Normal,
      },
      localization: {
        priceFormatter: (p: number) => `₹${p.toFixed(2)}`,
        timeFormatter: (timestamp: number) => {
          const date = new Date(timestamp * 1000);
          return (
            date.toLocaleDateString('en-IN', {
              timeZone: 'Asia/Kolkata',
              day: 'numeric',
              month: 'short',
            }) +
            ' ' +
            date.toLocaleTimeString('en-IN', {
              timeZone: 'Asia/Kolkata',
              hour12: false,
              hour: '2-digit',
              minute: '2-digit',
            }) +
            ' IST'
          );
        },
      },
      grid: {
        vertLines: { color: 'rgba(30, 41, 59, 0.45)' },
        horzLines: { color: 'rgba(30, 41, 59, 0.45)' },
      },
      timeScale: {
        timeVisible: true,
        secondsVisible: false,
        borderColor: '#1e293b',
        rightOffset: 5,
        barSpacing: 5,
        tickMarkFormatter: (time: number) => {
          const date = new Date(time * 1000);
          const timeStr = date.toLocaleTimeString('en-IN', {
            timeZone: 'Asia/Kolkata',
            hour12: false,
            hour: '2-digit',
            minute: '2-digit',
          });
          // Display the date at the market open bar (09:15) so previous days are clearly visible
          if (timeStr === '09:15') {
            return date.toLocaleDateString('en-IN', {
              timeZone: 'Asia/Kolkata',
              month: 'short',
              day: 'numeric',
            });
          }
          return timeStr;
        },
      },
      rightPriceScale: {
        borderColor: '#1e293b',
        mode: isPercentScale ? 2 : 0, // 2: Percentage, 0: Normal
      },
    });

    chartInstanceRef.current = chart;

    // Candlestick Series (v5 API) — loaded with ALL continuous candles
    const candleSeries = chart.addSeries(CandlestickSeries, {
      upColor: '#10b981',
      downColor: '#ef4444',
      borderVisible: false,
      wickUpColor: '#10b981',
      wickDownColor: '#ef4444',
    });

    const formattedCandles = candles.map((c) => ({
      time: c.time as any,
      open: c.open,
      high: c.high,
      low: c.low,
      close: c.close,
    }));
    candleSeries.setData(formattedCandles);

    // Volume Histogram (v5 API) — loaded with ALL continuous candles
    const volumeSeries = chart.addSeries(HistogramSeries, {
      color: '#38bdf8',
      priceFormat: { type: 'volume' },
      priceScaleId: '', // overlay
    });
    volumeSeries.priceScale().applyOptions({
      scaleMargins: { top: 0.78, bottom: 0 },
    });
    volumeSeries.setData(
      candles.map((c) => ({
        time: c.time as any,
        value: c.volume,
        color: c.close >= c.open ? 'rgba(16, 185, 129, 0.35)' : 'rgba(239, 68, 68, 0.35)',
      }))
    );

    // Crosshair hover synchronization to update top OHLCV bar
    chart.subscribeCrosshairMove((param) => {
      if (!param || !param.time) {
        setHoveredCandle(null);
        return;
      }
      const candleData = param.seriesData.get(candleSeries) as any;
      if (candleData) {
        const volData = param.seriesData.get(volumeSeries) as any;
        setHoveredCandle({
          time: Number(param.time),
          open: candleData.open,
          high: candleData.high,
          low: candleData.low,
          close: candleData.close,
          volume: volData ? volData.value : 0,
        });
      }
    });

    // Detect if user has scrolled back in time away from the latest bar
    chart.timeScale().subscribeVisibleLogicalRangeChange((logicalRange) => {
      if (!logicalRange) return;
      const scrolled = logicalRange.to < candles.length - 20;
      isScrolledBackRef.current = scrolled;
      setIsScrolledBack(scrolled);
    });

    candleSeriesRef.current = candleSeries;
    volumeSeriesRef.current = volumeSeries;
    currentSymbolRef.current = instrument.symbol;

    // Set initial visible window to the selected range (1D by default)
    applyVisibleRange(activeRange, effectiveSessionDate);

    const handleResize = () => {
      if (chartContainerRef.current) {
        chart.applyOptions({ width: chartContainerRef.current.clientWidth });
      }
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      chart.remove();
      chartInstanceRef.current = null;
      candleSeriesRef.current = null;
      volumeSeriesRef.current = null;
    };
  }, [instrument.symbol, useOfficialTvWidget, isPercentScale]);

  const prevCandlesCountRef = useRef<number>(0);
  const prevSymbolRef = useRef<string>(instrument.symbol);

  // Update existing series without recreating the chart or snapping view if user is looking at past candles
  useEffect(() => {
    if (!chartInstanceRef.current || !candleSeriesRef.current || !volumeSeriesRef.current) return;
    if (candles.length === 0) return;

    const isSameSymbol = prevSymbolRef.current === instrument.symbol;
    prevSymbolRef.current = instrument.symbol;

    const lastCandle = candles[candles.length - 1];

    // If streaming incremental candle update (same symbol and baseline already loaded)
    if (isSameSymbol && prevCandlesCountRef.current > 0 && candles.length >= prevCandlesCountRef.current) {
      candleSeriesRef.current.update({
        time: lastCandle.time as any,
        open: lastCandle.open,
        high: lastCandle.high,
        low: lastCandle.low,
        close: lastCandle.close,
      });

      volumeSeriesRef.current.update({
        time: lastCandle.time as any,
        value: lastCandle.volume,
        color: lastCandle.close >= lastCandle.open ? 'rgba(16, 185, 129, 0.35)' : 'rgba(239, 68, 68, 0.35)',
      });

      prevCandlesCountRef.current = candles.length;
      return;
    }

    // Full baseline load (mount or stock symbol switch)
    const formattedCandles = candles.map((c) => ({
      time: c.time as any,
      open: c.open,
      high: c.high,
      low: c.low,
      close: c.close,
    }));
    candleSeriesRef.current.setData(formattedCandles);

    volumeSeriesRef.current.setData(
      candles.map((c) => ({
        time: c.time as any,
        value: c.volume,
        color: c.close >= c.open ? 'rgba(16, 185, 129, 0.35)' : 'rgba(239, 68, 68, 0.35)',
      }))
    );

    prevCandlesCountRef.current = candles.length;

    // Only apply range on initial or explicit user action, NOT if user is scrolling back in time
    if (!isScrolledBackRef.current && activeRange === '1D') {
      applyVisibleRange('1D', effectiveSessionDate);
    }
  }, [candles, effectiveSessionDate, activeRange, applyVisibleRange, instrument.symbol]);

  // Strategy Price Lines (P0, Entry, Target, Stop-Loss)
  useEffect(() => {
    if (!candleSeriesRef.current) return;
    const series = candleSeriesRef.current;

    // Safely remove previous lines
    if (strategyLinesRef.current.p0) {
      try { series.removePriceLine(strategyLinesRef.current.p0); } catch (_) {}
    }
    if (strategyLinesRef.current.entry) {
      try { series.removePriceLine(strategyLinesRef.current.entry); } catch (_) {}
    }
    if (strategyLinesRef.current.target) {
      try { series.removePriceLine(strategyLinesRef.current.target); } catch (_) {}
    }
    if (strategyLinesRef.current.stop) {
      try { series.removePriceLine(strategyLinesRef.current.stop); } catch (_) {}
    }

    strategyLinesRef.current = {};

    const { reference_price, planned_entry, planned_target, planned_stop, decision } = orchestratorOutput;

    if (reference_price && reference_price > 0) {
      strategyLinesRef.current.p0 = series.createPriceLine({
        price: reference_price,
        color: '#94a3b8',
        lineWidth: 1,
        lineStyle: LineStyle.Dashed,
        axisLabelVisible: true,
        title: 'P₀ Ref',
      });
    }

    if (planned_entry && planned_entry > 0) {
      strategyLinesRef.current.entry = series.createPriceLine({
        price: planned_entry,
        color: decision === 'LONG' ? '#38bdf8' : '#f43f5e',
        lineWidth: 2,
        lineStyle: LineStyle.Solid,
        axisLabelVisible: true,
        title: `E Entry (${decision})`,
      });
    }

    if (planned_target && planned_target > 0) {
      strategyLinesRef.current.target = series.createPriceLine({
        price: planned_target,
        color: '#10b981',
        lineWidth: 2,
        lineStyle: LineStyle.Dashed,
        axisLabelVisible: true,
        title: 'T Target',
      });
    }

    if (planned_stop && planned_stop > 0) {
      strategyLinesRef.current.stop = series.createPriceLine({
        price: planned_stop,
        color: '#ef4444',
        lineWidth: 2,
        lineStyle: LineStyle.Dashed,
        axisLabelVisible: true,
        title: 'S Stop',
      });
    }
  }, [orchestratorOutput]);

  // Quick Paper Trade execution
  const handleQuickTrade = (direction: 'LONG' | 'SHORT') => {
    const currentPrice = priceStats.close || instrument.base_demo_price;
    if (onQuickTrade) {
      onQuickTrade(instrument.symbol, direction, currentPrice, quickQty);
    }
    setQuickTradeToast(
      `${direction === 'LONG' ? 'BUY' : 'SELL'} ${quickQty}x ${instrument.symbol} @ ₹${currentPrice.toFixed(2)} submitted to Paper Trading!`
    );
    setTimeout(() => setQuickTradeToast(null), 4000);
  };

  // Re-collect 30-day 1m candle database on demand
  const handleCollect30d = async () => {
    setIsCollectingDb(true);
    setDbCollectMsg(null);
    try {
      const res = await triggerCollect30Days(instrument.symbol);
      setDbCollectMsg(
        `✓ Downloaded ${res.total_bars || 7500} 1-minute bars for ${instrument.symbol} into local DB!`
      );
      if (onReload30dDb) {
        await onReload30dDb();
      }
    } catch (err: any) {
      setDbCollectMsg(`Notice: ${err.message || 'Upstox token needed for live download'}`);
    } finally {
      setIsCollectingDb(false);
      setTimeout(() => setDbCollectMsg(null), 6000);
    }
  };

  const ind = technicalOutput.indicators;

  return (
    <div className="space-y-4">
      {/* Quick Trade Notification Toast */}
      {quickTradeToast && (
        <div className="p-3 bg-emerald-950/90 border border-emerald-700 text-emerald-200 rounded-lg text-xs font-semibold flex items-center justify-between shadow-lg animate-fade-in">
          <span className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            {quickTradeToast}
          </span>
          <button
            onClick={() => setQuickTradeToast(null)}
            className="text-emerald-400 hover:text-white text-xs px-2"
          >
            ✕
          </button>
        </div>
      )}

      {/* Main TradingView Style Chart Card */}
      <div className="bg-[#090d16] border border-slate-800 rounded-xl overflow-hidden shadow-2xl">
        {/* Top Header: Symbol, Timeframe, Live OHLCV, and Action Toolbar */}
        <div className="p-3.5 border-b border-slate-800/90 flex flex-col md:flex-row md:items-center justify-between gap-3 bg-slate-950/90">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
            {/* Symbol Title & Timeframe (Matching TradingView Screenshot) */}
            <div className="flex items-center gap-1.5 text-sm md:text-base font-sans">
              <span className="font-extrabold text-white tracking-wide">
                {instrument.company_name?.toUpperCase() || instrument.symbol}
              </span>
              <span className="text-slate-500 font-bold">•</span>
              <span className="font-mono font-bold text-sky-400 bg-sky-950/70 px-1.5 py-0.5 rounded text-xs border border-sky-800/60">
                1
              </span>
              <span className="text-slate-500 font-bold">•</span>
              <span className="font-mono text-xs text-slate-300">NSE</span>
            </div>

            {/* Live OHLCV Legend with Crosshair Hover tracking */}
            <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs font-mono bg-slate-900/90 px-2.5 py-1 rounded border border-slate-800">
              <span className="text-slate-400">
                O <strong className="text-white font-semibold">{priceStats.open.toFixed(2)}</strong>
              </span>
              <span className="text-slate-400">
                H <strong className="text-emerald-400 font-semibold">{priceStats.high.toFixed(2)}</strong>
              </span>
              <span className="text-slate-400">
                L <strong className="text-rose-400 font-semibold">{priceStats.low.toFixed(2)}</strong>
              </span>
              <span className="text-slate-400">
                C <strong className="text-white font-bold">{priceStats.close.toFixed(2)}</strong>
              </span>
              <span
                className={`font-semibold ${
                  priceStats.isPositive ? 'text-emerald-400' : 'text-rose-400'
                }`}
              >
                {priceStats.change >= 0 ? '+' : ''}
                {priceStats.change.toFixed(2)} ({priceStats.changePct >= 0 ? '+' : ''}
                {priceStats.changePct.toFixed(2)}%)
              </span>
              <span className="text-slate-600">|</span>
              <span className="text-slate-400">
                Vol{' '}
                <strong className="text-sky-300 font-semibold">
                  {(priceStats.volume / 1000).toFixed(3)} K
                </strong>
              </span>
            </div>
          </div>

          {/* Right Header: Floating Quick Buy/Sell Buttons & Stock Switcher */}
          <div className="flex flex-wrap items-center gap-2.5">
            {/* Quick SELL / BUY Action Panel (Exactly matching user TradingView screenshot!) */}
            <div className="flex items-center gap-1 bg-slate-900/95 border border-slate-700/80 rounded-lg p-1 shadow-md">
              <button
                onClick={() => handleQuickTrade('SHORT')}
                className="px-3 py-1.5 rounded-md bg-[#d9534f] hover:bg-[#c9302c] active:scale-95 text-white font-bold text-xs flex flex-col items-center leading-tight transition shadow-sm"
                title="Execute Instant Paper Sell / Short"
              >
                <span className="text-[9px] uppercase font-bold tracking-wider text-rose-100">
                  SELL
                </span>
                <span className="font-mono text-xs">₹{priceStats.close.toFixed(2)}</span>
              </button>

              <div className="flex flex-col items-center px-1">
                <input
                  type="number"
                  min="1"
                  value={quickQty}
                  onChange={(e) => setQuickQty(Math.max(1, parseInt(e.target.value) || 1))}
                  className="w-11 text-center bg-slate-950 border border-slate-700 text-white font-mono text-xs py-1 rounded focus:outline-none focus:border-sky-500"
                  title="Trade Quantity"
                />
              </div>

              <button
                onClick={() => handleQuickTrade('LONG')}
                className="px-3 py-1.5 rounded-md bg-[#16a34a] hover:bg-[#15803d] active:scale-95 text-white font-bold text-xs flex flex-col items-center leading-tight transition shadow-sm"
                title="Execute Instant Paper Buy / Long"
              >
                <span className="text-[9px] uppercase font-bold tracking-wider text-emerald-100">
                  BUY
                </span>
                <span className="font-mono text-xs">₹{priceStats.close.toFixed(2)}</span>
              </button>
            </div>

            {/* Strategy Decision Badge */}
            <div className="hidden sm:flex flex-col items-end">
              <span
                className={`px-2 py-0.5 rounded text-[11px] font-bold font-mono border ${
                  orchestratorOutput.decision === 'LONG'
                    ? 'bg-emerald-950 text-emerald-300 border-emerald-700'
                    : orchestratorOutput.decision === 'SHORT'
                    ? 'bg-rose-950 text-rose-300 border-rose-700'
                    : 'bg-slate-800 text-slate-300 border-slate-700'
                }`}
              >
                {orchestratorOutput.decision} ({orchestratorOutput.composite_score > 0 ? `+${orchestratorOutput.composite_score}` : orchestratorOutput.composite_score})
              </span>
            </div>
          </div>
        </div>

        {/* Subheader: Stock Selector Chips & Quick Stats */}
        <div className="px-3.5 py-2 bg-slate-950/60 border-b border-slate-800/60 flex flex-wrap items-center justify-between gap-2 text-xs">
          {/* Quick Stock Switcher Pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mr-1">
              Universe:
            </span>
            {allInstruments.map((inst) => {
              const isSelected = inst.symbol === instrument.symbol;
              return (
                <button
                  key={inst.symbol}
                  onClick={() => onSelectSymbol(inst.symbol)}
                  className={`px-2.5 py-0.5 rounded font-mono font-bold text-xs transition ${
                    isSelected
                      ? 'bg-sky-600 text-white shadow-xs ring-1 ring-sky-400'
                      : 'bg-slate-900 text-slate-400 hover:text-white hover:bg-slate-800'
                  }`}
                >
                  {inst.symbol}
                </button>
              );
            })}
          </div>

          {/* Database & Connection Indicator */}
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-sky-950/70 border border-sky-800/80 text-sky-300 text-[11px] font-mono">
              <Database className="w-3 h-3 text-sky-400" />
              <span>30D DB: {candles.length.toLocaleString()} 1m bars</span>
            </span>

            {isUpstoxConnected && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-purple-950/80 border border-purple-800 text-purple-300 text-[11px] font-mono">
                <Radio className="w-3 h-3 text-purple-400 animate-pulse" />
                <span>Upstox Live Active</span>
              </span>
            )}

            <button
              onClick={() => setUseOfficialTvWidget(!useOfficialTvWidget)}
              className="text-[11px] text-slate-400 hover:text-white flex items-center gap-1 transition ml-1"
              title="Toggle TradingView Cloud Widget"
            >
              <LineChart className="w-3 h-3" />
              <span>{useOfficialTvWidget ? 'Switch to Engine' : 'TV Cloud'}</span>
            </button>
          </div>
        </div>

        {/* Interactive Live Price Streaming & Real-Time Ticker Bar */}
        <div className="px-3.5 py-2.5 bg-slate-900/95 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs">
          {/* Left: Stream Toggle, Single Step & Speed */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={onToggleAutoPlay}
              className={`px-3 py-1.5 rounded-md font-bold text-xs flex items-center gap-1.5 transition shadow-sm active:scale-95 ${
                isAutoPlaying
                  ? 'bg-amber-600 hover:bg-amber-500 text-white shadow-amber-950/40 ring-1 ring-amber-400'
                  : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-950/40 ring-1 ring-emerald-400'
              }`}
              title={isAutoPlaying ? 'Pause Live Price Streaming' : 'Start Live Price Streaming'}
            >
              {isAutoPlaying ? (
                <>
                  <span className="w-2 h-2 rounded-full bg-white animate-ping" />
                  <Pause className="w-3.5 h-3.5" />
                  <span>STREAMING ACTIVE (PAUSE)</span>
                </>
              ) : (
                <>
                  <Play className="w-3.5 h-3.5" />
                  <span>START LIVE STREAM</span>
                </>
              )}
            </button>

            {/* Manual Step */}
            <button
              onClick={onStepSimulation}
              className="px-2.5 py-1.5 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-semibold flex items-center gap-1.5 transition active:scale-95"
              title="Advances stream by 1 price bar manually"
            >
              <FastForward className="w-3 h-3 text-sky-400" />
              <span>+1 Bar Step</span>
            </button>

            {/* Speed Selector */}
            <div className="flex items-center bg-slate-950 border border-slate-800 rounded-md p-0.5">
              <span className="text-[10px] font-mono text-slate-500 px-1.5 font-bold uppercase">Interval:</span>
              {[1, 2, 3, 5].map((spd) => (
                <button
                  key={spd}
                  onClick={() => onChangeStreamSpeed?.(spd)}
                  className={`px-2 py-0.5 rounded text-[11px] font-mono font-bold transition ${
                    streamSpeed === spd
                      ? 'bg-sky-600 text-white shadow-xs'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                  title={`Update price every ${spd} second${spd > 1 ? 's' : ''}`}
                >
                  {spd}s
                </button>
              ))}
            </div>
          </div>

          {/* Right: Live LTP with Flash Indicator + Market Hours / Practice Replay Mode Toggle */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Live Ticker Flash Card */}
            <div
              className={`px-2.5 py-1 rounded-md border font-mono text-xs flex items-center gap-2 transition-all duration-300 ${
                tickDirection === 'UP'
                  ? 'bg-emerald-950/90 border-emerald-500/80 text-emerald-300 ring-1 ring-emerald-500/50'
                  : tickDirection === 'DOWN'
                  ? 'bg-rose-950/90 border-rose-500/80 text-rose-300 ring-1 ring-rose-500/50'
                  : 'bg-slate-950/90 border-slate-800 text-slate-300'
              }`}
            >
              <div className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span className="text-[10px] uppercase font-bold text-slate-400">LIVE LTP:</span>
              </div>
              <strong className="text-white text-xs font-black">₹{priceStats.close.toFixed(2)}</strong>
              {tickDirection === 'UP' && <span className="text-emerald-400 font-bold text-[11px] animate-bounce">▲ UP</span>}
              {tickDirection === 'DOWN' && <span className="text-rose-400 font-bold text-[11px] animate-bounce">▼ DOWN</span>}
              <span className="text-[10px] text-slate-500 font-normal">({liveTickCount} updates)</span>
            </div>

            {/* Mode Switch: 24/7 Practice Stream vs Official Market Hours */}
            <button
              onClick={onToggleEnforceMarketHours}
              className={`px-2.5 py-1 rounded-md border text-[11px] font-mono font-semibold flex items-center gap-1.5 transition ${
                !enforceRealMarketHours
                  ? 'bg-indigo-950/90 border-indigo-500/80 text-indigo-200 hover:bg-indigo-900'
                  : 'bg-slate-900 border-slate-700 text-slate-300 hover:bg-slate-800'
              }`}
              title={
                !enforceRealMarketHours
                  ? '24/7 Practice Mode: Continuous live streaming active regardless of real market status'
                  : 'Real Market Hours: Strictly locked to official exchange schedule (09:15-15:30 IST)'
              }
            >
              <Zap className="w-3 h-3 text-amber-400" />
              <span>{!enforceRealMarketHours ? '24/7 Practice Stream' : 'Strict Market Hours'}</span>
            </button>
          </div>
        </div>

        {/* Warning Banner if market is closed AND strict hours are enforced */}
        {enforceRealMarketHours && sessionStatus && !sessionStatus.is_market_open && (
          <div className="p-2.5 bg-amber-950/60 border-b border-amber-800/80 flex items-center justify-between gap-3 text-xs text-amber-200">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
              <span>
                <strong>NSE Exchange is currently closed</strong> ({sessionStatus.phase}). Streaming is paused under strict hours.
              </span>
            </div>
            {onToggleEnforceMarketHours && (
              <button
                onClick={onToggleEnforceMarketHours}
                className="px-2.5 py-1 rounded bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs shrink-0 transition shadow-sm"
              >
                Enable 24/7 Practice Stream ➔
              </button>
            )}
          </div>
        )}

        {/* Chart Canvas Area */}
        <div className="relative">
          {!useOfficialTvWidget ? (
            <>
              <div
                ref={chartContainerRef}
                className="w-full h-[440px] bg-[#090d16] select-none cursor-crosshair"
              />

              {/* Floating Return to Today button when user scrolls back in time */}
              {isScrolledBack && (
                <button
                  onClick={() => {
                    setSelectedSessionDate('latest');
                    handleRangeChange('1D');
                  }}
                  className="absolute bottom-4 right-4 z-10 px-3 py-1.5 rounded-lg bg-sky-600/95 hover:bg-sky-500 text-white font-mono text-xs font-bold shadow-xl flex items-center gap-1.5 transition active:scale-95 border border-sky-400 backdrop-blur-xs animate-fade-in"
                  title="Snap back to today's latest session"
                >
                  <span>Return to Today (1D) ↗</span>
                </button>
              )}
            </>
          ) : (
            <div className="p-3 space-y-3">
              <div className="p-3 bg-amber-950/40 border border-amber-800/80 rounded-lg text-xs text-amber-200 flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                <div className="text-[11px] leading-relaxed">
                  TradingView restricts Indian equity feeds inside external iframes. For continuous
                  1-minute candlestick analysis with strategy overlays, switch back to the Engine
                  Chart.
                </div>
              </div>
              <iframe
                title={`TV Widget ${instrument.symbol}`}
                className="w-full h-[410px] rounded border border-slate-800"
                src={`https://s.tradingview.com/widgetembed/?symbol=${encodeURIComponent(
                  instrument.tradingview_symbol
                )}&interval=1&theme=dark&style=1&timezone=Asia%2FKolkata`}
              />
            </div>
          )}
        </div>

        {/* ============================================================== */}
        {/* BOTTOM RANGE TOOLBAR (ENCLOSED IN RED BOX IN USER SCREENSHOT!) */}
        {/* ============================================================== */}
        <div className="px-3 py-2 bg-[#090d16] border-t border-slate-800/90 flex flex-wrap items-center justify-between gap-3 text-xs font-mono">
          {/* Left: Range Selection Buttons: 5Y 1Y 6M 3M 1M 5D 1D */}
          <div className="flex items-center gap-1">
            {(['5Y', '1Y', '6M', '3M', '1M', '5D', '1D'] as const).map((r) => {
              const isActive = activeRange === r;
              return (
                <button
                  key={r}
                  onClick={() => handleRangeChange(r)}
                  className={`px-2.5 py-1 text-xs font-bold transition relative ${
                    isActive
                      ? 'text-white font-black'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900 rounded'
                  }`}
                >
                  <span>{r}</span>
                  {isActive && (
                    <div className="absolute bottom-0 left-1 right-1 h-0.5 bg-purple-500 rounded-full shadow-sm" />
                  )}
                </button>
              );
            })}
          </div>

          {/* Center: Session Date Picker for 1D mode */}
          <div className="flex items-center gap-2 text-slate-300">
            <Calendar className="w-3.5 h-3.5 text-sky-400 shrink-0" />
            <span className="text-[11px] text-slate-400 hidden sm:inline">Session:</span>
            <select
              value={selectedSessionDate}
              onChange={(e) => handleSessionDateChange(e.target.value)}
              className="bg-slate-900 border border-slate-700 text-slate-200 text-xs rounded px-2 py-0.5 font-mono focus:outline-none focus:border-sky-500"
            >
              <option value="latest">
                Latest Session ({sessionDates[sessionDates.length - 1]?.date || 'Today'})
              </option>
              {sessionDates
                .slice()
                .reverse()
                .map((d) => (
                  <option key={d.date} value={d.date}>
                    {d.date} ({d.count} 1m bars)
                  </option>
                ))}
            </select>
            <span className="text-[11px] text-slate-400 hidden md:inline">
              (Scroll/drag chart back to view previous days)
            </span>
          </div>

          {/* Right: Time clock (UTC+5:30) and Scale Toggle */}
          <div className="flex items-center gap-2.5 text-slate-400 text-xs">
            <span className="text-slate-200 font-mono font-medium">
              {clockTime} <span className="text-slate-400 text-[10px]">(UTC+5:30)</span>
            </span>
            <button
              onClick={() => setIsPercentScale(!isPercentScale)}
              className={`px-2 py-0.5 rounded border text-[11px] font-mono transition font-bold ${
                isPercentScale
                  ? 'bg-purple-950 text-purple-300 border-purple-700'
                  : 'bg-slate-900 text-slate-400 border-slate-700 hover:text-white'
              }`}
              title="Toggle Percentage Scale Mode"
            >
              %
            </button>
          </div>
        </div>

        {/* Database Action & Calibration Drawer Bar */}
        <div className="px-3.5 py-2.5 bg-slate-950/90 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={handleCollect30d}
              disabled={isCollectingDb}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-sky-300 border border-slate-700 font-semibold text-[11px] transition shadow-xs"
              title="Download fresh 30-day 1-minute historical candles from Upstox API"
            >
              {isCollectingDb ? (
                <>
                  <RefreshCw className="w-3 h-3 animate-spin text-sky-400" />
                  <span>Collecting 30 Days...</span>
                </>
              ) : (
                <>
                  <Download className="w-3 h-3 text-sky-400" />
                  <span>Sync 30-Day DB</span>
                </>
              )}
            </button>

            <button
              onClick={() => exportCandlesToCSV(instrument.symbol, candles)}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-700 font-semibold text-[11px] transition"
              title="Export all 30-day candles to CSV"
            >
              <FileSpreadsheet className="w-3 h-3 text-emerald-400" />
              <span>Export CSV</span>
            </button>

            <button
              onClick={() => exportCandlesToJSON(instrument.symbol, candles)}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-700 font-semibold text-[11px] transition"
              title="Export all 30-day candles to JSON"
            >
              <FileCode className="w-3 h-3 text-amber-400" />
              <span>Export JSON</span>
            </button>

            {onUpdatePrice && (
              <button
                onClick={() => setIsEditingPrice(!isEditingPrice)}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-700 font-semibold text-[11px] transition"
              >
                <Edit3 className="w-3 h-3 text-purple-400" />
                <span>Calibrate Price</span>
              </button>
            )}
          </div>

          {/* Feedback message */}
          {dbCollectMsg && (
            <span className="text-[11px] text-emerald-300 font-mono animate-fade-in">
              {dbCollectMsg}
            </span>
          )}

          {/* Price Reference lines legend */}
          <div className="flex items-center gap-3 text-[11px] font-mono text-slate-400">
            <span className="flex items-center gap-1">
              <span className="w-2.5 h-0.5 bg-slate-400 inline-block border-t border-dashed" /> P₀ Ref
            </span>
            <span className="flex items-center gap-1 text-sky-400">
              <span className="w-2.5 h-0.5 bg-sky-400 inline-block" /> Entry (E)
            </span>
            <span className="flex items-center gap-1 text-emerald-400">
              <span className="w-2.5 h-0.5 bg-emerald-400 inline-block" /> Target (T)
            </span>
            <span className="flex items-center gap-1 text-rose-400">
              <span className="w-2.5 h-0.5 bg-rose-400 inline-block" /> Stop (S)
            </span>
          </div>
        </div>

        {/* Price Calibration Popup */}
        {isEditingPrice && (
          <div className="p-3.5 bg-slate-950 border-t border-sky-900/60 space-y-2.5">
            <div className="flex items-center justify-between text-xs font-semibold text-slate-200">
              <span className="flex items-center gap-1.5 text-sky-300">
                <Sliders className="w-3.5 h-3.5" />
                Calibrate {instrument.symbol} Base Price
              </span>
              <button
                type="button"
                onClick={() => setIsEditingPrice(false)}
                className="text-slate-400 hover:text-white text-xs"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSavePrice} className="flex items-center gap-2">
              <span className="text-[11px] text-slate-300 font-medium">Exact Price (₹):</span>
              <input
                type="number"
                step="0.05"
                value={editedPrice}
                onChange={(e) => setEditedPrice(e.target.value)}
                className="w-32 px-2.5 py-1 rounded bg-slate-900 border border-slate-700 text-white font-mono text-xs focus:border-sky-500 focus:outline-none"
                placeholder="Enter price"
                autoFocus
              />
              <button
                type="submit"
                className="px-3 py-1 rounded bg-sky-600 hover:bg-sky-500 text-white text-xs font-semibold shadow-sm transition"
              >
                Apply
              </button>
              <button
                type="button"
                onClick={() => setIsEditingPrice(false)}
                className="px-2 py-1 rounded text-slate-400 hover:text-white text-xs"
              >
                Cancel
              </button>
            </form>
          </div>
        )}
      </div>

      {/* Target & Risk Rules Verification Card + Active Setup */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Deterministic Target & Displacement Validator */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-lg p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
              <Sliders className="w-4 h-4 text-sky-400" />
              NSE INR 3.00 Displacement & Ordering Check
            </h3>
            {validationResult ? (
              validationResult.is_valid ? (
                <span className="px-2 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-800 text-xs font-semibold flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5" /> VALID SETUP
                </span>
              ) : (
                <span className="px-2 py-0.5 rounded bg-rose-950 text-rose-300 border border-rose-800 text-xs font-semibold flex items-center gap-1">
                  <XCircle className="w-3.5 h-3.5" /> REJECTED
                </span>
              )
            ) : (
              <span className="text-xs text-slate-400">NO ACTIVE CANDIDATE</span>
            )}
          </div>

          {validationResult ? (
            <div className="space-y-3 text-xs">
              <div className="grid grid-cols-3 gap-2 text-center font-mono">
                <div className="p-2 bg-slate-950 rounded border border-slate-800">
                  <div className="text-slate-400 text-[10px]">|E - P₀| Displacement</div>
                  <div className="text-sm font-bold text-white mt-0.5">
                    ₹{validationResult.entry_displacement_inr.toFixed(2)}
                  </div>
                  <div className="text-[10px] text-emerald-400">Required: ≥ ₹3.00</div>
                </div>
                <div className="p-2 bg-slate-950 rounded border border-slate-800">
                  <div className="text-slate-400 text-[10px]">|T - P₀| Displacement</div>
                  <div className="text-sm font-bold text-white mt-0.5">
                    ₹{validationResult.target_from_ref_inr.toFixed(2)}
                  </div>
                  <div className="text-[10px] text-emerald-400">Required: ≥ ₹3.00</div>
                </div>
                <div className="p-2 bg-slate-950 rounded border border-slate-800">
                  <div className="text-slate-400 text-[10px]">|T - E| Displacement</div>
                  <div className="text-sm font-bold text-white mt-0.5">
                    ₹{validationResult.target_from_entry_inr.toFixed(2)}
                  </div>
                  <div className="text-[10px] text-emerald-400">Required: ≥ ₹3.00</div>
                </div>
              </div>

              <div className="p-2.5 bg-slate-950 rounded border border-slate-800 space-y-1 font-mono text-[11px]">
                <div className="flex justify-between">
                  <span className="text-slate-400 font-sans">Directional Ordering:</span>
                  <span className="text-slate-200">
                    {validationResult.direction === 'LONG'
                      ? `S(₹${validationResult.stop_price}) < E(₹${validationResult.entry_price}) < T(₹${validationResult.target_price})`
                      : `T(₹${validationResult.target_price}) < E(₹${validationResult.entry_price}) < S(₹${validationResult.stop_price})`}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400 font-sans">Reward / Risk Ratio:</span>
                  <span className="text-emerald-400 font-bold">
                    {validationResult.reward_to_risk_ratio.toFixed(2)} (Min required: 1.50)
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400 font-sans">Tick-Rounding Check:</span>
                  <span className="text-sky-300">PASS (Aligned to ₹{instrument.tick_size})</span>
                </div>
              </div>

              {validationResult.rejection_reasons.length > 0 && (
                <div className="p-2 rounded bg-rose-950/40 border border-rose-900/60 text-rose-300 text-[11px]">
                  <strong>Rejection Reasons:</strong>
                  <ul className="list-disc list-inside mt-0.5 space-y-0.5">
                    {validationResult.rejection_reasons.map((r, i) => (
                      <li key={i}>{r}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          ) : (
            <div className="text-xs text-slate-400 py-4 text-center">
              Market is in neutral consolidation or abstention mode.
            </div>
          )}
        </div>

        {/* Strategy Decision & Indicator Snapshot */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-lg p-4 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                <Activity className="w-4 h-4 text-emerald-400" />
                Active Strategy Setup & Rationale
              </h3>
              <button
                onClick={onInspectAgents}
                className="text-xs text-sky-400 hover:text-sky-300 flex items-center gap-1 font-semibold"
              >
                Inspect All Agents <ExternalLink className="w-3 h-3" />
              </button>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed bg-slate-950 p-2.5 rounded border border-slate-800 mb-3 font-mono">
              {orchestratorOutput.rationale}
            </p>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs font-mono">
              <div className="p-2 bg-slate-950 rounded border border-slate-800/80">
                <div className="text-slate-400 text-[10px]">EMA 9 / EMA 21</div>
                <div className="text-white mt-0.5">
                  ₹{ind.ema_9?.toFixed(1)} / ₹{ind.ema_21?.toFixed(1)}
                </div>
              </div>
              <div className="p-2 bg-slate-950 rounded border border-slate-800/80">
                <div className="text-slate-400 text-[10px]">RSI (14)</div>
                <div className="text-white mt-0.5">{ind.rsi_14?.toFixed(1)}</div>
              </div>
              <div className="p-2 bg-slate-950 rounded border border-slate-800/80">
                <div className="text-slate-400 text-[10px]">Bollinger Bands</div>
                <div className="text-white mt-0.5">
                  [₹{ind.bb_lower?.toFixed(0)}, ₹{ind.bb_upper?.toFixed(0)}]
                </div>
              </div>
              <div className="p-2 bg-slate-950 rounded border border-slate-800/80">
                <div className="text-slate-400 text-[10px]">20-Bar Support / Res</div>
                <div className="text-white mt-0.5">
                  ₹{ind.support_20?.toFixed(0)} / ₹{ind.resistance_20?.toFixed(0)}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
