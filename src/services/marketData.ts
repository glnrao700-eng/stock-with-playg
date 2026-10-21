import { Candle, InstrumentConfig, NewsItem, SessionStatus } from '../types/platform';
import { roundToTick } from './targetValidator';

export const LATEST_MARKET_REFERENCE_PRICES: Record<string, number> = {
  RELIANCE: 1202.0,
  TCS: 2460.9,
  HDFCBANK: 712.0,
  INFY: 1130.7,
  ICICIBANK: 1381.0,
  SBIN: 973.7,
};

export const DEFAULT_INSTRUMENTS: InstrumentConfig[] = [
  {
    instrument_id: 'NSE_RELIANCE',
    company_name: 'Reliance Industries Limited',
    exchange: 'NSE',
    symbol: 'RELIANCE',
    provider_token: '738561',
    tradingview_symbol: 'NSE:RELIANCE',
    upstox_instrument_key: 'NSE_EQ|INE002A01018',
    currency: 'INR',
    tick_size: 0.05,
    lot_size: 1,
    enabled: true,
    sector: 'ENERGY_CONGLOMERATE',
    historical_coverage_from: '2018-01-01',
    base_demo_price: 1202.0,
  },
  {
    instrument_id: 'NSE_TCS',
    company_name: 'Tata Consultancy Services Limited',
    exchange: 'NSE',
    symbol: 'TCS',
    provider_token: '2953217',
    tradingview_symbol: 'NSE:TCS',
    upstox_instrument_key: 'NSE_EQ|INE467B01029',
    currency: 'INR',
    tick_size: 0.05,
    lot_size: 1,
    enabled: true,
    sector: 'IT_SERVICES',
    historical_coverage_from: '2018-01-01',
    base_demo_price: 2460.9,
  },
  {
    instrument_id: 'NSE_HDFCBANK',
    company_name: 'HDFC Bank Limited',
    exchange: 'NSE',
    symbol: 'HDFCBANK',
    provider_token: '341249',
    tradingview_symbol: 'NSE:HDFCBANK',
    upstox_instrument_key: 'NSE_EQ|INE040A01034',
    currency: 'INR',
    tick_size: 0.05,
    lot_size: 1,
    enabled: true,
    sector: 'BANKING',
    historical_coverage_from: '2018-01-01',
    base_demo_price: 712.0,
  },
  {
    instrument_id: 'NSE_INFY',
    company_name: 'Infosys Limited',
    exchange: 'NSE',
    symbol: 'INFY',
    provider_token: '408065',
    tradingview_symbol: 'NSE:INFY',
    upstox_instrument_key: 'NSE_EQ|INE009A01021',
    currency: 'INR',
    tick_size: 0.05,
    lot_size: 1,
    enabled: true,
    sector: 'IT_SERVICES',
    historical_coverage_from: '2018-01-01',
    base_demo_price: 1130.7,
  },
  {
    instrument_id: 'NSE_ICICIBANK',
    company_name: 'ICICI Bank Limited',
    exchange: 'NSE',
    symbol: 'ICICIBANK',
    provider_token: '1270529',
    tradingview_symbol: 'NSE:ICICIBANK',
    upstox_instrument_key: 'NSE_EQ|INE090A01021',
    currency: 'INR',
    tick_size: 0.05,
    lot_size: 1,
    enabled: true,
    sector: 'BANKING',
    historical_coverage_from: '2018-01-01',
    base_demo_price: 1381.0,
  },
  {
    instrument_id: 'NSE_SBIN',
    company_name: 'State Bank of India',
    exchange: 'NSE',
    symbol: 'SBIN',
    provider_token: '779521',
    tradingview_symbol: 'NSE:SBIN',
    upstox_instrument_key: 'NSE_EQ|INE062A01020',
    currency: 'INR',
    tick_size: 0.05,
    lot_size: 1,
    enabled: true,
    sector: 'BANKING',
    historical_coverage_from: '2018-01-01',
    base_demo_price: 973.7,
  },
];

export function getLastTradingBarTimestamp(
  sessionDate: string,
  isMarketOpen: boolean,
  timeframe: '1m' | '5m' | '15m' = '1m'
): number {
  const [yr, mo, da] = sessionDate.split('-').map(Number);
  const now = new Date();

  // If market is currently open in IST (between 09:15 and 15:30 IST on a trading day)
  if (isMarketOpen) {
    const epochSec = Math.floor(now.getTime() / 1000);
    const tfSeconds = timeframe === '1m' ? 60 : timeframe === '5m' ? 300 : 900;
    return epochSec - (epochSec % tfSeconds);
  }

  // When market is closed, the last completed candle corresponds to the official NSE close:
  // NSE regular trading session closes at 15:30:00 IST.
  // 15:29:00 IST = 09:59:00 UTC (15:29 - 5:30 = 09:59 UTC)
  // For 1m: bar opens at 15:29 IST = 09:59 UTC
  // For 5m: bar opens at 15:25 IST = 09:55 UTC
  // For 15m: bar opens at 15:15 IST = 09:45 UTC
  const closeMinuteUtc = timeframe === '1m' ? 59 : timeframe === '5m' ? 55 : 45;
  const closeUtc = Date.UTC(yr, mo - 1, da, 9, closeMinuteUtc, 0) / 1000;
  return closeUtc;
}

