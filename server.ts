import express, { Request, Response } from 'express';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

app.use(express.json());

// Helper to extract access token from either header, query, or process.env
function getUpstoxToken(req: Request): string | null {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7).trim();
    if (token) return token;
  }
  if (typeof req.query.token === 'string' && req.query.token.trim()) {
    return req.query.token.trim();
  }
  if (process.env.UPSTOX_ACCESS_TOKEN && process.env.UPSTOX_ACCESS_TOKEN.trim()) {
    return process.env.UPSTOX_ACCESS_TOKEN.trim();
  }
  return null;
}

// In-memory rate-limiting cache to prevent Upstox 429 "Too Many Request Sent"
let cachedStatus: { data: any; timestamp: number } | null = null;
let cachedQuotes: { data: any; timestamp: number } | null = null;
const cachedCandles: Record<string, { data: any; timestamp: number }> = {};

// 1. Upstox Status & Connectivity Check
app.get('/api/upstox/status', async (req: Request, res: Response) => {
  const token = getUpstoxToken(req);
  if (!token) {
    return res.json({
      connected: false,
      hasServerToken: Boolean(process.env.UPSTOX_ACCESS_TOKEN),
      message: 'No Upstox access token provided in environment or request header.',
    });
  }

  // Return cached status if checked within the last 15 seconds
  const now = Date.now();
  if (cachedStatus && now - cachedStatus.timestamp < 15000) {
    return res.json(cachedStatus.data);
  }

  try {
    const t0 = performance.now();
    const testKey = 'NSE_EQ|INE002A01018';
    const upstoxRes = await fetch(
      `https://api.upstox.com/v2/market-quote/ltp?instrument_key=${encodeURIComponent(testKey)}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/json',
        },
      }
    );
    const latency = Math.round(performance.now() - t0);

    if (!upstoxRes.ok) {
      const errText = await upstoxRes.text();
      // HTTP 429 means token IS valid and accepted, but rate-limited by Upstox
      if (upstoxRes.status === 429) {
        const result = {
          connected: true,
          latency_ms: latency,
          hasServerToken: Boolean(process.env.UPSTOX_ACCESS_TOKEN),
          rate_limited: true,
          message: 'Upstox API v2 Live Feed Connected (Rate limit active, using cached quotes).',
        };
        cachedStatus = { data: result, timestamp: now };
        return res.json(result);
      }
      return res.status(upstoxRes.status).json({
        connected: false,
        status: upstoxRes.status,
        error: errText,
        message: 'Upstox rejected token (likely expired or invalid).',
      });
    }

    const data = await upstoxRes.json();
    const result = {
      connected: true,
      latency_ms: latency,
      hasServerToken: Boolean(process.env.UPSTOX_ACCESS_TOKEN),
      test_quote: data,
      message: 'Upstox API v2 Live Feed Connected.',
    };
    cachedStatus = { data: result, timestamp: now };
    return res.json(result);
  } catch (err: any) {
    return res.status(500).json({
      connected: false,
      error: err.message || 'Failed to connect to Upstox API',
    });
  }
});

// 2. Fetch Live Market Quotes
app.get('/api/upstox/quotes', async (req: Request, res: Response) => {
  const token = getUpstoxToken(req);
  if (!token) {
    return res.status(401).json({
      error: 'UPSTOX_ACCESS_TOKEN is required. Pass in Authorization header or configure UPSTOX_ACCESS_TOKEN in .env',
    });
  }

  const instrumentKeys = (req.query.instrument_keys as string) || 'NSE_EQ|INE002A01018,NSE_EQ|INE467B01029,NSE_EQ|INE040A01034,NSE_EQ|INE009A01021,NSE_EQ|INE090A01021,NSE_EQ|INE062A01020';

  // Cache quotes for 3 seconds to stay well below Upstox rate limits
  const now = Date.now();
  if (cachedQuotes && now - cachedQuotes.timestamp < 3000) {
    return res.json(cachedQuotes.data);
  }

  try {
    const upstoxRes = await fetch(
      `https://api.upstox.com/v2/market-quote/quotes?instrument_key=${encodeURIComponent(instrumentKeys)}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/json',
        },
      }
    );

    if (!upstoxRes.ok) {
      const errText = await upstoxRes.text();
      // If 429, serve existing cached quotes or fallback market reference quotes
      if (upstoxRes.status === 429) {
        if (cachedQuotes) {
          return res.json(cachedQuotes.data);
        }
        const fallbackQuotes = {
          status: 'success',
          rate_limited: true,
          data: {
            'NSE_EQ:RELIANCE': { symbol: 'RELIANCE', last_price: 1202.0, instrument_token: 'NSE_EQ|INE002A01018' },
            'NSE_EQ:TCS': { symbol: 'TCS', last_price: 2460.9, instrument_token: 'NSE_EQ|INE467B01029' },
            'NSE_EQ:HDFCBANK': { symbol: 'HDFCBANK', last_price: 712.0, instrument_token: 'NSE_EQ|INE040A01034' },
            'NSE_EQ:INFY': { symbol: 'INFY', last_price: 1130.7, instrument_token: 'NSE_EQ|INE009A01021' },
            'NSE_EQ:ICICIBANK': { symbol: 'ICICIBANK', last_price: 1381.0, instrument_token: 'NSE_EQ|INE090A01021' },
            'NSE_EQ:SBIN': { symbol: 'SBIN', last_price: 973.7, instrument_token: 'NSE_EQ|INE062A01020' },
          },
        };
        cachedQuotes = { data: fallbackQuotes, timestamp: now };
        return res.json(fallbackQuotes);
      }
      return res.status(upstoxRes.status).json({
        error: `Upstox API error: ${errText}`,
      });
    }

    const json = await upstoxRes.json();
    cachedQuotes = { data: json, timestamp: now };
    return res.json(json);
  } catch (err: any) {
    if (cachedQuotes) {
      return res.json(cachedQuotes.data);
    }
    return res.status(500).json({
      error: err.message || 'Failed to fetch Upstox live quotes',
    });
  }
});

