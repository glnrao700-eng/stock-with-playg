import { SessionStatus } from '../types/platform';

export const NSE_HOLIDAYS_2025_2026: Set<string> = new Set([
  '2026-01-26', // Republic Day
  '2026-03-03', // Holi
  '2026-03-30', // Id-Ul-Fitr
  '2026-04-03', // Good Friday
  '2026-04-14', // Dr. Baba Saheb Ambedkar Jayanti
  '2026-05-01', // Maharashtra Day
  '2026-08-15', // Independence Day
  '2026-10-02', // Mahatma Gandhi Jayanti
  '2026-10-20', // Dussehra
  '2026-11-09', // Diwali Laxmi Pujan
  '2026-11-10', // Diwali Balipratipada
  '2026-11-24', // Gurunanak Jayanti
  '2026-12-25', // Christmas
  // 2025 holidays
  '2025-01-26',
  '2025-03-14',
  '2025-03-31',
  '2025-04-10',
  '2025-04-14',
  '2025-04-18',
  '2025-05-01',
  '2025-08-15',
  '2025-08-27',
  '2025-10-02',
  '2025-10-21',
  '2025-10-22',
  '2025-11-05',
  '2025-12-25',
]);

export function isTradingDay(dateStr: string): boolean {
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  const day = dt.getUTCDay();
  // Saturday = 6, Sunday = 0
  if (day === 0 || day === 6) return false;
  if (NSE_HOLIDAYS_2025_2026.has(dateStr)) return false;
  return true;
}

export function getNextTradingDay(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));

  let candidate = new Date(dt.getTime() + 86400000);
  while (true) {
    const yr = candidate.getUTCFullYear();
    const mo = String(candidate.getUTCMonth() + 1).padStart(2, '0');
    const da = String(candidate.getUTCDate()).padStart(2, '0');
    const candStr = `${yr}-${mo}-${da}`;
    if (isTradingDay(candStr)) {
      return candStr;
    }
    candidate = new Date(candidate.getTime() + 86400000);
  }
}

export function getSessionWindowStatus(now: Date = new Date()): SessionStatus {
  // Format in IST (Asia/Kolkata is UTC+5:30)
  const istOffset = 5.5 * 60 * 60 * 1000;
  const istTime = new Date(now.getTime() + istOffset);

  const yr = istTime.getUTCFullYear();
  const mo = String(istTime.getUTCMonth() + 1).padStart(2, '0');
  const da = String(istTime.getUTCDate()).padStart(2, '0');
  const sessionDate = `${yr}-${mo}-${da}`;

  const hours = istTime.getUTCHours();
  const minutes = istTime.getUTCMinutes();
  const seconds = istTime.getUTCSeconds();
  const timeInMinutes = hours * 60 + minutes;

  const tradingDay = isTradingDay(sessionDate);
  const nextTradingDay = getNextTradingDay(sessionDate);

  let phase = 'OFF_MARKET_HOLIDAY_OR_WEEKEND';
  let allowEntries = false;

  if (!tradingDay) {
    phase = 'OFF_MARKET_HOLIDAY_OR_WEEKEND';
  } else if (timeInMinutes < 9 * 60 + 15) {
    phase = 'PRE_OPEN_PREPARATION';
  } else if (timeInMinutes >= 9 * 60 + 15 && timeInMinutes < 9 * 60 + 30) {
    phase = 'MARKET_OPEN_WARMUP';
  } else if (timeInMinutes >= 9 * 60 + 30 && timeInMinutes < 15 * 60 + 30) {
    phase = 'INTRADAY_ACTIVE_ANALYSIS';
    allowEntries = timeInMinutes <= 15 * 60 + 10;
  } else if (timeInMinutes >= 15 * 60 + 30 && timeInMinutes <= 16 * 60) {
    phase = 'EOD_NEXT_OPEN_FORECASTING';
  } else {
    phase = 'POST_MARKET_MAINTENANCE';
  }

  const istFormatted = `${sessionDate} ${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')} IST`;

  const isMarketOpen = tradingDay && timeInMinutes >= 9 * 60 + 15 && timeInMinutes < 15 * 60 + 30;

  return {
    utc_timestamp: now.toISOString(),
    ist_timestamp: istFormatted,
    session_date: sessionDate,
    is_trading_day: tradingDay,
    next_trading_day: nextTradingDay,
    phase,
    allow_new_intraday_entries: allowEntries,
    is_market_open: isMarketOpen,
  };
}
