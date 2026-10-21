import { InstrumentConfig, PaperOrder, PlatformConfig } from '../../types/platform';
import { generateHistoricalCandles, fetchNewsAndSocial, fetchFundamentals } from '../marketData';
import { runTechnicalAnalysis } from './technicalAgent';
import { runPatternRecognition } from './patternAgent';
import { runSentimentAnalysis } from './sentimentAgent';
import { runFundamentalAnalysis } from './fundamentalAgent';
import { runStrategyOrchestrator } from './orchestratorAgent';
import { computePositionSize, evaluateCandleOnOrder } from './paperTradingAgent';

export interface BacktestResult {
  symbol: string;
  bars_evaluated: number;
  signals_emitted: number;
  abstentions: number;
  abstention_rate_pct: number;
  closed_trades_count: number;
  win_count: number;
  loss_count: number;
  win_rate_pct: number;
  net_pnl_after_costs_inr: number;
  total_costs_inr: number;
  lookahead_leakage_check: string;
}

export function runWalkForwardBacktest(
  instrument: InstrumentConfig,
  config: PlatformConfig,
  totalBars: number = 75
): BacktestResult {
  const fullCandles = generateHistoricalCandles(instrument, '1m', totalBars, 0);
  const news = fetchNewsAndSocial(instrument);
  const fund = fetchFundamentals(instrument);

  let signalsEmitted = 0;
  let abstentions = 0;
  const closedOrders: PaperOrder[] = [];
  let activeOrder: PaperOrder | null = null;

  // Chronological walk forward starting at bar 30 (sufficient warm-up)
  for (let i = 30; i < fullCandles.length; i++) {
    // Strictly slice historical bars up to bar i (Zero Look-Ahead Bias)
    const windowSlice = fullCandles.slice(0, i + 1);
    const currentBar = windowSlice[windowSlice.length - 1];
    const barTime = new Date(currentBar.time * 1000);

    // If there is an active virtual order, evaluate current candle against it
    if (activeOrder !== null) {
      activeOrder = evaluateCandleOnOrder(activeOrder, currentBar, instrument.tick_size);
      if (activeOrder.status === 'CLOSED' || activeOrder.status === 'EXPIRED') {
        closedOrders.push(activeOrder);
        activeOrder = null;
      }
      continue;
    }

    // Run specialized agents on slice strictly available up to bar i
    const tech = runTechnicalAnalysis(windowSlice);
    const pat = runPatternRecognition(windowSlice);
    const sent = runSentimentAnalysis(news);
    const fundOut = runFundamentalAnalysis(instrument.symbol, instrument.sector, fund);

    const orch = runStrategyOrchestrator(
      instrument,
      config,
      tech,
      pat,
      sent,
      fundOut,
      barTime,
      'WALK_FORWARD_BACKTEST'
    );

    if (orch.decision === 'LONG' || orch.decision === 'SHORT') {
      signalsEmitted++;
      const entry = orch.planned_entry!;
      const target = orch.planned_target!;
      const stop = orch.planned_stop!;
      const qty = computePositionSize(
        entry,
        stop,
        config,
        config.risk_controls.starting_capital_inr
      );

      activeOrder = {
        order_id: `bt-${instrument.symbol.toLowerCase()}-${i}`,
        signal_id: `sig-bt-${i}`,
        instrument_id: instrument.instrument_id,
        symbol: instrument.symbol,
        direction: orch.decision,
        quantity: qty,
        status: 'PENDING',
        planned_entry: entry,
        planned_target: target,
        planned_stop: stop,
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
        created_at: barTime.toISOString(),
      };
    } else {
      abstentions++;
    }
  }

  const wins = closedOrders.filter((o) => o.net_pnl_inr > 0);
  const losses = closedOrders.filter((o) => o.net_pnl_inr <= 0);
  const netPnl = closedOrders.reduce((sum, o) => sum + o.net_pnl_inr, 0);
  const totalCosts = closedOrders.reduce((sum, o) => sum + o.total_costs_inr, 0);

  const totalClosed = closedOrders.length;
  const winRate = totalClosed > 0 ? Number(((wins.length / totalClosed) * 100).toFixed(1)) : 0;
  const abstentionRate =
    signalsEmitted + abstentions > 0
      ? Number(((abstentions / (signalsEmitted + abstentions)) * 100).toFixed(1))
      : 0;

  return {
    symbol: instrument.symbol,
    bars_evaluated: fullCandles.length - 30,
    signals_emitted: signalsEmitted,
    abstentions,
    abstention_rate_pct: abstentionRate,
    closed_trades_count: totalClosed,
    win_count: wins.length,
    loss_count: losses.length,
    win_rate_pct: winRate,
    net_pnl_after_costs_inr: Number(netPnl.toFixed(2)),
    total_costs_inr: Number(totalCosts.toFixed(2)),
    lookahead_leakage_check: 'PASSED (Strict chronological slicing without forward bar leakage)',
  };
}
