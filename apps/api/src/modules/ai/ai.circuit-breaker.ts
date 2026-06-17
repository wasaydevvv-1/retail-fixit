import { logger } from '../../observability/logger.js';

const FAILURE_THRESHOLD = 3;
const OPEN_MS = 30_000;

/** Opens after repeated failures so we fail fast to rule-based fallback. */
class AiCircuitBreaker {
  private failures = 0;
  private openedAt: number | null = null;

  isOpen(): boolean {
    if (this.openedAt === null) return false;
    if (Date.now() - this.openedAt >= OPEN_MS) {
      this.reset();
      return false;
    }
    return true;
  }

  recordSuccess(): void {
    this.failures = 0;
    this.openedAt = null;
  }

  recordFailure(): void {
    this.failures += 1;
    if (this.failures >= FAILURE_THRESHOLD) {
      this.openedAt = Date.now();
      logger.warn(
        { failures: this.failures, cooldownMs: OPEN_MS },
        'AI circuit breaker opened — using fallback',
      );
    }
  }

  reset(): void {
    this.failures = 0;
    this.openedAt = null;
  }
}

export const aiCircuitBreaker = new AiCircuitBreaker();
