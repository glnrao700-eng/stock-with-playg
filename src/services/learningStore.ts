import { FailureAnalysis, InstrumentConfig, NextSessionForecast, PaperOrder } from '../types/platform';
import { roundToTick } from './targetValidator';

const STORAGE_KEY_RULES = 'aistudio_self_learning_rules';

// Initial pre-loaded seed learned lessons derived from historical audits
const DEFAULT_LEARNED_RULES: FailureAnalysis[] = [
  {
    failure_id: 'lr-seed-001',
    order_id: 'ord-hist-rel-1',
    symbol: 'RELIANCE',
    prediction_type: 'INTRADAY',
    session_date: '2026-10-16',
    category: 'COUNTER_TREND_REVERSAL',
    root_cause:
      'Breakdown short triggered at ₹1203.00, reached MFE of +₹4.50, but aggressive institutional absorption at session VWAP reversed price back to stop loss ₹1205.50.',
    learned_rule:
      'RULE #L-101: When 30-Day VWAP is rising, tighten trailing stop to Breakeven (+₹0.50 buffer) as soon as MFE crosses 50% of planned target distance.',
    corrective_action:
      'Automate dynamic breakeven trail on counter-trend 30D trades to eliminate profitable trades turning into full stop-outs.',
    metrics_at_failure: 'MFE: +₹4.50 | Planned Target: ₹1195.00 | Net P&L: -₹3.10',
    timestamp: '2026-10-16T14:45:00.000Z',
  },
  {
    failure_id: 'lr-seed-002',
    order_id: 'ord-hist-tcs-1',
    symbol: 'TCS',
    prediction_type: 'NEXT_DAY_OPENING',
    session_date: '2026-10-15',
    category: 'GAP_INVERSION',
    root_cause:
      'Bullish CLV (+0.72) and late-session momentum indicated +₹12.00 opening gap-up, but overnight US tech selloff caused gap-down open of -₹15.50 breaching risk stop.',
    learned_rule:
      'RULE #L-102: Halve overnight position size when IT sector beta to global indices exceeds 1.20 and upcoming earnings dispersion is high.',
    corrective_action:
      'Enforce maximum overnight gap risk budget of 0.5% capital instead of standard 1.0% intraday risk.',
    metrics_at_failure: 'Predicted Gap: +₹12.00 | Actual Open: -₹15.50 | Net Loss: -₹18.20/sh',
    timestamp: '2026-10-15T15:45:00.000Z',
  },
  {
    failure_id: 'lr-seed-003',
    order_id: 'ord-hist-hdfc-1',
    symbol: 'HDFCBANK',
    prediction_type: 'INTRADAY',
    session_date: '2026-10-14',
    category: 'FALSE_BREAKOUT',
    root_cause:
      'Bullish breakout buy stop triggered at ₹715.00 on marginal volume (0.95x baseline); overhead supply at 30D resistance capped upside.',
    learned_rule:
      'RULE #L-103: Require strict volume surge verification (≥1.25x 30D session baseline) when entering within 1.0% of 30-Day macro resistance.',
    corrective_action:
      'Incorporate 30D resistance proximity penalty into orchestrator threshold check.',
    metrics_at_failure: 'Volume Ratio: 0.95x | 30D Resistance: ₹716.50 | Net Loss: -₹2.85',
    timestamp: '2026-10-14T11:20:00.000Z',
  },
  {
    failure_id: 'lr-seed-004',
    order_id: 'ord-hist-infy-1',
    symbol: 'INFY',
    prediction_type: 'INTRADAY',
    session_date: '2026-10-13',
    category: 'SLIPPAGE_OR_COST_DRAG',
    root_cause:
      'Trade closed near breakeven gross P&L (+₹0.80), but statutory Indian brokerage, STT (0.025%), and GST produced net negative trade (-₹1.45).',
    learned_rule:
      'RULE #L-104: Enforce minimum planned target displacement of at least 3.5x roundtrip statutory costs (min ₹4.50 for lower-priced stocks).',
    corrective_action:
      'Reject setups where planned profit target per share is less than 3x the roundtrip statutory cost estimate.',
    metrics_at_failure: 'Gross P&L: +₹0.80 | Total Charges: ₹2.25 | Net P&L: -₹1.45',
    timestamp: '2026-10-13T13:10:00.000Z',
  },
];

