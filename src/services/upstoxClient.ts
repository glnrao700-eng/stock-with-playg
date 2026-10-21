import { Candle, UpstoxConnectionState, UpstoxLiveQuote } from '../types/platform';

const STORAGE_KEY = 'upstox_broker_session_token';

let inMemoryToken: string | null = null;

export function getUpstoxSessionToken(): string | null {
  if (inMemoryToken) return inMemoryToken;
  try {
    const fromLocal = localStorage.getItem(STORAGE_KEY);
    if (fromLocal) {
      inMemoryToken = fromLocal;
      return fromLocal;
    }
  } catch {
    // localStorage unavailable
  }
  try {
    const fromSession = sessionStorage.getItem(STORAGE_KEY);
    if (fromSession) {
      inMemoryToken = fromSession;
      return fromSession;
    }
  } catch {
    // sessionStorage unavailable
  }
  return null;
}

export function setUpstoxSessionToken(token: string): void {
  const clean = token.trim();
  inMemoryToken = clean;
  try {
    localStorage.setItem(STORAGE_KEY, clean);
  } catch {
    // ignored
  }
  try {
    sessionStorage.setItem(STORAGE_KEY, clean);
  } catch {
    // ignored
  }
}

export function clearUpstoxSessionToken(): void {
  inMemoryToken = null;
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignored
  }
  try {
    sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignored
  }
}

function getAuthHeaders(tokenOverride?: string): Record<string, string> {
  const token = tokenOverride || getUpstoxSessionToken();
  const headers: Record<string, string> = {
    Accept: 'application/json',
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
}

/**
 * Ping /api/upstox/status to test connectivity with Upstox API
 */
export async function checkUpstoxStatus(tokenOverride?: string): Promise<UpstoxConnectionState> {
  try {
    const res = await fetch('/api/upstox/status', {
      headers: getAuthHeaders(tokenOverride),
    });
    const data = await res.json();
    return {
      connected: Boolean(data.connected),
      latency_ms: data.latency_ms,
      hasServerToken: Boolean(data.hasServerToken),
      message: data.message,
      error: data.error,
      lastUpdated: new Date().toLocaleTimeString('en-IN'),
    };
  } catch (err: any) {
    return {
      connected: false,
      hasServerToken: false,
      error: err.message || 'Network error reaching Upstox proxy endpoint',
    };
  }
}

/**
 * Fetch live market quotes for given instrument keys
 */
export async function fetchUpstoxLiveQuotes(
  instrumentKeys: string[],
  tokenOverride?: string
): Promise<Record<string, UpstoxLiveQuote>> {
  if (instrumentKeys.length === 0) return {};

  const query = instrumentKeys.map(encodeURIComponent).join(',');
  const res = await fetch(`/api/upstox/quotes?instrument_keys=${query}`, {
    headers: getAuthHeaders(tokenOverride),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `Upstox API returned status ${res.status}`);
  }

  const json = await res.json();
  const data = json.data || {};
  const result: Record<string, UpstoxLiveQuote> = {};

  for (const [key, quote] of Object.entries<any>(data)) {
    // Upstox key might be like "NSE_EQ:RELIANCE" or "RELIANCE" or "NSE_EQ|INE002A01018"
    const symbolParts = key.split(':');
    const symbolFromKey = symbolParts.length > 1 ? symbolParts[1] : key;
    const finalSymbol = (quote.symbol || symbolFromKey || key).toUpperCase();

    const quoteObj: UpstoxLiveQuote = {
      symbol: finalSymbol,
      instrument_key: quote.instrument_token || key,
      last_price: Number(quote.last_price || 0),
      volume: Number(quote.volume || 0),
      open: quote.ohlc?.open ? Number(quote.ohlc.open) : undefined,
      high: quote.ohlc?.high ? Number(quote.ohlc.high) : undefined,
      low: quote.ohlc?.low ? Number(quote.ohlc.low) : undefined,
      close: quote.ohlc?.close ? Number(quote.ohlc.close) : undefined,
      net_change: quote.net_change ? Number(quote.net_change) : undefined,
      timestamp: quote.timestamp ? Number(quote.timestamp) : Date.now(),
    };

    result[finalSymbol] = quoteObj;
    result[key] = quoteObj;
    if (quote.symbol) result[quote.symbol.toUpperCase()] = quoteObj;
    if (quote.instrument_token) result[quote.instrument_token] = quoteObj;
  }

  return result;
}

/**
 * Fetch real intraday candles for an instrument
 */
export async function fetchUpstoxLiveCandles(
  instrumentKey: string,
  interval: '1minute' | '30minute' = '1minute',
  tokenOverride?: string
): Promise<Candle[]> {
  const res = await fetch(
    `/api/upstox/candles?instrument_key=${encodeURIComponent(instrumentKey)}&interval=${encodeURIComponent(interval)}`,
    {
      headers: getAuthHeaders(tokenOverride),
    }
  );

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `Failed to fetch Upstox candles: status ${res.status}`);
  }

  const json = await res.json();
  return json.candles || [];
}
