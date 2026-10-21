import { Candle, PatternOutput } from '../../types/platform';

export function runPatternRecognition(candles: Candle[]): PatternOutput {
  if (candles.length < 25) {
    return {
      pattern_type: 'NONE',
      status: 'NONE',
      score: 0.0,
      formation_boundaries: { resistance: 0, support: 0 },
      invalidation_level: null,
      volume_confirmation: false,
      confirmation_timestamp: '',
      evidence: ['Need at least 25 bars for pattern structure identification.'],
    };
  }

  const len = candles.length;
  const current = candles[len - 1];
  const confirmationTime = new Date(current.time * 1000).toISOString();

  // -------------------------------------------------------------
  // 1. 30-DAY WHOLE PERIOD MACRO GEOMETRY (up to 7,500 continuous bars)
  // -------------------------------------------------------------
  const highs30d = candles.map((c) => c.high);
  const lows30d = candles.map((c) => c.low);
  const high30d = Number(Math.max(...highs30d).toFixed(2));
  const low30d = Number(Math.min(...lows30d).toFixed(2));
  const range30d = Math.max(high30d - low30d, 1);

  // 30-Day Fibonacci Retracement Levels
  const fib382 = Number((low30d + 0.382 * range30d).toFixed(2));
  const fib500 = Number((low30d + 0.5 * range30d).toFixed(2));
  const fib618 = Number((low30d + 0.618 * range30d).toFixed(2));

  // Determine 30-Day Macro Swing Trend by comparing older half vs recent half
  const midPoint = Math.floor(len / 2);
  const oldHigh = Math.max(...highs30d.slice(0, midPoint));
  const oldLow = Math.min(...lows30d.slice(0, midPoint));
  const recentHigh = Math.max(...highs30d.slice(midPoint));
  const recentLow = Math.min(...lows30d.slice(midPoint));

  let swingTrend: 'BULLISH_UPTREND' | 'BEARISH_DOWNTREND' | 'SIDEWAYS_RANGE' = 'SIDEWAYS_RANGE';
  if (recentHigh >= oldHigh && recentLow >= oldLow) {
    swingTrend = 'BULLISH_UPTREND';
  } else if (recentHigh <= oldHigh && recentLow <= oldLow) {
    swingTrend = 'BEARISH_DOWNTREND';
  }

  const macroFramework = {
    high_30d: high30d,
    low_30d: low30d,
    fib_382: fib382,
    fib_500: fib500,
    fib_618: fib618,
    swing_trend: swingTrend,
  };

  // -------------------------------------------------------------
  // 2. INTRADAY PIVOT GEOMETRY (Trailing 25 continuous bars)
  // -------------------------------------------------------------
  const window = candles.slice(-25);
  const prior = window.slice(0, -1);

  const priorHigh = Math.max(...prior.map((c) => c.high));
  const priorLow = Math.min(...prior.map((c) => c.low));
  const avgVol = prior.reduce((acc, c) => acc + c.volume, 0) / prior.length;
  const volConfirmed = current.volume >= avgVol * 1.1;

  // Structural checks: 1st half vs 2nd half of trailing 24 bars
  const half1 = prior.slice(0, 12);
  const half2 = prior.slice(12);
  const low1 = Math.min(...half1.map((c) => c.low));
  const low2 = Math.min(...half2.map((c) => c.low));
  const high1 = Math.max(...half1.map((c) => c.high));
  const high2 = Math.max(...half2.map((c) => c.high));

  // -------------------------------------------------------------
  // 3. SYNTHESIS: PATTERN WITH 30-DAY CONTINUOUS CONTEXT
  // -------------------------------------------------------------
  // Bullish Breakout with Higher-Lows
  if (current.close >= priorHigh * 0.999 && low2 >= low1) {
    const isMacroAligned = swingTrend === 'BULLISH_UPTREND';
    const status = volConfirmed ? 'CONFIRMED' : 'DEVELOPING';
    const score = status === 'CONFIRMED' ? (isMacroAligned ? 0.85 : 0.70) : 0.45;

    return {
      pattern_type: 'BULLISH_RANGE_BREAKOUT_HH_HL',
      status,
      score,
      formation_boundaries: {
        resistance: Number(priorHigh.toFixed(2)),
        support: Number(low2.toFixed(2)),
      },
      invalidation_level: Number(low2.toFixed(2)),
      volume_confirmation: volConfirmed,
      confirmation_timestamp: confirmationTime,
      macro_30d_framework: macroFramework,
      evidence: [
        `Ascending structure (L1: ₹${low1.toFixed(2)} → L2: ₹${low2.toFixed(2)}) testing overhead resistance ₹${priorHigh.toFixed(2)}.`,
        `30-Day Macro Framework: ${swingTrend.replace('_', ' ')} across ${len.toLocaleString()} continuous bars [₹${low30d} - ₹${high30d}], 50% Fib: ₹${fib500}.`,
        `Volume confirmation: ${volConfirmed ? 'PASS (1.1x volume surge over baseline)' : 'DEVELOPING (below threshold)'}.`,
      ],
    };
  }

  // Bearish Breakdown with Lower-Highs
  if (current.close <= priorLow * 1.001 && high2 <= high1) {
    const isMacroAligned = swingTrend === 'BEARISH_DOWNTREND';
    const status = volConfirmed ? 'CONFIRMED' : 'DEVELOPING';
    const score = status === 'CONFIRMED' ? (isMacroAligned ? -0.85 : -0.70) : -0.45;

    return {
      pattern_type: 'BEARISH_BREAKDOWN_LH_LL',
      status,
      score,
      formation_boundaries: {
        resistance: Number(high2.toFixed(2)),
        support: Number(priorLow.toFixed(2)),
      },
      invalidation_level: Number(high2.toFixed(2)),
      volume_confirmation: volConfirmed,
      confirmation_timestamp: confirmationTime,
      macro_30d_framework: macroFramework,
      evidence: [
        `Descending lower-high structure (H1: ₹${high1.toFixed(2)} → H2: ₹${high2.toFixed(2)}) breaching base support ₹${priorLow.toFixed(2)}.`,
        `30-Day Macro Framework: ${swingTrend.replace('_', ' ')} across ${len.toLocaleString()} continuous bars [₹${low30d} - ₹${high30d}], 50% Fib: ₹${fib500}.`,
        `Volume confirmation: ${volConfirmed ? 'PASS (breakout surge confirmed)' : 'DEVELOPING'}.`,
      ],
    };
  }

  // Consolidation inside 30-Day Range
  return {
    pattern_type: '30D_MACRO_CONSOLIDATION',
    status: 'DEVELOPING',
    score: 0.0,
    formation_boundaries: {
      resistance: Number(priorHigh.toFixed(2)),
      support: Number(priorLow.toFixed(2)),
    },
    invalidation_level: Number(priorLow.toFixed(2)),
    volume_confirmation: false,
    confirmation_timestamp: confirmationTime,
    macro_30d_framework: macroFramework,
    evidence: [
      `Consolidating inside 30-day macro range [₹${low30d} - ₹${high30d}] across ${len.toLocaleString()} bars.`,
      `Immediate 25-bar boundaries: Support ₹${priorLow.toFixed(2)} | Resistance ₹${priorHigh.toFixed(2)}.`,
      `30-Day Fibonacci Levels: 38.2% ₹${fib382} | 50.0% ₹${fib500} | 61.8% ₹${fib618}.`,
    ],
  };
}