// Diagnose failure cause and formulate learned rule for future reference
export function diagnoseFailureAndFormulateRule(order: PaperOrder): FailureAnalysis {
  const isNextDay = order.prediction_type === 'NEXT_DAY_OPENING';
  const mfe = order.mfe_inr;
  const netLoss = Math.abs(order.net_pnl_inr);
  const exitReason = order.exit_reason || 'STOP_LOSS_HIT';

  let category: FailureAnalysis['category'] = 'FALSE_BREAKOUT';
  let rootCause = '';
  let learnedRule = '';
  let correctiveAction = '';

  if (isNextDay) {
    category = 'GAP_INVERSION';
    rootCause = `Next-day opening prediction for ${order.symbol} failed to capture projected gap. Actual market open inverted against Closing Location Value (CLV), triggering opening stop loss.`;
    learnedRule = `RULE #L-${Math.floor(200 + Math.random() * 50)}: On Next-Session gap setups, require positive verified regulatory filing corroboration when CLV is below 0.35.`;
    correctiveAction =
      'Scale down position size by 40% on overnight gap plays when sector momentum is mixed.';
  } else if (exitReason.includes('SAME_BAR')) {
    category = 'SAME_BAR_CHOP';
    rootCause = `High volatility candle expanded across both entry and stop boundaries within the same 1-minute bar. Resolved conservatively as stop loss.`;
    learnedRule = `RULE #L-${Math.floor(200 + Math.random() * 50)}: Filter out breakout entries when candle range exceeds 2.5x 14-period ATR to avoid entering into climactic exhaustion bars.`;
    correctiveAction =
      'Implement maximum single-bar expansion filter: do not enter if trigger candle range > 2.5x ATR.';
  } else if (mfe > netLoss && mfe >= 3.0) {
    category = 'COUNTER_TREND_REVERSAL';
    rootCause = `Trade achieved substantial favorable excursion (+₹${mfe.toFixed(2)}), but failed to reach full planned target before sharp reversal breached stop loss ₹${order.planned_stop.toFixed(2)}.`;
    learnedRule = `RULE #L-${Math.floor(200 + Math.random() * 50)}: Lock in Breakeven (+₹0.10) trailing stop once trade achieves ≥ 60% of target distance or +₹3.50 MFE.`;
    correctiveAction =
      'Activate auto-breakeven ratchet after MFE reaches 1.5x ATR to preserve hard-earned gains.';
  } else if (order.gross_pnl_inr >= -1.0 && order.total_costs_inr > Math.abs(order.gross_pnl_inr)) {
    category = 'SLIPPAGE_OR_COST_DRAG';
    rootCause = `Gross price movement was nearly flat (Gross: ₹${order.gross_pnl_inr.toFixed(2)}), but exchange turnover fees, STT, and brokerage (₹${order.total_costs_inr.toFixed(2)}) dragged result into net negative.`;
    learnedRule = `RULE #L-${Math.floor(200 + Math.random() * 50)}: Require minimum target-to-cost ratio of ≥ 4:1 before qualifying trade for execution.`;
    correctiveAction =
      'Recalibrate minimum target displacement to ₹4.00 on stocks with price < ₹1,000.';
  } else {
    category = 'FALSE_BREAKOUT';
    rootCause = `Price broke past entry ₹${order.planned_entry.toFixed(2)} but immediately failed to attract volume continuation, hitting stop loss ₹${order.planned_stop.toFixed(2)}.`;
    learnedRule = `RULE #L-${Math.floor(200 + Math.random() * 50)}: In sideways 30D markets, wait for 2 consecutive candle closes outside the trigger band before executing breakout orders.`;
    correctiveAction =
      'Add 2-bar persistence confirmation filter in non-trending 30-day market regimes.';
  }

  const analysis: FailureAnalysis = {
    failure_id: `fail-${Date.now().toString(36)}-${Math.random().toString(36).slice(-4)}`,
    order_id: order.order_id,
    symbol: order.symbol,
    prediction_type: order.prediction_type || 'INTRADAY',
    session_date: order.session_date || new Date(order.created_at).toISOString().split('T')[0],
    category,
    root_cause: rootCause,
    learned_rule: learnedRule,
    corrective_action: correctiveAction,
    metrics_at_failure: `Entry: ₹${order.entry_fill_price || order.planned_entry} | Exit: ₹${order.exit_fill_price || order.planned_stop} | Net: ₹${order.net_pnl_inr.toFixed(2)} | MFE: +₹${order.mfe_inr.toFixed(2)}`,
    timestamp: new Date().toISOString(),
  };

  saveLearnedRuleToStorage(analysis);
  return analysis;
}

