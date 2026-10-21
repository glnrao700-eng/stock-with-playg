import { TargetRulesConfig, TargetValidationResult } from '../types/platform';

export function roundToTick(price: number, tickSize: number = 0.05): number {
  const steps = Math.round(price / tickSize);
  return Number((steps * tickSize).toFixed(2));
}

export function validateIntradayTargets(
  direction: 'LONG' | 'SHORT' | 'NO_TRADE',
  referencePrice: number,
  rawEntry: number,
  rawTarget: number,
  rawStop: number,
  tickSize: number,
  rules: TargetRulesConfig,
  minRR: number = 1.5
): TargetValidationResult {
  const p0 = roundToTick(referencePrice, tickSize);
  const e = roundToTick(rawEntry, tickSize);
  const t = roundToTick(rawTarget, tickSize);
  const s = roundToTick(rawStop, tickSize);

  const reasons: string[] = [];
  let reward = 0;
  let risk = 1;

  if (direction === 'LONG') {
    if (!(s < e && e < t)) {
      reasons.push(`Invalid LONG level ordering: require S (₹${s}) < E (₹${e}) < T (₹${t})`);
    }
    reward = t - e;
    risk = e - s;
  } else if (direction === 'SHORT') {
    if (!(t < e && e < s)) {
      reasons.push(`Invalid SHORT level ordering: require T (₹${t}) < E (₹${e}) < S (₹${s})`);
    }
    reward = e - t;
    risk = s - e;
  } else {
    reasons.push(`Unsupported or non-actionable direction: ${direction}`);
  }

  const dispEP0 = Number(Math.abs(e - p0).toFixed(2));
  const dispTP0 = Number(Math.abs(t - p0).toFixed(2));
  const dispTE = Number(Math.abs(t - e).toFixed(2));

  if (dispEP0 < rules.min_entry_displacement_inr) {
    reasons.push(
      `|E - P0| = ₹${dispEP0.toFixed(2)} is below minimum required ₹${rules.min_entry_displacement_inr.toFixed(2)}`
    );
  }
  if (dispTP0 < rules.min_target_from_ref_inr) {
    reasons.push(
      `|T - P0| = ₹${dispTP0.toFixed(2)} is below minimum required ₹${rules.min_target_from_ref_inr.toFixed(2)}`
    );
  }
  if (dispTE < rules.min_target_from_entry_inr) {
    reasons.push(
      `|T - E| = ₹${dispTE.toFixed(2)} is below minimum required ₹${rules.min_target_from_entry_inr.toFixed(2)}`
    );
  }

  const rrRatio = risk > 0 ? Number((reward / risk).toFixed(2)) : 0;
  if (rrRatio < minRR) {
    reasons.push(`Reward-to-Risk ratio ${rrRatio.toFixed(2)} is below minimum required ${minRR.toFixed(2)}`);
  }

  return {
    is_valid: reasons.length === 0,
    direction,
    reference_price: p0,
    entry_price: e,
    target_price: t,
    stop_price: s,
    entry_displacement_inr: dispEP0,
    target_from_ref_inr: dispTP0,
    target_from_entry_inr: dispTE,
    reward_per_share_inr: Math.max(reward, 0),
    risk_per_share_inr: Math.max(risk, 0),
    reward_to_risk_ratio: rrRatio,
    rejection_reasons: reasons,
  };
}
