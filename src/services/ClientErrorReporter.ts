export type ClientErrorRecord = {
  id: string;
  timestamp: number;
  source: 'window.error' | 'unhandledrejection' | 'manual';
  message: string;
  detail?: string;
  stack?: string;
  url?: string;
  line?: number;
  column?: number;
};

class ClientErrorReporter {
  private readonly maxEntries = 50;
  private records: ClientErrorRecord[] = [];

  getErrors(): ClientErrorRecord[] {
    return [...this.records];
  }

  clear(): void {
    this.records = [];
  }

  report(record: Omit<ClientErrorRecord, 'id' | 'timestamp'> & { timestamp?: number }): void {
    const entry: ClientErrorRecord = {
      id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
      timestamp: record.timestamp ?? Date.now(),
      ...record,
    };

    this.records = [entry, ...this.records].slice(0, this.maxEntries);
  }

  reportError(error: unknown, context?: string): void {
    if (error instanceof Error) {
      this.report({
        source: 'manual',
        message: context ? `${context}: ${error.message}` : error.message,
        detail: error.name,
        stack: error.stack,
      });
      return;
    }

    this.report({
      source: 'manual',
      message: context || 'Unknown client error',
      detail: typeof error === 'string' ? error : JSON.stringify(error),
    });
  }
}

export const clientErrorReporter = new ClientErrorReporter();
