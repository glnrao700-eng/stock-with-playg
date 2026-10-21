export interface InstrumentConfig {
  instrument_id: string;
  company_name: string;
  exchange: string;
  symbol: string;
  provider_token: string;
  tradingview_symbol: string;
  currency: string;
  tick_size: number;
  lot_size: number;
  enabled: boolean;
  sector: 'ENERGY_CONGLOMERATE' | 'IT_SERVICES' | 'BANKING' | 'AUTOMOBILE' | 'METALS' | 'CONSUMER' | 'INDUSTRIALS';
  historical_coverage_from: string;
  base_demo_price: number;
  upstox_instrument_key?: string;
}

export interface UpstoxLiveQuote {
  symbol: string;
  instrument_key: string;
  last_price: number;
  volume: number;
  open?: number;
  high?: number;
  low?: number;
  close?: number;
  net_change?: number;
  timestamp?: number;
}

export interface UpstoxConnectionState {
  connected: boolean;
  latency_ms?: number;
  hasServerToken: boolean;
  message?: string;
  error?: string;
  lastUpdated?: string;
}

export interface TargetRulesConfig {
  min_entry_displacement_inr: number;
  min_target_from_ref_inr: number;
  min_target_from_entry_inr: number;
  default_horizon_minutes: number;
  signal_expiry_minutes: number;
}

export interface RiskControlsConfig {
  starting_capital_inr: number;
  risk_per_trade_pct: number;
  max_position_value_inr: number;
  max_simultaneous_positions: number;
  max_per_stock_exposure_inr: number;
  max_sector_exposure_inr: number;
  max_daily_loss_inr: number;
  max_trades_per_day: number;
  min_reward_to_risk: number;
  max_slippage_bps: number;
  cooldown_after_consecutive_losses: number;
  allow_short_selling: boolean;
  kill_switch_new_orders: boolean;
  auto_promote_post_mortem: boolean;
  post_mortem_min_sample_size: number;
}

export interface PlatformConfig {
  version: string;
  strategy_version: string;
  model_version: string;
  target_rules: TargetRulesConfig;
  risk_controls: RiskControlsConfig;
  agent_weights: {
    technical: number;
    pattern: number;
    sentiment: number;
    fundamental: number;
  };
  instruments: InstrumentConfig[];
}

