// ---------------------------------------------------------------------------
// Simple in-memory concurrency-limited queue for IMAP operations.
// Prevents hammering the IMAP server with too many parallel requests.
// ---------------------------------------------------------------------------

export class RateLimitedQueue {
  private running = 0;
  private waiting: Array<() => void> = [];

  constructor(private readonly maxConcurrency: number) {}

  async run<T>(fn: () => Promise<T>): Promise<T> {
    await this.acquire();
    try {
      return await fn();
    } finally {
      this.release();
    }
  }

  private acquire(): Promise<void> {
    if (this.running < this.maxConcurrency) {
      this.running++;
      return Promise.resolve();
    }
    return new Promise<void>((resolve) => {
      this.waiting.push(resolve);
    });
  }

  private release(): void {
    this.running--;
    const next = this.waiting.shift();
    if (next) {
      this.running++;
      next();
    }
  }

  get pending(): number {
    return this.waiting.length;
  }

  get active(): number {
    return this.running;
  }
}