// Pseudo-random deterministic generator based on a string seed and integer step
function pseudoRandom(seed: number, index: number): number {
  const x = Math.sin(seed * 997 + index * 101.37) * 10000;
  return x - Math.floor(x);
}

export function generateHistoricalCandles(
  instrument: InstrumentConfig,
  timeframe: '1m' | '5m' | '15m' = '1m',
  barsCount: number = 90,
  stepOffset: number = 0,
  sessionStatus?: SessionStatus
): Candle[] {
  const base = instrument.base_demo_price;
  const seed = instrument.symbol.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
  const tfSeconds = timeframe === '1m' ? 60 : timeframe === '5m' ? 300 : 900;

  // Determine anchor time: if sessionStatus is provided and market is closed, anchor to the last market close!
  let lastBarTime: number;
  if (sessionStatus && !sessionStatus.is_market_open) {
    lastBarTime = getLastTradingBarTimestamp(sessionStatus.session_date, false, timeframe) + stepOffset * tfSeconds;
  } else {
    const nowSec = Math.floor(Date.now() / 1000);
    lastBarTime = nowSec - (nowSec % tfSeconds) + stepOffset * tfSeconds;
  }

  const startTime = lastBarTime - (barsCount - 1) * tfSeconds;
  const lastIndex = barsCount - 1;

  // Generate a realistic multi-wave market trajectory with support/resistance levels, trend swings, and pullbacks
  // We want the final bar (index = lastIndex) to land exactly on the official closing/current price (base)
  // when stepOffset === 0, or with realistic simulated live progression when stepOffset > 0.
  const pathCumulativeDeltas: number[] = new Array(barsCount).fill(0);

  // Volatility scale per bar in Rupees based on stock price and timeframe
  const tfMultiplier = timeframe === '1m' ? 1 : timeframe === '5m' ? 2.1 : 3.6;
  const barVolRup = Math.max(instrument.tick_size * 2, (base * 0.00075) * tfMultiplier);

  // Precompute realistic price walk backwards from the target terminal price
  // The terminal price at index = lastIndex:
  const stepDrift = stepOffset > 0 ? (stepOffset * 0.12 * (seed % 2 === 1 ? 1 : -0.7)) : 0;
  const terminalPrice = base + stepDrift;

  // Build series backwards from terminal price so terminal price is exact
  const closePrices: number[] = new Array(barsCount);
  closePrices[lastIndex] = terminalPrice;

  let currentPrice = terminalPrice;
  for (let i = lastIndex - 1; i >= 0; i--) {
    const r1 = pseudoRandom(seed, i * 7 + 1);
    const r2 = pseudoRandom(seed, i * 11 + 3);
    const r3 = pseudoRandom(seed, i * 19 + 5);

    // Realistic market wave structure: combine momentum cycle, mean reversion, and noise
    const cycle = Math.sin((i / 8) + (seed % 5)) * 0.45;
    const microTrend = (seed % 2 === 1 ? 0.08 : -0.08);
    const delta = (r1 - 0.5 + cycle * 0.35 + microTrend) * barVolRup;

    currentPrice = currentPrice - delta;
    // Bound price so it doesn't deviate unrealistically far from base
    const maxDeviation = base * 0.025;
    if (currentPrice > base + maxDeviation) currentPrice = base + maxDeviation - (r2 * barVolRup);
    if (currentPrice < base - maxDeviation) currentPrice = base - maxDeviation + (r2 * barVolRup);

    closePrices[i] = currentPrice;
  }

  const candles: Candle[] = [];

  for (let i = 0; i < barsCount; i++) {
    const barTime = startTime + i * tfSeconds;
    const closeVal = closePrices[i];

    // Open is typically close of previous bar + slight micro gap
    let openVal: number;
    if (i === 0) {
      const prevRand = pseudoRandom(seed, i * 13 + 7);
      openVal = closeVal - (prevRand - 0.48) * (barVolRup * 0.6);
    } else {
      const gap = (pseudoRandom(seed, i * 17 + 2) - 0.5) * (barVolRup * 0.25);
      openVal = closePrices[i - 1] + gap;
    }

    // High and Low wicks with realistic distribution (sometimes long wicks, sometimes marubozu)
    const upperBody = Math.max(openVal, closeVal);
    const lowerBody = Math.min(openVal, closeVal);
    const bodySize = upperBody - lowerBody;

    const rWickUp = pseudoRandom(seed, i * 23 + 4);
    const rWickDown = pseudoRandom(seed, i * 29 + 8);

    const upperWick = Math.max(instrument.tick_size, rWickUp * (barVolRup * 0.85) + bodySize * 0.2);
    const lowerWick = Math.max(instrument.tick_size, rWickDown * (barVolRup * 0.85) + bodySize * 0.2);

    const highVal = upperBody + upperWick;
    const lowVal = lowerBody - lowerWick;

    // Realistic volume: higher volume at breakouts and turning points
    const baseVol = 35000 + (seed * 117) % 25000;
    const volSurge = (bodySize / barVolRup) * 18000;
    const volNoise = pseudoRandom(seed, i * 31) * 15000;
    const vol = Math.floor((baseVol + volSurge + volNoise) * tfMultiplier);

    // For the final candle, ensure the close precisely matches terminalPrice
    if (i === lastIndex) {
      const openPrice = roundToTick(openVal, instrument.tick_size);
      const closePrice = roundToTick(terminalPrice, instrument.tick_size);
      candles.push({
        time: barTime,
        open: openPrice,
        high: roundToTick(Math.max(openPrice, closePrice, highVal), instrument.tick_size),
        low: roundToTick(Math.min(openPrice, closePrice, lowVal), instrument.tick_size),
        close: closePrice,
        volume: vol,
      });
      continue;
    }

    candles.push({
      time: barTime,
      open: roundToTick(openVal, instrument.tick_size),
      high: roundToTick(highVal, instrument.tick_size),
      low: roundToTick(lowVal, instrument.tick_size),
      close: roundToTick(closeVal, instrument.tick_size),
      volume: vol,
    });
  }

  return candles;
}

