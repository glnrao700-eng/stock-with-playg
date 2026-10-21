import { Candle, PaperOrder, PlatformConfig } from '../../types/platform';
import { roundToTick } from '../targetValidator';
import { diagnoseFailureAndFormulateRule } from '../learningStore';

export function computePositionSize(
  entryPrice: number,
  stopPrice: number,
  config: PlatformConfig,
  availableCapital: number
): number {
  const riskBudget = config.risk_controls.starting_capital_inr * config.risk_controls.risk_per_trade_pct;
  const perShareRisk = Math.abs(entryPrice - stopPrice);
  if (perShareRisk <= 0) return 0;

  const qtyByRisk = Math.floor(riskBudget / perShareRisk);
  const maxNotional = Math.min(config.risk_controls.max_position_value_inr, availableCapital);
  const qtyByCapital = Math.floor(maxNotional / entryPrice);

  return Math.max(1, Math.min(qtyByRisk, qtyByCapital));
}

export function estimateRoundtripCostsINR(
  entryPrice: number,
  exitPrice: number,
  qty: number
): number {
  const turnover = (entryPrice + exitPrice) * qty;
  const brokerage = Math.min(40.0, turnover * 0.0006); // ₹20 flat/leg cap
  const stt = exitPrice * qty * 0.00025; // Intraday equity STT 0.025% on sell side
  const exchangeAndSebi = turnover * 0.000065;
  const gst = 0.18 * (brokerage + exchangeAndSebi);
  const stampDuty = entryPrice * qty * 0.00003;

  const total = brokerage + stt + exchangeAndSebi + gst + stampDuty;
  return Number(total.toFixed(2));
}

export function evaluateCandleOnOrder(
  order: PaperOrder,
  candle: Candle,
  tickSize: number = 0.05
): PaperOrder {
  const updated: PaperOrder = { ...order };
  const candleTime = new Date(candle.time * 1000).toISOString();
  const slippage = tickSize;

  // 1. PENDING order check
  if (updated.status === 'PENDING') {
    if (new Date(candleTime) >= new Date(updated.expiry_time)) {
      updated.status = 'EXPIRED';
      updated.exit_reason = 'SIGNAL_EXPIRED_UNFILLED';
      return updated;
    }

    const triggered =
      (updated.direction === 'LONG' && candle.high >= updated.planned_entry) ||
      (updated.direction === 'SHORT' && candle.low <= updated.planned_entry);

    if (triggered) {
      const fillPrice =
        updated.direction === 'LONG'
          ? updated.planned_entry + slippage
          : updated.planned_entry - slippage;

      updated.status = 'FILLED';
      updated.entry_fill_price = roundToTick(fillPrice, tickSize);
      updated.entry_time = candleTime;

      // Conservative check: if entry bar also breached stop
      const stopHitOnEntry =
        (updated.direction === 'LONG' && candle.low <= updated.planned_stop) ||
        (updated.direction === 'SHORT' && candle.high >= updated.planned_stop);

      if (stopHitOnEntry) {
        return closeOrder(
          updated,
          updated.planned_stop,
          candleTime,
          'SAME_BAR_ENTRY_CONSERVATIVE_STOP',
          tickSize
        );
      }
    }
    return updated;
  }

  // 2. FILLED position management
  if (updated.status === 'FILLED' && updated.entry_fill_price !== null) {
    const entryFill = updated.entry_fill_price;
    const qty = updated.quantity;

    let favorable = 0;
    let adverse = 0;
    let hitStop = false;
    let hitTarget = false;

    if (updated.direction === 'LONG') {
      favorable = (candle.high - entryFill) * qty;
      adverse = (entryFill - candle.low) * qty;
      hitStop = candle.low <= updated.planned_stop;
      hitTarget = candle.high >= updated.planned_target;
    } else {
      favorable = (entryFill - candle.low) * qty;
      adverse = (candle.high - entryFill) * qty;
      hitStop = candle.high >= updated.planned_stop;
      hitTarget = candle.low <= updated.planned_target;
    }

    updated.mfe_inr = Number(Math.max(updated.mfe_inr, favorable).toFixed(2));
    updated.mae_inr = Number(Math.max(updated.mae_inr, adverse).toFixed(2));

    // CRITICAL: Conservative resolution of same-bar stop & target ambiguity
    if (hitStop && hitTarget) {
      return closeOrder(
        updated,
        updated.planned_stop,
        candleTime,
        'AMBIGUOUS_SAME_BAR_CONSERVATIVE_STOP',
        tickSize
      );
    }

    if (hitStop) {
      return closeOrder(updated, updated.planned_stop, candleTime, 'STOP_LOSS_HIT', tickSize);
    }

    if (hitTarget) {
      return closeOrder(updated, updated.planned_target, candleTime, 'TAKE_PROFIT_HIT', tickSize);
    }
  }

  return updated;
}

function closeOrder(
  order: PaperOrder,
  rawExitPrice: number,
  exitTime: string,
  reason: string,
  tickSize: number
): PaperOrder {
  const isStop = reason.includes('STOP');
  const slip = isStop ? tickSize : 0;
  const exitFill =
    order.direction === 'LONG' ? rawExitPrice - slip : rawExitPrice + slip;
  const roundedExit = roundToTick(exitFill, tickSize);

  const entryFill = order.entry_fill_price || order.planned_entry;
  const gross =
    order.direction === 'LONG'
      ? (roundedExit - entryFill) * order.quantity
      : (entryFill - roundedExit) * order.quantity;

  const costs = estimateRoundtripCostsINR(entryFill, roundedExit, order.quantity);
  const net = Number((gross - costs).toFixed(2));
  const isSuccess = reason === 'TAKE_PROFIT_HIT' && net > 0;
  const outcomeStatus = isSuccess ? 'SUCCESS_TARGET_HIT' : 'FAILURE_STOP_HIT';

  const closedOrder: PaperOrder = {
    ...order,
    status: 'CLOSED',
    exit_fill_price: roundedExit,
    exit_time: exitTime,
    exit_reason: reason,
    gross_pnl_inr: Number(gross.toFixed(2)),
    total_costs_inr: costs,
    net_pnl_inr: net,
    outcome_status: outcomeStatus,
  };

  // If trade failed, diagnose failure and formulate learned rule for future reference
  if (!isSuccess) {
    closedOrder.failure_analysis = diagnoseFailureAndFormulateRule(closedOrder);
  }

  return closedOrder;
}
