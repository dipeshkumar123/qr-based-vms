import { HttpError } from "./httpError.js";

type CircuitState = "closed" | "open" | "half_open";

type CircuitBreakerOptions = {
  name: string;
  failureThreshold: number;
  resetTimeoutMs: number;
  halfOpenSuccesses: number;
  unavailableMessage: string;
  unavailableCode: string;
  shouldCountFailure?: (error: unknown) => boolean;
};

export class CircuitBreaker {
  private state: CircuitState = "closed";
  private failureCount = 0;
  private halfOpenSuccessCount = 0;
  private openedAt = 0;

  constructor(private readonly options: CircuitBreakerOptions) {}

  async execute<T>(operation: () => Promise<T>): Promise<T> {
    if (this.state === "open") {
      const elapsed = Date.now() - this.openedAt;
      if (elapsed < this.options.resetTimeoutMs) {
        throw new HttpError(503, this.options.unavailableMessage, this.options.unavailableCode);
      }
      this.state = "half_open";
      this.halfOpenSuccessCount = 0;
    }

    try {
      const result = await operation();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure(error);
      throw error;
    }
  }

  private onSuccess() {
    if (this.state === "half_open") {
      this.halfOpenSuccessCount += 1;
      if (this.halfOpenSuccessCount >= this.options.halfOpenSuccesses) {
        this.closeCircuit();
      }
      return;
    }

    if (this.state === "closed") {
      this.failureCount = 0;
    }
  }

  private onFailure(error: unknown) {
    const shouldCount = this.options.shouldCountFailure
      ? this.options.shouldCountFailure(error)
      : true;

    if (!shouldCount) {
      return;
    }

    if (this.state === "half_open") {
      this.openCircuit();
      return;
    }

    this.failureCount += 1;
    if (this.failureCount >= this.options.failureThreshold) {
      this.openCircuit();
    }
  }

  private openCircuit() {
    this.state = "open";
    this.openedAt = Date.now();
    this.failureCount = 0;
    this.halfOpenSuccessCount = 0;
  }

  private closeCircuit() {
    this.state = "closed";
    this.failureCount = 0;
    this.halfOpenSuccessCount = 0;
    this.openedAt = 0;
  }

  snapshot() {
    return {
      name: this.options.name,
      state: this.state,
      failureCount: this.failureCount,
      openedAt: this.openedAt || null,
    };
  }
}