export function fetchNewsAndSocial(instrument: InstrumentConfig, now: Date = new Date()): NewsItem[] {
  const seed = instrument.symbol.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
  const isBullish = seed % 2 === 1;

  return [
    {
      source_id: `NSE-FILING-${instrument.symbol}-01`,
      source_type: 'EXCHANGE_FILING',
      quality_tier: 'TIER_1_VERIFIED',
      headline: isBullish
        ? `${instrument.company_name} secures ₹4,800 Cr institutional order; operating margin expands 140 bps`
        : `${instrument.company_name} files disclosure on temporary production recalibration & raw material cost pressure`,
      published_at: new Date(now.getTime() - 22 * 60000).toISOString(),
      sentiment_score: isBullish ? 0.68 : -0.58,
      relevance: 0.92,
      impact_horizon: 'INTRADAY_TO_MULTI_DAY',
    },
    {
      source_id: `SOCIAL-FIN-${instrument.symbol}-02`,
      source_type: 'SOCIAL_MEDIA',
      quality_tier: 'TIER_3_UNVERIFIED_SOCIAL',
      headline: isBullish
        ? `Heavy call buying noted in ${instrument.symbol} ATM strike near key VWAP support`
        : `Unusual put buildup in ${instrument.symbol} front-month contracts`,
      published_at: new Date(now.getTime() - 11 * 60000).toISOString(),
      sentiment_score: isBullish ? 0.35 : -0.25,
      relevance: 0.6,
      impact_horizon: 'INTRADAY',
    },
  ];
}

export function fetchFundamentals(instrument: InstrumentConfig): Record<string, any> {
  if (instrument.sector === 'BANKING') {
    const isTopTier = instrument.symbol === 'HDFCBANK' || instrument.symbol === 'ICICIBANK';
    return {
      sector_model: 'BANKING_FINANCIALS',
      fiscal_period: 'Q2-FY2026',
      published_date: '2026-07-20',
      net_interest_margin_pct: isTopTier ? 3.85 : 3.45,
      gnpa_pct: isTopTier ? 1.28 : 2.15,
      nnpa_pct: isTopTier ? 0.38 : 0.55,
      capital_adequacy_crar_pct: isTopTier ? 18.6 : 15.8,
      casa_ratio_pct: 42.1,
      roe_pct: isTopTier ? 17.2 : 14.8,
      pe_ratio: isTopTier ? 19.2 : 11.5,
      pb_ratio: isTopTier ? 2.8 : 1.4,
      upcoming_earnings_within_2_days: false,
    };
  }

  return {
    sector_model: 'CORPORATE_INDUSTRIAL_IT',
    fiscal_period: 'Q2-FY2026',
    published_date: '2026-07-18',
    revenue_yoy_growth_pct: 12.4,
    operating_margin_pct: instrument.sector === 'IT_SERVICES' ? 24.8 : 17.2,
    roe_pct: instrument.sector === 'IT_SERVICES' ? 29.1 : 15.4,
    roce_pct: instrument.sector === 'IT_SERVICES' ? 33.4 : 16.8,
    debt_to_equity: instrument.sector === 'IT_SERVICES' ? 0.06 : 0.42,
    current_ratio: 2.3,
    pe_ratio: instrument.sector === 'IT_SERVICES' ? 26.5 : 22.8,
    upcoming_earnings_within_2_days: false,
  };
}
