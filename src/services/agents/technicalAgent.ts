import { Candle, TechnicalOutput } from '../../types/platform';

export function runTechnicalAnalysis(
  candles1m: Candle[],
  candles5m?: Candle[],
  candles15m?: Candle[]
): TechnicalOutput {
  if (candles1m.length < 30) {
    return {
      data_sufficiency: 'INSUFFICIENT_BARS',
      score: 0.0,
      bias: 'NEUTRAL',
      cross_timeframe_agreement: 'MIXED',
      indicators: {
        last_close: candles1m[candles1m.length - 1]?.close || 0,
        sma_20: 0,
        sma_50: 0,
        ema_9: 0,
        ema_21: 0,
        rsi_14: 50,
        macd_line: 0,
        macd_signal: 0,
        macd_hist: 0,
        bb_upper: 0,
        bb_lower: 0,
        atr_14: 2.0,
        vwap: candles1m[candles1m.length - 1]?.close || 0,
        obv_5bar_delta: 0,
        support_20: 0,
        resistance_20: 0,
        total_bars_evaluated: candles1m.length,
      },
      evidence: ['Insufficient 1m bars (<30) for full indicator calculation.'],
    };
  }

  const closes = candles1m.map((c) => c.close);
  const highs = candles1m.map((c) => c.high);
  const lows = candles1m.map((c) => c.low);
  const volumes = candles1m.map((c) => c.volume);
  const len = closes.length;
  const lastClose = closes[len - 1];

  // -------------------------------------------------------------
  // 30-DAY CONTINUOUS HISTORICAL METRICS (evaluates up to 7,500 bars)
  // -------------------------------------------------------------
  const high30d = Number(Math.max(...highs).toFixed(2));
  const low30d = Number(Math.min(...lows).toFixed(2));
  const firstClose = closes[0];
  const return30dPct = Number((((lastClose - firstClose) / firstClose) * 100).toFixed(2));

  // Full 30-day cumulative VWAP
  let totalVol30d = 0;
  let totalPriceVol30d = 0;
  for (let i = 0; i < len; i++) {
    const typ = (highs[i] + lows[i] + closes[i]) / 3;
    totalVol30d += volumes[i];
    totalPriceVol30d += typ * volumes[i];
  }
  const vwap30d = Number((totalPriceVol30d / Math.max(totalVol30d, 1)).toFixed(2));

  // SMA 200 (if >= 200 bars, e.g. multi-day)
  const sma200Slice = closes.slice(-200);
  const sma200 = Number(
    (sma200Slice.reduce((a, b) => a + b, 0) / sma200Slice.length).toFixed(2)
  );

  // -------------------------------------------------------------
  // INTRADAY ROLLING INDICATORS
  // -------------------------------------------------------------
  // SMA 20 & SMA 50
  const sma20 = Number((closes.slice(-20).reduce((a, b) => a + b, 0) / 20).toFixed(2));
  const sma50Slice = closes.slice(-50);
  const sma50 = Number(
    (sma50Slice.reduce((a, b) => a + b, 0) / sma50Slice.length).toFixed(2)
  );

  // EMA helper
  const calcEMA = (data: number[], span: number): number => {
    const k = 2 / (span + 1);
    let ema = data[0];
    for (let i = 1; i < data.length; i++) {
      ema = data[i] * k + ema * (1 - k);
    }
    return ema;
  };

  const ema9 = Number(calcEMA(closes, 9).toFixed(2));
  const ema21 = Number(calcEMA(closes, 21).toFixed(2));
  const ema12 = calcEMA(closes, 12);
  const ema26 = calcEMA(closes, 26);
  const macdLine = Number((ema12 - ema26).toFixed(2));
  const macdSignal = Number((macdLine * 0.75).toFixed(2));
  const macdHist = Number((macdLine - macdSignal).toFixed(2));

  // RSI 14
  let gains = 0;
  let losses = 0;
  for (let i = len - 14; i < len; i++) {
    const diff = closes[i] - closes[i - 1];
    if (diff > 0) gains += diff;
    else losses += Math.abs(diff);
  }
  const avgGain = gains / 14;
  const avgLoss = losses / 14;
  const rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
  const rsi14 = Number((100 - 100 / (1 + rs)).toFixed(1));

  // Bollinger Bands (20, 2)
  const variance =
    closes.slice(-20).reduce((acc, c) => acc + Math.pow(c - sma20, 2), 0) / 20;
  const std20 = Math.sqrt(variance);
  const bbUpper = Number((sma20 + 2 * std20).toFixed(2));
  const bbLower = Number((sma20 - 2 * std20).toFixed(2));

  // ATR 14
  let trSum = 0;
  for (let i = len - 14; i < len; i++) {
    const tr = Math.max(
      highs[i] - lows[i],
      Math.abs(highs[i] - closes[i - 1]),
      Math.abs(lows[i] - closes[i - 1])
    );
    trSum += tr;
  }
  const atr14 = Number(Math.max(trSum / 14, 1.25).toFixed(2));

  // Current session intraday VWAP (last 375 bars or session slice)
  const sessionSlice = candles1m.slice(-375);
  let sessionVol = 0;
  let sessionPriceVol = 0;
  for (const bar of sessionSlice) {
    const typ = (bar.high + bar.low + bar.close) / 3;
    sessionVol += bar.volume;
    sessionPriceVol += typ * bar.volume;
  }
  const sessionVwap = Number(
    (sessionPriceVol / Math.max(sessionVol, 1)).toFixed(2)
  );

  // OBV 5-bar slope
  let obv = 0;
  const obvHistory: number[] = [];
  for (let i = 1; i < len; i++) {
    if (closes[i] > closes[i - 1]) obv += volumes[i];
    else if (closes[i] < closes[i - 1]) obv -= volumes[i];
    obvHistory.push(obv);
  }
  const obv5barDelta =
    obvHistory.length >= 5
      ? obvHistory[obvHistory.length - 1] - obvHistory[obvHistory.length - 5]
      : 0;

  const support20 = Number(Math.min(...lows.slice(-20)).toFixed(2));
  const resistance20 = Number(Math.max(...highs.slice(-20)).toFixed(2));

  // Multi-Timeframe Check
  let tf5Bull = true;
  if (candles5m && candles5m.length >= 10) {
    const c5 = candles5m.map((c) => c.close);
    tf5Bull = c5[c5.length - 1] >= calcEMA(c5, 9);
  }

  // -------------------------------------------------------------
  // SYNTHESIS: INTRADAY MOMENTUM + 30-DAY CONTINUOUS MOVEMENTS
  // -------------------------------------------------------------
  let score = 0;
  const evidence: string[] = [];

  // 1. 30-Day Macro Trend Factor
  if (lastClose > vwap30d && lastClose >= sma200) {
    score += 0.25;
    evidence.push(
      `30-Day Macro Bullish: Price (₹${lastClose.toFixed(2)}) trades above 30D VWAP (₹${vwap30d}) and 200-SMA (₹${sma200}) across ${len.toLocaleString()} continuous 1m bars.`
    );
  } else if (lastClose < vwap30d && lastClose <= sma200) {
    score -= 0.25;
    evidence.push(
      `30-Day Macro Bearish: Price (₹${lastClose.toFixed(2)}) is below 30D VWAP (₹${vwap30d}) and 200-SMA (₹${sma200}) across ${len.toLocaleString()} continuous 1m bars.`
    );
  } else {
    evidence.push(
      `30-Day Macro Equilibrium: Price (₹${lastClose.toFixed(2)}) oscillating around 30D VWAP (₹${vwap30d}) within 30D Range [₹${low30d} - ₹${high30d}].`
    );
  }

  // 2. Intraday Moving Average & Session VWAP Alignment
  if (ema9 > ema21 && lastClose > sessionVwap) {
    score += 0.35;
    evidence.push(
      `Session Momentum: EMA-9 (₹${ema9}) > EMA-21 (₹${ema21}) & Price > Intraday VWAP (₹${sessionVwap}).`
    );
  } else if (ema9 < ema21 && lastClose < sessionVwap) {
    score -= 0.35;
    evidence.push(
      `Session Momentum: EMA-9 (₹${ema9}) < EMA-21 (₹${ema21}) & Price < Intraday VWAP (₹${sessionVwap}).`
    );
  }

  // 3. RSI & MACD Momentum Check
  if (macdHist > 0 && rsi14 >= 50 && rsi14 <= 74) {
    score += 0.25;
    evidence.push(
      `Constructive Momentum: MACD Histogram positive (+${macdHist}) with RSI(14) at ${rsi14}.`
    );
  } else if (macdHist < 0 && rsi14 <= 48 && rsi14 >= 25) {
    score -= 0.25;
    evidence.push(
      `Downside Momentum: MACD Histogram negative (${macdHist}) with RSI(14) at ${rsi14}.`
    );
  } else {
    evidence.push(`Oscillators Neutral: RSI(14) at ${rsi14} in balanced equilibrium band.`);
  }

  // 4. Volume / OBV Confirmation across 30-Day Data
  if (obv5barDelta > 0 && score > 0) {
    score += 0.15;
    evidence.push(`On-Balance Volume (OBV) expanding in breakout direction (+${Math.round(obv5barDelta)} vol).`);
  } else if (obv5barDelta < 0 && score < 0) {
    score -= 0.15;
    evidence.push(`OBV confirming selling pressure (${Math.round(obv5barDelta)} vol).`);
  }

  // 5. 30-Day Range Context
  const rangeSpan = Math.max(high30d - low30d, 1);
  const positionInRangePct = Number((((lastClose - low30d) / rangeSpan) * 100).toFixed(1));
  evidence.push(
    `30-Day Range Location: ${positionInRangePct}% of 30D span [₹${low30d} to ₹${high30d}] (30D Net Change: ${return30dPct >= 0 ? '+' : ''}${return30dPct}%).`
  );

  const crossTimeframeAgreement =
    (score > 0 && tf5Bull) || (score < 0 && !tf5Bull) ? 'ALIGNED' : 'MIXED';

  const clampedScore = Number(Math.max(-1.0, Math.min(1.0, score)).toFixed(3));
  const bias = clampedScore >= 0.2 ? 'BULLISH' : clampedScore <= -0.2 ? 'BEARISH' : 'NEUTRAL';

  return {
    data_sufficiency: 'SUFFICIENT',
    score: clampedScore,
    bias,
    cross_timeframe_agreement: crossTimeframeAgreement,
    indicators: {
      last_close: Number(lastClose.toFixed(2)),
      sma_20: sma20,
      sma_50: sma50,
      ema_9: ema9,
      ema_21: ema21,
      rsi_14: rsi14,
      macd_line: macdLine,
      macd_signal: macdSignal,
      macd_hist: macdHist,
      bb_upper: bbUpper,
      bb_lower: bbLower,
      atr_14: atr14,
      vwap: sessionVwap,
      obv_5bar_delta: obv5barDelta,
      support_20: support20,
      resistance_20: resistance20,
      // 30-Day continuous continuous metrics
      sma_200: sma200,
      high_30d: high30d,
      low_30d: low30d,
      vwap_30d: vwap30d,
      return_30d_pct: return30dPct,
      total_bars_evaluated: len,
    },
    evidence,
  };
}