export interface Candle {
  time: number; // Unix timestamp in seconds
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface TargetValidationResult {
  is_valid: boolean;
  direction: 'LONG' | 'SHORT' | 'NO_TRADE';
  reference_price: number;
  entry_price: number;
  target_price: number;
  stop_price: number;
  entry_displacement_inr: number;
  target_from_ref_inr: number;
  target_from_entry_inr: number;
  reward_per_share_inr: number;
  risk_per_share_inr: number;
  reward_to_risk_ratio: number;
  rejection_reasons: string[];
}

export interface TechnicalOutput {
  data_sufficiency: 'SUFFICIENT' | 'INSUFFICIENT_BARS';
  score: number;
  bias: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
  cross_timeframe_agreement: 'ALIGNED' | 'MIXED';
  indicators: {
    last_close: number;
    sma_20: number;
    sma_50: number;
    ema_9: number;
    ema_21: number;
    rsi_14: number;
    macd_line: number;
    macd_signal: number;
    macd_hist: number;
    bb_upper: number;
    bb_lower: number;
    atr_14: number;
    vwap: number;
    obv_5bar_delta: number;
    support_20: number;
    resistance_20: number;
    // Whole 30-Day continuous candle indicators
    sma_200?: number;
    high_30d?: number;
    low_30d?: number;
    vwap_30d?: number;
    return_30d_pct?: number;
    total_bars_evaluated?: number;
  };
  evidence: string[];
}

export interface PatternOutput {
  pattern_type: string;
  status: 'CONFIRMED' | 'DEVELOPING' | 'NONE';
  score: number;
  formation_boundaries: { resistance: number; support: number };
  invalidation_level: number | null;
  volume_confirmation: boolean;
  confirmation_timestamp: string;
  // Whole 30-Day macro pattern framework
  macro_30d_framework?: {
    high_30d: number;
    low_30d: number;
    fib_382: number;
    fib_500: number;
    fib_618: number;
    swing_trend: 'BULLISH_UPTREND' | 'BEARISH_DOWNTREND' | 'SIDEWAYS_RANGE';
  };
  evidence: string[];
}

export interface NewsItem {
  source_id: string;
  source_type: 'EXCHANGE_FILING' | 'SOCIAL_MEDIA' | 'VERIFIED_NEWS';
  quality_tier: 'TIER_1_VERIFIED' | 'TIER_3_UNVERIFIED_SOCIAL';
  headline: string;
  published_at: string;
  sentiment_score: number;
  relevance: number;
  impact_horizon: string;
}

export interface SentimentOutput {
  classification: 'BULLISH' | 'BEARISH' | 'NEUTRAL' | 'UNCERTAIN_MISSING_DATA';
  score: number | null;
  coverage_status: 'COMPLETE' | 'MISSING';
  verified_filing_sentiment: number | null;
  social_sentiment: number | null;
  item_count: number;
  evidence: string[];
}

export interface FundamentalOutput {
  status: 'VERIFIED' | 'DEGRADED_MISSING_FUNDAMENTALS';
  score: number;
  sector_model: string;
  fiscal_period: string;
  earnings_risk_flag: boolean;
  metrics: Record<string, number | string | boolean>;
  evidence: string[];
}

export interface OrchestratorOutput {
  decision: 'LONG' | 'SHORT' | 'NO_TRADE';
  composite_score: number;
  calibrated_probability: number | null;
  probability_definition: string;
  reference_price: number;
  planned_entry: number | null;
  planned_target: number | null;
  planned_stop: number | null;
  trigger_type: string;
  horizon_minutes: number;
  expiry_timestamp: string;
  reward_to_risk: number | null;
  data_quality_mode: string;
  missing_warnings: string[];
  rationale: string;
  validation: TargetValidationResult | null;
}

export interface AgentRunAudit {
  run_id: string;
  correlation_id: string;
  instrument_id: string;
  symbol: string;
  as_of_timestamp: string;
  technical_output: TechnicalOutput;
  pattern_output: PatternOutput;
  sentiment_output: SentimentOutput;
  fundamental_output: FundamentalOutput;
  orchestrator_output: OrchestratorOutput;
  strategy_version: string;
  duration_ms: number;
}

export interface FailureAnalysis {
  failure_id: string;
  order_id: string;
  symbol: string;
  prediction_type: 'INTRADAY' | 'NEXT_DAY_OPENING';
  session_date: string;
  category:
    | 'FALSE_BREAKOUT'
    | 'COUNTER_TREND_REVERSAL'
    | 'SLIPPAGE_OR_COST_DRAG'
    | 'GAP_INVERSION'
    | 'SAME_BAR_CHOP'
    | 'PREMATURE_TRIGGER';
  root_cause: string;
  learned_rule: string;
  corrective_action: string;
  metrics_at_failure: string;
  timestamp: string;
}

export interface PaperOrder {
  order_id: string;
  signal_id: string;
  instrument_id: string;
  symbol: string;
  direction: 'LONG' | 'SHORT';
  quantity: number;
  status: 'PENDING' | 'FILLED' | 'CLOSED' | 'EXPIRED';
  planned_entry: number;
  planned_target: number;
  planned_stop: number;
  entry_fill_price: number | null;
  exit_fill_price: number | null;
  entry_time: string | null;
  exit_time: string | null;
  expiry_time: string;
  exit_reason: string | null;
  gross_pnl_inr: number;
  total_costs_inr: number;
  net_pnl_inr: number;
  mfe_inr: number;
  mae_inr: number;
  created_at: string;
  // Date-based tracking & Dual Section tags
  prediction_type?: 'INTRADAY' | 'NEXT_DAY_OPENING';
  session_date?: string; // YYYY-MM-DD
  outcome_status?: 'SUCCESS_TARGET_HIT' | 'FAILURE_STOP_HIT' | 'ACTIVE_TRACKING' | 'EXPIRED';
  failure_analysis?: FailureAnalysis;
  post_mortem?: PostMortemReport;
  // Next-Day Opening specific properties (Prev Day Close vs Next Open)
  prev_day_close_price?: number;
  predicted_next_open_price?: number;
  actual_next_open_price?: number;
  predicted_gap_inr?: number;
  predicted_gap_pct?: number;
  actual_gap_inr?: number;
  actual_gap_pct?: number;
  gap_error_inr?: number;
  gap_direction_matched?: boolean;
}

export interface PostMortemReport {
  report_id: string;
  order_id: string;
  symbol: string;
  outcome_classification: string;
  evidence_summary: string;
  agent_disagreement_notes: string;
  parameter_candidate: {
    status: string;
    current_sample_size: number;
    required_minimum_samples: number;
    proposed_weights?: Record<string, number>;
    auto_promoted: boolean;
    note?: string;
  };
  created_at: string;
}

export interface NextSessionForecast {
  forecast_id: string;
  instrument_id: string;
  symbol: string;
  session_date: string;
  next_trading_date: string;
  revision_number: number;
  cutoff_timestamp: string;
  reference_close_price: number;
  predicted_open_price: number;
  predicted_gap_inr: number;
  predicted_gap_pct: number;
  interval_low_80: number;
  interval_high_80: number;
  baseline_prev_close: number;
  data_completeness: string;
  supporting_factors: {
    closing_location_value: number;
    session_return_pct: number;
    final_15m_momentum_pct: number;
    sentiment_input: number;
    overnight_disclaimer: string;
  };
  model_version: string;
  created_at: string;
}

export interface SystemMonitorEvent {
  id: string;
  timestamp: string;
  correlation_id: string;
  component: string;
  event_type: string;
  severity: 'INFO' | 'WARN' | 'ERROR';
  latency_ms: number;
  details: Record<string, string | number | boolean>;
}

export interface SessionStatus {
  utc_timestamp: string;
  ist_timestamp: string;
  session_date: string;
  is_trading_day: boolean;
  next_trading_day: string;
  phase: string;
  allow_new_intraday_entries: boolean;
  is_market_open: boolean;
}
