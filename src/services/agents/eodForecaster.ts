import { Candle, InstrumentConfig, NextSessionForecast, PlatformConfig } from '../../types/platform';
import { getNextTradingDay } from '../nseCalendar';
import { roundToTick } from '../targetValidator';

export function runNextSessionOpeningForecast(
  instrument: InstrumentConfig,
  sessionCandles: Candle[],
  sentimentScore: number | null,
  config: PlatformConfig,
  cutoffDate: Date = new Date(),
  revisionNumber: number = 1
): NextSessionForecast {
  const istOffset = 5.5 * 60 * 60 * 1000;
  const istDate = new Date(cutoffDate.getTime() + istOffset);
  const yr = istDate.getUTCFullYear();
  const mo = String(istDate.getUTCMonth() + 1).padStart(2, '0');
  const da = String(istDate.getUTCDate()).padStart(2, '0');
  const sessionDate = `${yr}-${mo}-${da}`;
  const nextTrading = getNextTradingDay(sessionDate);

  if (sessionCandles.length < 20) {
    const base = instrument.base_demo_price;
    return {
      forecast_id: `fc-${instrument.symbol.toLowerCase()}-${Date.now().toString(36)}`,
      instrument_id: instrument.instrument_id,
      symbol: instrument.symbol,
      session_date: sessionDate,
      next_trading_date: nextTrading,
      revision_number: revisionNumber,
      cutoff_timestamp: cutoffDate.toISOString(),
      reference_close_price: base,
      predicted_open_price: base,
      predicted_gap_inr: 0,
      predicted_gap_pct: 0,
      interval_low_80: base - 10,
      interval_high_80: base + 10,
      baseline_prev_close: base,
      data_completeness: 'PROVISIONAL_PARTIAL_SESSION',
      supporting_factors: {
        closing_location_value: 0,
        session_return_pct: 0,
        final_15m_momentum_pct: 0,
        sentiment_input: 0,
        overnight_disclaimer: 'Insufficient session bars (<20); baseline previous close fallback applied.',
      },
      model_version: config.model_version,
      created_at: cutoffDate.toISOString(),
    };
  }

  const sOpen = sessionCandles[0].open;
  const sHigh = Math.max(...sessionCandles.map((c) => c.high));
  const sLow = Math.min(...sessionCandles.map((c) => c.low));
  const sClose = sessionCandles[sessionCandles.length - 1].close;

  // Closing Location Value (CLV) [-1.0, +1.0]
  const range = Math.max(sHigh - sLow, 0.05);
  const clv = Number((((sClose - sLow) - (sHigh - sClose)) / range).toFixed(3));

  // Session return
  const sessionRet = (sClose - sOpen) / sOpen;

  // Late 15-minute momentum
  const lateIdx = Math.max(0, sessionCandles.length - 15);
  const lateRef = sessionCandles[lateIdx].close;
  const lateMomentum = (sClose - lateRef) / lateRef;

  const sVal = sentimentScore ?? 0.0;

  // Transparent ridge-like formula:
  // gap_pct = 0.0035 * CLV + 0.002 * lateMom + 0.0015 * sVal
  const rawGapPct = 0.0035 * clv + 0.002 * lateMomentum * 10 + 0.0015 * sVal;
  const clampedGapPct = Math.max(-0.025, Math.min(0.025, rawGapPct));

  const predOpenRaw = sClose * (1 + clampedGapPct);
  const predOpen = roundToTick(predOpenRaw, instrument.tick_size);
  const refClose = roundToTick(sClose, instrument.tick_size);
  const gapInr = Number((predOpen - refClose).toFixed(2));
  const gapPctFormatted = Number((clampedGapPct * 100).toFixed(2));

  // 80% Prediction interval (+/- 1.28 * estimated daily opening standard deviation)
  const estDailySigmaInr = Math.max(refClose * 0.0045, 3.5);
  const intervalSpread = roundToTick(1.28 * estDailySigmaInr, instrument.tick_size);
  const low80 = roundToTick(predOpen - intervalSpread, instrument.tick_size);
  const high80 = roundToTick(predOpen + intervalSpread, instrument.tick_size);

  return {
    forecast_id: `fc-${instrument.symbol.toLowerCase()}-${Date.now().toString(36)}`,
    instrument_id: instrument.instrument_id,
    symbol: instrument.symbol,
    session_date: sessionDate,
    next_trading_date: nextTrading,
    revision_number: revisionNumber,
    cutoff_timestamp: cutoffDate.toISOString(),
    reference_close_price: refClose,
    predicted_open_price: predOpen,
    predicted_gap_inr: gapInr,
    predicted_gap_pct: gapPctFormatted,
    interval_low_80: low80,
    interval_high_80: high80,
    baseline_prev_close: refClose,
    data_completeness: 'COMPLETE_SESSION_1530_CUTOFF',
    supporting_factors: {
      closing_location_value: clv,
      session_return_pct: Number((sessionRet * 100).toFixed(2)),
      final_15m_momentum_pct: Number((lateMomentum * 100).toFixed(2)),
      sentiment_input: Number(sVal.toFixed(2)),
      overnight_disclaimer:
        'DISCLAIMER: Forecast is strictly conditioned on information known up to the 16:00 IST cutoff. It explicitly does not reflect overnight global macroeconomic releases, geopolitical events, or post-cutoff announcements.',
    },
    model_version: config.model_version,
    created_at: cutoffDate.toISOString(),
  };
}
