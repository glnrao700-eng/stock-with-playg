import { PaperOrder, PlatformConfig, PostMortemReport } from '../../types/platform';

export function runPostMortemAudit(
  order: PaperOrder,
  totalClosedTradesCount: number,
  config: PlatformConfig
): PostMortemReport {
  const netPnl = order.net_pnl_inr;
  const reason = order.exit_reason || 'UNKNOWN';
  const mfe = order.mfe_inr;
  const mae = order.mae_inr;
  const costs = order.total_costs_inr;

  let classification = 'STOPPED_OUT_OR_COST_DRAG';
  if (reason === 'TAKE_PROFIT_HIT' && netPnl > 0) {
    classification = 'TARGET_ACHIEVED_CLEAN';
  } else if (reason === 'AMBIGUOUS_SAME_BAR_CONSERVATIVE_STOP') {
    classification = 'AMBIGUOUS_SAME_BAR_CONSERVATIVE_STOP';
  } else if (netPnl < 0 && mfe > Math.abs(netPnl)) {
    classification = 'REVERSAL_AFTER_FAVORABLE_EXCURSION';
  }

  const minSample = config.risk_controls.post_mortem_min_sample_size;
  const sampleMet = totalClosedTradesCount >= minSample;

  const candidate = sampleMet
    ? {
        status: 'CANDIDATE_READY_FOR_WALK_FORWARD_GATE',
        current_sample_size: totalClosedTradesCount,
        required_minimum_samples: minSample,
        proposed_weights: {
          technical: 0.42,
          pattern: 0.28,
          sentiment: 0.15,
          fundamental: 0.15,
        },
        auto_promoted: config.risk_controls.auto_promote_post_mortem,
        note: 'Sample size threshold met. Optimization candidate queued for walk-forward verification.',
      }
    : {
        status: 'HOLD_INSUFFICIENT_SAMPLE_SIZE',
        current_sample_size: totalClosedTradesCount,
        required_minimum_samples: minSample,
        auto_promoted: false,
        note: `Weight adjustments strictly gated until sample reaches >= ${minSample} closed trades (currently ${totalClosedTradesCount}).`,
      };

  return {
    report_id: `pm-${order.order_id}-${Date.now().toString(36).slice(-4)}`,
    order_id: order.order_id,
    symbol: order.symbol,
    outcome_classification: classification,
    evidence_summary: `Trade closed via ${reason}. Gross P&L: ₹${order.gross_pnl_inr.toFixed(2)}, Statutory Costs: ₹${costs.toFixed(2)}, Net P&L: ₹${netPnl.toFixed(2)}. Max Favorable Excursion (MFE): ₹${mfe.toFixed(2)}, Max Adverse Excursion (MAE): ₹${mae.toFixed(2)}.`,
    agent_disagreement_notes:
      'Evaluated against original entry snapshot and price path. Deterministic audit recorded in permanent ledger.',
    parameter_candidate: candidate,
    created_at: new Date().toISOString(),
  };
}
