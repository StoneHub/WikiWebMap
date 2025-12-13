export interface ConnectionLog {
  id: string;
  source: string;
  target: string;
  timestamp: number;
  type: 'manual' | 'auto' | 'expand' | 'path';
  weight?: number;
}

const STORAGE_KEY = 'wikiweb_connection_logs';

export class ConnectionLogger {
  private logs: ConnectionLog[] = [];

  constructor() {
    this.loadLogs();
  }

  private loadLogs() {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        this.logs = JSON.parse(stored);
      }
    } catch (e) {
      console.error('Failed to load connection logs', e);
      this.logs = [];
    }
  }

  private saveLogs() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.logs));
    } catch (e) {
      console.error('Failed to save connection logs', e);
    }
  }

  public log(source: string, target: string, type: ConnectionLog['type'], weight: number = 1) {
    // Avoid duplicate log entries for the very same connection within a short timeframe?
    // For now, we log everything as a history record.
    const newLog: ConnectionLog = {
      id: crypto.randomUUID(),
      source,
      target,
      timestamp: Date.now(),
      type,
      weight
    };

    this.logs.push(newLog);
    this.saveLogs();
  }

  public getLogs(): ConnectionLog[] {
    return this.logs;
  }

  public clearLogs() {
    this.logs = [];
    this.saveLogs();
  }

  public exportCSV(): string {
    const headers = ['Timestamp', 'Source', 'Target', 'Type', 'Weight'];
    const rows = this.logs.map(log => [
      new Date(log.timestamp).toISOString(),
      `"${log.source.replace(/"/g, '""')}"`,
      `"${log.target.replace(/"/g, '""')}"`,
      log.type,
      log.weight
    ]);

    return [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
  }

  public getStats() {
    return {
      total: this.logs.length,
      breakdown: this.logs.reduce((acc, log) => {
        acc[log.type] = (acc[log.type] || 0) + 1;
        return acc;
      }, {} as Record<string, number>)
    };
  }
}

export const connectionLogger = new ConnectionLogger();