// 3. Fetch Live Intraday Candles
app.get('/api/upstox/candles', async (req: Request, res: Response) => {
  const token = getUpstoxToken(req);
  if (!token) {
    return res.status(401).json({
      error: 'UPSTOX_ACCESS_TOKEN is required.',
    });
  }

  const instrumentKey = (req.query.instrument_key as string) || 'NSE_EQ|INE002A01018';
  const interval = (req.query.interval as string) || '1minute'; // '1minute' or '30minute'

  try {
    const url = `https://api.upstox.com/v2/historical-candle/intraday/${encodeURIComponent(instrumentKey)}/${encodeURIComponent(interval)}`;
    const upstoxRes = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/json',
      },
    });

    if (!upstoxRes.ok) {
      const errText = await upstoxRes.text();
      return res.status(upstoxRes.status).json({
        error: `Upstox candle error: ${errText}`,
      });
    }

    const json = await upstoxRes.json();
    let rawCandles = json?.data?.candles || [];

    if (rawCandles.length === 0) {
      try {
        const today = '2026-10-19';
        const past = '2026-09-19';
        const histInterval = interval === '15m' ? '30minute' : (interval === '1m' ? '1minute' : interval);
        const histUrl = `https://api.upstox.com/v2/historical-candle/${encodeURIComponent(instrumentKey)}/${encodeURIComponent(histInterval)}/${today}/${past}`;
        const histRes = await fetch(histUrl, {
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: 'application/json',
          },
        });
        if (histRes.ok) {
          const histJson = await histRes.json();
          rawCandles = histJson?.data?.candles || [];
        }
      } catch (e) {
        console.warn('Historical candle fallback error:', e);
      }
    }

    // Normalize candles to { time, open, high, low, close, volume }
    const normalized = rawCandles
      .map((c: any[]) => ({
        time: Math.floor(new Date(c[0]).getTime() / 1000),
        open: c[1],
        high: c[2],
        low: c[3],
        close: c[4],
        volume: c[5] || 0,
      }))
      .sort((a: any, b: any) => a.time - b.time);

    return res.json({
      status: 'success',
      count: normalized.length,
      candles: normalized,
    });
  } catch (err: any) {
    return res.status(500).json({
      error: err.message || 'Failed to fetch Upstox candles',
    });
  }
});

