import { SystemMonitorEvent } from '../../types/platform';

class SystemMonitorAgent {
  private events: SystemMonitorEvent[] = [];

  record(
    correlationId: string,
    component: string,
    eventType: string,
    details: Record<string, any>,
    latencyMs: number = 0,
    severity: 'INFO' | 'WARN' | 'ERROR' = 'INFO'
  ): SystemMonitorEvent {
    // Redact secret keys or tokens
    const safeDetails: Record<string, any> = {};
    for (const [k, v] of Object.entries(details)) {
      const lower = k.toLowerCase();
      if (
        lower.includes('key') ||
        lower.includes('token') ||
        lower.includes('secret') ||
        lower.includes('password')
      ) {
        safeDetails[k] = '***REDACTED***';
      } else {
        safeDetails[k] = v;
      }
    }

    const event: SystemMonitorEvent = {
      id: `evt-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      timestamp: new Date().toISOString(),
      correlation_id: correlationId,
      component,
      event_type: eventType,
      severity,
      latency_ms: latencyMs,
      details: safeDetails,
    };

    this.events.unshift(event);
    if (this.events.length > 200) {
      this.events = this.events.slice(0, 200);
    }
    return event;
  }

  getRecentEvents(limit: number = 50): SystemMonitorEvent[] {
    return this.events.slice(0, limit);
  }

  clear() {
    this.events = [];
  }
}

export const SYSTEM_MONITOR = new SystemMonitorAgent();
