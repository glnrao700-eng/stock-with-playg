import { Candle } from '../types/platform';

const DB_NAME = 'IMMIP_LocalMarketDB';
const DB_VERSION = 1;
const STORE_NAME = 'historical_1m_candles';

export interface StoredHistoricalRecord {
  symbol: string;
  instrument_key: string;
  interval: '1minute';
  total_bars: number;
  from_date: string;
  to_date: string;
  last_updated: string;
  candles: Candle[];
}

export interface CandleDbStatusItem {
  symbol: string;
  instrument_key: string;
  interval: string;
  total_bars: number;
  from_date: string;
  to_date: string;
  file_size_kb: number;
  last_updated: string;
  in_browser_idb?: boolean;
}

/**
 * Open or initialize browser IndexedDB
 */
function openIndexedDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      return reject(new Error('IndexedDB not supported in this environment'));
    }

    const request = window.indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'symbol' });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('Failed to open IndexedDB'));
  });
}

/**
 * Save candles into browser IndexedDB
 */
export async function saveToIndexedDB(record: StoredHistoricalRecord): Promise<void> {
  try {
    const db = await openIndexedDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.put(record);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.warn('IndexedDB save notice (non-fatal):', err);
  }
}

/**
 * Retrieve candles from browser IndexedDB
 */
export async function getFromIndexedDB(symbol: string): Promise<StoredHistoricalRecord | null> {
  try {
    const db = await openIndexedDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(symbol.toUpperCase());
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.warn('IndexedDB read notice:', err);
    return null;
  }
}

/**
 * Fetch 30-day 1-minute historical candles.
 * First checks IndexedDB (instant offline).
 * If not present or forceRefresh=true, fetches from server endpoint /api/candles/30d and syncs into IndexedDB!
 */
export async function load30DayHistoricalCandles(
  symbol: string,
  forceRefresh: boolean = false
): Promise<{ candles: Candle[]; source: string; total_bars: number; from_date: string; to_date: string }> {
  const cleanSymbol = symbol.trim().toUpperCase();

  // 1. Check browser IndexedDB if not forcing refresh
  if (!forceRefresh) {
    const cachedIdb = await getFromIndexedDB(cleanSymbol);
    if (cachedIdb && cachedIdb.candles && cachedIdb.candles.length > 0) {
      return {
        candles: cachedIdb.candles,
        source: 'BROWSER_INDEXED_DB',
        total_bars: cachedIdb.total_bars || cachedIdb.candles.length,
        from_date: cachedIdb.from_date,
        to_date: cachedIdb.to_date,
      };
    }
  }

  // 2. Fetch from server endpoint
  const res = await fetch(`/api/candles/30d?symbol=${encodeURIComponent(cleanSymbol)}`);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `Server returned ${res.status}`);
  }

  const data = await res.json();
  const candles: Candle[] = data.candles || [];

  // 3. Save into browser IndexedDB for instant future loads
  if (candles.length > 0) {
    await saveToIndexedDB({
      symbol: cleanSymbol,
      instrument_key: data.instrument_key || `NSE_${cleanSymbol}`,
      interval: '1minute',
      total_bars: candles.length,
      from_date: data.from_date,
      to_date: data.to_date,
      last_updated: data.last_updated || new Date().toISOString(),
      candles,
    });
  }

  return {
    candles,
    source: data.source || 'LOCAL_SERVER_DB',
    total_bars: candles.length,
    from_date: data.from_date,
    to_date: data.to_date,
  };
}

/**
 * Get summary status of all 30-day databases on the server and in IndexedDB
 */
export async function getHistoricalDbStatus(): Promise<CandleDbStatusItem[]> {
  const res = await fetch('/api/candles/db-status');
  if (!res.ok) {
    throw new Error(`Failed to fetch database status: ${res.status}`);
  }
  const data = await res.json();
  const items: CandleDbStatusItem[] = data.items || [];

  // Augment with IndexedDB local presence
  for (const item of items) {
    try {
      const idb = await getFromIndexedDB(item.symbol);
      item.in_browser_idb = Boolean(idb && idb.candles?.length);
    } catch {
      item.in_browser_idb = false;
    }
  }

  return items;
}

/**
 * Trigger collection of 30-day historical data on the server
 */
export async function triggerCollect30Days(symbol: string = 'ALL'): Promise<any> {
  const res = await fetch(`/api/candles/collect-30d?symbol=${encodeURIComponent(symbol)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ symbol }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `Failed to collect candles: ${res.status}`);
  }
  return res.json();
}

/**
 * Export candles to CSV file download
 */
export function exportCandlesToCSV(symbol: string, candles: Candle[]): void {
  if (!candles || candles.length === 0) return;

  const header = 'Timestamp,DateTime_IST,Open,High,Low,Close,Volume\n';
  const rows = candles.map((c) => {
    const dateStr = new Date(c.time * 1000).toLocaleString('en-IN', {
      timeZone: 'Asia/Kolkata',
      hour12: false,
    });
    return `${c.time},"${dateStr}",${c.open.toFixed(2)},${c.high.toFixed(2)},${c.low.toFixed(2)},${c.close.toFixed(2)},${c.volume}`;
  });

  const csvContent = header + rows.join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', `${symbol}_1m_30days_${candles.length}bars.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Export candles to JSON file download
 */
export function exportCandlesToJSON(symbol: string, candles: Candle[]): void {
  if (!candles || candles.length === 0) return;

  const payload = {
    symbol,
    interval: '1minute',
    total_bars: candles.length,
    exported_at: new Date().toISOString(),
    candles,
  };

  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', `${symbol}_1m_30days_${candles.length}bars.json`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