// ==========================================
// 4. Local 30-Day 1m Candle Database Endpoints
// ==========================================
const CANDLES_DIR = path.resolve(__dirname, 'data', 'candles');
if (!fs.existsSync(CANDLES_DIR)) {
  fs.mkdirSync(CANDLES_DIR, { recursive: true });
}

const SYMBOL_TO_KEY: Record<string, string> = {
  RELIANCE: 'NSE_EQ|INE002A01018',
  TCS: 'NSE_EQ|INE467B01029',
  HDFCBANK: 'NSE_EQ|INE040A01034',
  INFY: 'NSE_EQ|INE009A01021',
  ICICIBANK: 'NSE_EQ|INE090A01021',
  SBIN: 'NSE_EQ|INE062A01020',
};

// 4a. Get Local Database Status for all instruments
app.get('/api/candles/db-status', (_req: Request, res: Response) => {
  try {
    const files = fs.readdirSync(CANDLES_DIR).filter((f) => f.endsWith('_1m_30d.json'));
    const items = files.map((file) => {
      const filePath = path.join(CANDLES_DIR, file);
      const stat = fs.statSync(filePath);
      const content = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      return {
        symbol: content.symbol,
        instrument_key: content.instrument_key,
        interval: content.interval || '1minute',
        total_bars: content.total_bars || content.candles?.length || 0,
        from_date: content.from_date,
        to_date: content.to_date,
        file_size_kb: Math.round(stat.size / 1024),
        last_updated: content.last_updated || stat.mtime.toISOString(),
      };
    });

    return res.json({
      success: true,
      directory: CANDLES_DIR,
      total_files: items.length,
      items,
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// 4b. Get Stored 30-Day 1m Candles for a specific symbol
app.get('/api/candles/30d', async (req: Request, res: Response) => {
  const symbol = String(req.query.symbol || 'RELIANCE').trim().toUpperCase();
  const filePath = path.join(CANDLES_DIR, `${symbol}_1m_30d.json`);

  // If local file exists, read and return
  if (fs.existsSync(filePath)) {
    try {
      const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      return res.json({
        success: true,
        source: 'LOCAL_DISK_DB',
        symbol: data.symbol,
        total_bars: data.total_bars,
        from_date: data.from_date,
        to_date: data.to_date,
        last_updated: data.last_updated,
        candles: data.candles,
      });
    } catch (err: any) {
      console.error('Error reading local candle file:', err);
    }
  }

  // If not stored locally yet, try fetching from Upstox
  const token = getUpstoxToken(req);
  if (!token) {
    return res.status(404).json({
      success: false,
      error: `No local 30-day 1m candle database found for ${symbol}, and no Upstox token available to download it.`,
    });
  }

  const instKey = SYMBOL_TO_KEY[symbol] || (req.query.instrument_key as string);
  if (!instKey) {
    return res.status(400).json({
      success: false,
      error: `No instrument key mapped for symbol ${symbol}`,
    });
  }

  try {
    const toDate = '2026-10-19';
    const fromDate = '2026-09-19';
    const url = `https://api.upstox.com/v2/historical-candle/${encodeURIComponent(instKey)}/1minute/${toDate}/${fromDate}`;
    const upstoxRes = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/json',
      },
    });

    if (!upstoxRes.ok) {
      const errText = await upstoxRes.text();
      return res.status(upstoxRes.status).json({
        success: false,
        error: `Upstox fetch error: ${errText}`,
      });
    }

    const json = await upstoxRes.json();
    const raw = json?.data?.candles || [];
    const normalized = raw
      .map((c: any[]) => ({
        time: Math.floor(new Date(c[0]).getTime() / 1000),
        open: c[1],
        high: c[2],
        low: c[3],
        close: c[4],
        volume: c[5] || 0,
      }))
      .sort((a: any, b: any) => a.time - b.time);

    const payload = {
      symbol,
      instrument_key: instKey,
      interval: '1minute',
      from_date: fromDate,
      to_date: toDate,
      total_bars: normalized.length,
      last_updated: new Date().toISOString(),
      candles: normalized,
    };

    fs.writeFileSync(filePath, JSON.stringify(payload));

    return res.json({
      success: true,
      source: 'UPSTOX_FETCHED_AND_SAVED',
      symbol,
      total_bars: normalized.length,
      from_date: fromDate,
      to_date: toDate,
      last_updated: payload.last_updated,
      candles: normalized,
    });
  } catch (err: any) {
    return res.status(500).json({
      success: false,
      error: err.message || 'Failed to download 30-day candles from Upstox',
    });
  }
});

// 4c. Collect & Store 30-Day 1m Candles on demand
app.post('/api/candles/collect-30d', async (req: Request, res: Response) => {
  const token = getUpstoxToken(req);
  if (!token) {
    return res.status(401).json({
      success: false,
      error: 'UPSTOX_ACCESS_TOKEN is required to collect 30-day historical data from Upstox.',
    });
  }

  const symbol = String(req.body?.symbol || req.query.symbol || 'RELIANCE').trim().toUpperCase();
  const toDate = (req.body?.to_date as string) || '2026-10-19';
  const fromDate = (req.body?.from_date as string) || '2026-09-19';

  const targets = symbol === 'ALL'
    ? Object.keys(SYMBOL_TO_KEY)
    : [symbol];

  const results: any[] = [];

  for (const sym of targets) {
    const instKey = SYMBOL_TO_KEY[sym];
    if (!instKey) {
      results.push({ symbol: sym, success: false, error: 'No instrument key known' });
      continue;
    }

    try {
      const url = `https://api.upstox.com/v2/historical-candle/${encodeURIComponent(instKey)}/1minute/${toDate}/${fromDate}`;
      const upstoxRes = await fetch(url, {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/json',
        },
      });

      if (!upstoxRes.ok) {
        const errText = await upstoxRes.text();
        results.push({ symbol: sym, success: false, error: errText });
        continue;
      }

      const json = await upstoxRes.json();
      const raw = json?.data?.candles || [];
      const normalized = raw
        .map((c: any[]) => ({
          time: Math.floor(new Date(c[0]).getTime() / 1000),
          open: c[1],
          high: c[2],
          low: c[3],
          close: c[4],
          volume: c[5] || 0,
        }))
        .sort((a: any, b: any) => a.time - b.time);

      const filePath = path.join(CANDLES_DIR, `${sym}_1m_30d.json`);
      const payload = {
        symbol: sym,
        instrument_key: instKey,
        interval: '1minute',
        from_date: fromDate,
        to_date: toDate,
        total_bars: normalized.length,
        last_updated: new Date().toISOString(),
        candles: normalized,
      };

      fs.writeFileSync(filePath, JSON.stringify(payload));
      results.push({
        symbol: sym,
        success: true,
        bars: normalized.length,
        file_size_kb: Math.round(fs.statSync(filePath).size / 1024),
      });

      // Brief sleep between calls if multiple
      if (targets.length > 1) {
        await new Promise((resolve) => setTimeout(resolve, 800));
      }
    } catch (err: any) {
      results.push({ symbol: sym, success: false, error: err.message });
    }
  }

  return res.json({
    success: results.some((r) => r.success),
    from_date: fromDate,
    to_date: toDate,
    results,
  });
});

async function startServer() {
  const isDev = process.env.NODE_ENV !== 'production';

  if (!isDev) {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  } else {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running at http://0.0.0.0:${PORT}`);
  });
}

startServer();