// Save learned rule to browser storage for future reference
export function saveLearnedRuleToStorage(rule: FailureAnalysis): void {
  try {
    const existing = getAllLearnedRulesFromStorage();
    const updated = [rule, ...existing.filter((r) => r.failure_id !== rule.failure_id)];
    localStorage.setItem(STORAGE_KEY_RULES, JSON.stringify(updated.slice(0, 100)));
  } catch (err) {
    console.warn('Notice: localStorage write skipped', err);
  }
}

// Retrieve all stored learned rules
export function getAllLearnedRulesFromStorage(): FailureAnalysis[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY_RULES);
    if (stored) {
      const parsed = JSON.parse(stored);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
  } catch {
    // fallback
  }
  return DEFAULT_LEARNED_RULES;
}

// Generate rich date-based paper orders across the 30-day database
export function generateSeedDateBasedPaperOrders(
  instruments: InstrumentConfig[],
  forecasts: NextSessionForecast[]
): PaperOrder[] {
  const dates = [
    '2026-10-19',
    '2026-10-16',
    '2026-10-15',
    '2026-10-14',
    '2026-10-13',
    '2026-10-10',
    '2026-10-09',
  ];

  const generatedOrders: PaperOrder[] = [];

  // Seed sample failures with ready learned rules
  const seedFailures = DEFAULT_LEARNED_RULES;

  // 1. INTRADAY PREDICTIONS
  instruments.forEach((inst, instIdx) => {
    dates.slice(0, 5).forEach((d, dIdx) => {
      const base = inst.base_demo_price;
      const isLong = (instIdx + dIdx) % 2 === 0;
      const isSuccess = (instIdx * 3 + dIdx) % 3 !== 0; // ~66% win rate
      const plannedEntry = roundToTick(isLong ? base + 3.5 : base - 3.5, inst.tick_size);
      const plannedTarget = roundToTick(isLong ? plannedEntry + 6.0 : plannedEntry - 6.0, inst.tick_size);
      const plannedStop = roundToTick(isLong ? plannedEntry - 3.5 : plannedEntry + 3.5, inst.tick_size);

      const orderId = `ord-intra-${inst.symbol.toLowerCase()}-${d.replace(/-/g, '')}`;

      const exitFill = isSuccess ? plannedTarget : plannedStop;
      const gross = isSuccess ? (6.0 * 2) : (-3.5 * 2);
      const costs = 3.5;
      const net = gross - costs;

      let failureAnalysis: FailureAnalysis | undefined;
      if (!isSuccess) {
        const matchingSeed = seedFailures.find((f) => f.symbol === inst.symbol);
        if (matchingSeed) {
          failureAnalysis = {
            ...matchingSeed,
            order_id: orderId,
            session_date: d,
          };
        } else {
          failureAnalysis = {
            failure_id: `fail-${orderId}`,
            order_id: orderId,
            symbol: inst.symbol,
            prediction_type: 'INTRADAY',
            session_date: d,
            category: 'FALSE_BREAKOUT',
            root_cause: `Intraday ${isLong ? 'breakout' : 'breakdown'} trigger failed to sustain volume momentum past ₹${plannedEntry.toFixed(2)}, reversing into stop ₹${plannedStop.toFixed(2)}.`,
            learned_rule: `RULE #L-${100 + instIdx * 10 + dIdx}: In sideways 30D markets, require 2-bar close confirmation beyond breakout price before entry.`,
            corrective_action: 'Increase displacement threshold from ₹3.00 to ₹4.00 during low-volatility sessions.',
            metrics_at_failure: `Entry: ₹${plannedEntry} | Stop: ₹${plannedStop} | Net: -₹${Math.abs(net).toFixed(2)}`,
            timestamp: `${d}T13:30:00.000Z`,
          };
        }
      }

      generatedOrders.push({
        order_id: orderId,
        signal_id: `sig-${orderId}`,
        instrument_id: inst.instrument_id,
        symbol: inst.symbol,
        direction: isLong ? 'LONG' : 'SHORT',
        quantity: 2,
        status: 'CLOSED',
        planned_entry: plannedEntry,
        planned_target: plannedTarget,
        planned_stop: plannedStop,
        entry_fill_price: plannedEntry,
        exit_fill_price: exitFill,
        entry_time: `${d}T09:45:00.000Z`,
        exit_time: `${d}T14:15:00.000Z`,
        expiry_time: `${d}T15:15:00.000Z`,
        exit_reason: isSuccess ? 'TAKE_PROFIT_HIT' : 'STOP_LOSS_HIT',
        gross_pnl_inr: gross,
        total_costs_inr: costs,
        net_pnl_inr: net,
        mfe_inr: isSuccess ? 12.0 : 2.5,
        mae_inr: isSuccess ? 1.5 : 7.0,
        created_at: `${d}T09:30:00.000Z`,
        prediction_type: 'INTRADAY',
        session_date: d,
        outcome_status: isSuccess ? 'SUCCESS_TARGET_HIT' : 'FAILURE_STOP_HIT',
        failure_analysis: failureAnalysis,
      });
    });
  });

  // 2. NEXT-DAY STARTING (OPENING GAP) PREDICTIONS
  instruments.forEach((inst, instIdx) => {
    dates.slice(0, 4).forEach((d, dIdx) => {
      const base = inst.base_demo_price;
      const isLong = (instIdx + dIdx) % 2 === 1;
      const isSuccess = (instIdx * 2 + dIdx) % 3 !== 0;
      const refClose = base;
      // Proportional gap (0.35% to 0.65% based on stock volatility)
      const gapMultiplier = 0.004 + (instIdx % 3) * 0.0015;
      const predGap = roundToTick(isLong ? refClose * gapMultiplier : -refClose * gapMultiplier, inst.tick_size);
      const predictedOpen = roundToTick(refClose + predGap, inst.tick_size);

      // In success: actual open gaps in predicted direction with slight variance
      // In failure: actual open gaps in opposite direction (gap inversion) or falls flat
      const actualGap = isSuccess
        ? roundToTick(predGap * (0.92 + ((dIdx % 3) * 0.06)), inst.tick_size)
        : roundToTick(-predGap * 0.85, inst.tick_size);
      const actualOpen = roundToTick(refClose + actualGap, inst.tick_size);

      const gapError = Number(Math.abs(actualOpen - predictedOpen).toFixed(2));
      const predGapPct = Number(((predGap / refClose) * 100).toFixed(2));
      const actualGapPct = Number(((actualGap / refClose) * 100).toFixed(2));

      const orderId = `ord-gap-${inst.symbol.toLowerCase()}-${d.replace(/-/g, '')}`;
      const gross = isSuccess ? Math.abs(predGap) * 2 : -Math.abs(actualGap) * 2;
      const costs = 3.2;
      const net = Number((gross - costs).toFixed(2));

      let failureAnalysis: FailureAnalysis | undefined;
      if (!isSuccess) {
        failureAnalysis = {
          failure_id: `fail-gap-${orderId}`,
          order_id: orderId,
          symbol: inst.symbol,
          prediction_type: 'NEXT_DAY_OPENING',
          session_date: d,
          category: 'GAP_INVERSION',
          root_cause: `Next-day opening prediction for ${inst.symbol} projected a ${isLong ? 'Gap Up' : 'Gap Down'} to open at ₹${predictedOpen.toFixed(2)} (${predGap > 0 ? '+' : ''}₹${predGap.toFixed(2)}, ${predGapPct}% from Previous Close ₹${refClose.toFixed(2)}). However, overnight global macro divergence caused actual open at ₹${actualOpen.toFixed(2)} (${actualGap > 0 ? '+' : ''}₹${actualGap.toFixed(2)}, ${actualGapPct}%), inverting the predicted gap direction.`,
          learned_rule: `RULE #L-GAP-${instIdx + 1}: Check GIFT Nifty pre-market futures and overnight crude/currency correlation before deploying overnight opening gap trades.`,
          corrective_action: 'Enforce pre-open auction alignment filter; cancel overnight gap bias if pre-market indicative price deviates from predicted open.',
          metrics_at_failure: `Prev Close: ₹${refClose.toFixed(2)} | Predicted Open: ₹${predictedOpen.toFixed(2)} | Actual Open: ₹${actualOpen.toFixed(2)} | Error: ₹${gapError.toFixed(2)}`,
          timestamp: `${d}T16:00:00.000Z`,
        };
      }

      generatedOrders.push({
        order_id: orderId,
        signal_id: `sig-${orderId}`,
        instrument_id: inst.instrument_id,
        symbol: inst.symbol,
        direction: isLong ? 'LONG' : 'SHORT',
        quantity: 2,
        status: 'CLOSED',
        planned_entry: refClose,
        planned_target: predictedOpen,
        planned_stop: roundToTick(isLong ? refClose - Math.abs(predGap) * 0.8 : refClose + Math.abs(predGap) * 0.8, inst.tick_size),
        entry_fill_price: refClose,
        exit_fill_price: actualOpen,
        entry_time: `${d}T15:30:00.000Z`,
        exit_time: `${d}T09:16:00.000Z`,
        expiry_time: `${d}T09:30:00.000Z`,
        exit_reason: isSuccess ? 'TAKE_PROFIT_HIT' : 'STOP_LOSS_HIT',
        gross_pnl_inr: gross,
        total_costs_inr: costs,
        net_pnl_inr: net,
        mfe_inr: isSuccess ? Math.abs(predGap) * 2 : 1.0,
        mae_inr: isSuccess ? 0.5 : Math.abs(actualGap) * 2,
        created_at: `${d}T15:30:00.000Z`,
        prediction_type: 'NEXT_DAY_OPENING',
        session_date: d,
        outcome_status: isSuccess ? 'SUCCESS_TARGET_HIT' : 'FAILURE_STOP_HIT',
        failure_analysis: failureAnalysis,
        // Specific Previous Close vs Next Open metrics
        prev_day_close_price: refClose,
        predicted_next_open_price: predictedOpen,
        actual_next_open_price: actualOpen,
        predicted_gap_inr: predGap,
        predicted_gap_pct: predGapPct,
        actual_gap_inr: actualGap,
        actual_gap_pct: actualGapPct,
        gap_error_inr: gapError,
        gap_direction_matched: isSuccess,
      });
    });
  });

  return generatedOrders;
}
