import {
  FundamentalOutput,
  InstrumentConfig,
  OrchestratorOutput,
  PatternOutput,
  PlatformConfig,
  SentimentOutput,
  TechnicalOutput,
} from '../../types/platform';
import { roundToTick, validateIntradayTargets } from '../targetValidator';

export function runStrategyOrchestrator(
  instrument: InstrumentConfig,
  config: PlatformConfig,
  techOut: TechnicalOutput,
  patternOut: PatternOutput,
  sentimentOut: SentimentOutput,
  fundamentalOut: FundamentalOutput,
  asOf: Date = new Date(),
  dataQualityMode: string = 'DEMO_REPLAY'
): OrchestratorOutput {
  const weights = config.agent_weights;
  const tScore = techOut.score || 0;
  const pScore = patternOut.score || 0;
  const sRaw = sentimentOut.score;
  const fScore = fundamentalOut.score || 0;

  const missingWarnings: string[] = [];
  let composite = 0;

  if (sRaw === null) {
    missingWarnings.push(
      'Sentiment data missing before cutoff; renormalizing weights across Technical (0.47), Pattern (0.35), and Fundamental (0.18).'
    );
    const totalW = weights.technical + weights.pattern + weights.fundamental;
    composite =
      (weights.technical * tScore + weights.pattern * pScore + weights.fundamental * fScore) /
      Math.max(totalW, 0.01);
  } else {
    composite =
      weights.technical * tScore +
      weights.pattern * pScore +
      weights.sentiment * sRaw +
      weights.fundamental * fScore;
  }

  const ind = techOut.indicators;
  const refPrice = ind.last_close || instrument.base_demo_price;
  const atr = Math.max(ind.atr_14 || 2.0, 1.5);
  const rules = config.target_rules;

  let direction: 'LONG' | 'SHORT' | 'NO_TRADE' = 'NO_TRADE';
  if (composite >= 0.22) {
    direction = 'LONG';
  } else if (composite <= -0.22 && config.risk_controls.allow_short_selling) {
    direction = 'SHORT';
  }

  if (direction === 'NO_TRADE') {
    return {
      decision: 'NO_TRADE',
      composite_score: Number(composite.toFixed(3)),
      calibrated_probability: null,
      probability_definition: 'Empirical model uncalibrated in demo replay mode',
      reference_price: refPrice,
      planned_entry: null,
      planned_target: null,
      planned_stop: null,
      trigger_type: 'NONE',
      horizon_minutes: rules.default_horizon_minutes,
      expiry_timestamp: new Date(asOf.getTime() + rules.signal_expiry_minutes * 60000).toISOString(),
      reward_to_risk: null,
      data_quality_mode: dataQualityMode,
      missing_warnings: missingWarnings,
      rationale: `Composite score (${composite >= 0 ? '+' : ''}${composite.toFixed(3)}) is within neutral band [-0.22, +0.22]. Strategy abstains from market exposure.`,
      validation: null,
    };
  }

  // Generate candidate levels ensuring tick rounding & displacement >= ₹3.00
  const entryOffset = Math.max(
    rules.min_entry_displacement_inr,
    roundToTick(atr * 1.6, instrument.tick_size)
  );
  const rewardOffset = Math.max(
    rules.min_target_from_entry_inr,
    roundToTick(atr * 3.2, instrument.tick_size)
  );
  const stopOffset = Math.max(2.0, roundToTick(rewardOffset / 1.8, instrument.tick_size));

  let plannedEntry = 0;
  let plannedTarget = 0;
  let plannedStop = 0;
  let triggerType = '';

  if (direction === 'LONG') {
    plannedEntry = refPrice + entryOffset;
    plannedTarget = plannedEntry + rewardOffset;
    plannedStop = plannedEntry - stopOffset;
    triggerType = 'BUY_STOP_BREAKOUT';
  } else {
    plannedEntry = refPrice - entryOffset;
    plannedTarget = plannedEntry - rewardOffset;
    plannedStop = plannedEntry + stopOffset;
    triggerType = 'SELL_STOP_BREAKDOWN';
  }

  const validation = validateIntradayTargets(
    direction,
    refPrice,
    plannedEntry,
    plannedTarget,
    plannedStop,
    instrument.tick_size,
    rules,
    config.risk_controls.min_reward_to_risk
  );

  if (!validation.is_valid) {
    return {
      decision: 'NO_TRADE',
      composite_score: Number(composite.toFixed(3)),
      calibrated_probability: null,
      probability_definition: 'Candidate rejected by ₹3 Target/Risk Validator',
      reference_price: refPrice,
      planned_entry: null,
      planned_target: null,
      planned_stop: null,
      trigger_type: 'NONE',
      horizon_minutes: rules.default_horizon_minutes,
      expiry_timestamp: new Date(asOf.getTime() + rules.signal_expiry_minutes * 60000).toISOString(),
      reward_to_risk: null,
      data_quality_mode: dataQualityMode,
      missing_warnings: missingWarnings,
      rationale: `Signal Candidate rejected by Target & Risk Validator: ${validation.rejection_reasons.join('; ')}`,
      validation,
    };
  }

  const expiryTime = new Date(asOf.getTime() + rules.signal_expiry_minutes * 60000).toISOString();

  return {
    decision: direction,
    composite_score: Number(composite.toFixed(3)),
    calibrated_probability: null,
    probability_definition:
      'Probability of reaching target T before stop S and before expiry, conditional on entry E fill (Empirical calibration required for production)',
    reference_price: validation.reference_price,
    planned_entry: validation.entry_price,
    planned_target: validation.target_price,
    planned_stop: validation.stop_price,
    trigger_type: triggerType,
    horizon_minutes: rules.default_horizon_minutes,
    expiry_timestamp: expiryTime,
    reward_to_risk: validation.reward_to_risk_ratio,
    data_quality_mode: dataQualityMode,
    missing_warnings: missingWarnings,
    rationale: `${direction} signal on ${instrument.symbol}: Composite score ${composite >= 0 ? '+' : ''}${composite.toFixed(3)} (Tech=${tScore.toFixed(2)}, Pat=${pScore.toFixed(2)}, Sent=${sRaw !== null ? sRaw.toFixed(2) : 'N/A'}, Fund=${fScore.toFixed(2)}). Levels verified: P0=₹${validation.reference_price}, Entry=₹${validation.entry_price}, Target=₹${validation.target_price}, Stop=₹${validation.stop_price} (Reward-to-Risk = ${validation.reward_to_risk_ratio.toFixed(2)}).`,
    validation,
  };
}
