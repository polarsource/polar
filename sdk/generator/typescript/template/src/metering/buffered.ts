import { setTimeout as sleep } from "node:timers/promises";

import type { EventInput } from "./event";

import {
  PolarError,
  PolarNetworkError,
  PolarRateLimitError,
  PolarServerError,
  type RequestOptions,
} from "../base";

export type DropReason = "retry_exhausted" | "shutdown_timeout" | "permanent_error";

const RETRY_AFTER_BUDGET_MS = 300_000;

export interface MeteringClient {
  events: {
    ingest(body: { events: EventInput[] }, options?: RequestOptions): Promise<unknown>;
  };
}

/**
 * Configure in-memory batching and delivery to Polar.
 */
export interface BufferedMeteringOptions {
  /**
   * Maximum events per request. Defaults to 100.
   */
  batchSize?: number;
  /**
   * Milliseconds to collect a batch after its first event. Defaults to 1000.
   */
  batchIntervalMs?: number;
  /**
   * Milliseconds allowed to drain on exit. Defaults to 5000.
   */
  shutdownTimeoutMs?: number;
  /**
   * Total delivery attempts per batch, including the first. Defaults to 3.
   */
  maxAttempts?: number;
  /**
   * Callback for events Polar accepted; may be async.
   */
  onDelivered?: (events: EventInput[]) => void | Promise<void>;
  /**
   * Callback for undelivered events and their DropReason; may be async.
   * Defaults to undefined; drops are always logged.
   */
  onDropped?: (events: EventInput[], reason: DropReason) => void | Promise<void>;
}

class FlushRequest {
  resolve!: () => void;
  reject!: (error: Error) => void;
  readonly completed = new Promise<void>((resolve, reject) => {
    this.resolve = resolve;
    this.reject = reject;
  });
}

/**
 * Batch events in memory and deliver them through Polar's HTTP API.
 */
export class BufferedMeteringStrategy {
  private readonly options: Required<Omit<BufferedMeteringOptions, "onDelivered" | "onDropped">> &
    Pick<BufferedMeteringOptions, "onDelivered" | "onDropped">;
  private readonly queue: (EventInput | FlushRequest)[] = [];
  private readonly abort = new AbortController();
  private worker?: Promise<void>;
  private closing?: Promise<void>;
  private wake?: () => void;
  private failure?: Error;

  /**
   * Configure event delivery and retries.
   *
   * @param polar Client exposing the events.ingest API.
   * @param options Batch size, timing in milliseconds, retries, and the drop callback.
   * @throws RangeError if the batch size, max attempts, or intervals are invalid.
   */
  constructor(
    private readonly polar: MeteringClient,
    options: BufferedMeteringOptions = {},
  ) {
    this.options = {
      batchSize: options.batchSize ?? 100,
      batchIntervalMs: options.batchIntervalMs ?? 1_000,
      shutdownTimeoutMs: options.shutdownTimeoutMs ?? 5_000,
      maxAttempts: options.maxAttempts ?? 3,
      onDelivered: options.onDelivered,
      onDropped: options.onDropped,
    };
    for (const value of [this.options.batchSize, this.options.maxAttempts]) {
      if (!Number.isSafeInteger(value) || value < 1)
        throw new RangeError("Batch size and max attempts must be positive integers");
    }
    for (const value of [this.options.batchIntervalMs, this.options.shutdownTimeoutMs]) {
      if (!Number.isFinite(value) || value < 0 || value > 2_147_483_647)
        throw new RangeError("Metering intervals must be between 0 and 2147483647 milliseconds");
    }
  }

  async start(): Promise<this> {
    if (this.worker) throw new PolarError("Buffered metering has already started");
    this.worker = this.run().catch((error: unknown) => {
      this.failure = error instanceof Error ? error : new PolarError(String(error));
    });
    return this;
  }

  /**
   * Queue an event without waiting for HTTP delivery.
   *
   * @param event Event including its customer identity.
   */
  async track(event: EventInput): Promise<void> {
    this.enqueue(event);
  }

  /** Wait until earlier events are delivered or reported as dropped. */
  async flush(): Promise<void> {
    const request = new FlushRequest();
    this.enqueue(request);
    await request.completed;
  }

  async close(): Promise<void> {
    if (!this.worker) return;
    if (!this.closing) {
      this.closing = this.drain();
      this.wake?.();
    }
    await this.closing;
  }

  async [Symbol.asyncDispose](): Promise<void> {
    await this.close();
  }

  private enqueue(message: EventInput | FlushRequest): void {
    if (this.failure) throw this.failure;
    if (!this.worker || this.closing) throw new PolarError("Buffered metering is not running");
    this.queue.push(message);
    this.wake?.();
  }

  private async drain(): Promise<void> {
    const timer = setTimeout(() => this.abort.abort(), this.options.shutdownTimeoutMs);
    try {
      await this.worker;
      if (this.failure) throw this.failure;
    } finally {
      clearTimeout(timer);
    }
  }

  private async waitForMessage(timeoutMs?: number): Promise<void> {
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      await new Promise<void>((resolve) => {
        this.wake = resolve;
        if (timeoutMs !== undefined) timer = setTimeout(resolve, timeoutMs);
      });
    } finally {
      clearTimeout(timer);
      this.wake = undefined;
    }
  }

  private async run(): Promise<void> {
    let batch: EventInput[] = [];
    let requests: FlushRequest[] = [];
    try {
      while (!this.closing || this.queue.length) {
        this.abort.signal.throwIfAborted();
        const message = this.queue.shift();
        if (message === undefined) {
          await this.waitForMessage();
          continue;
        }
        if (message instanceof FlushRequest) {
          message.resolve();
          continue;
        }
        batch = [message];
        const deadline = Date.now() + this.options.batchIntervalMs;
        while (batch.length < this.options.batchSize) {
          if (!this.queue.length) {
            const remaining = deadline - Date.now();
            if (this.closing || requests.length || remaining <= 0) break;
            await this.waitForMessage(remaining);
          }
          const next = this.queue.shift();
          if (next === undefined) break;
          if (next instanceof FlushRequest) requests.push(next);
          else batch.push(next);
        }
        await this.processBatch(batch);
        batch = [];
        for (const request of requests) request.resolve();
        requests = [];
      }
    } catch (error) {
      const failure = this.abort.signal.aborted
        ? new PolarError("Buffered metering shutdown timed out")
        : error instanceof Error
          ? error
          : new PolarError(String(error));
      if (!this.abort.signal.aborted) this.failure = failure;
      for (const request of requests) request.reject(failure);
      for (const message of this.queue.splice(0)) {
        if (message instanceof FlushRequest) message.reject(failure);
        else batch.push(message);
      }
      if (this.abort.signal.aborted && batch.length)
        await this.onDropped(batch, "shutdown_timeout");
    }
  }

  private async processBatch(batch: EventInput[]): Promise<void> {
    let attempt = 1;
    let waited = 0;
    for (;;) {
      try {
        await this.polar.events.ingest({ events: batch }, { signal: this.abort.signal });
        break;
      } catch (error) {
        this.abort.signal.throwIfAborted();
        if (
          error instanceof PolarNetworkError ||
          error instanceof PolarRateLimitError ||
          error instanceof PolarServerError
        ) {
          const retryAfter = error instanceof PolarRateLimitError ? error.retryAfter : null;
          let delay: number;
          if (retryAfter !== null && Number.isFinite(retryAfter) && retryAfter >= 0) {
            delay = Math.max(retryAfter, 1) * 1000;
            waited += delay;
            if (waited > RETRY_AFTER_BUDGET_MS) {
              await this.onDropped(batch, "retry_exhausted");
              return;
            }
          } else {
            if (attempt >= this.options.maxAttempts) {
              await this.onDropped(batch, "retry_exhausted");
              return;
            }
            delay = 2 ** attempt * 1000 * (1 + (Math.random() * 2 - 1) * 0.1);
            attempt++;
          }
          await sleep(Math.min(delay, 2_147_483_647), undefined, { signal: this.abort.signal });
        } else if (error instanceof PolarError) {
          await this.onDropped(batch, "permanent_error");
          return;
        } else {
          throw error;
        }
      }
    }
    await this.options.onDelivered?.(batch);
  }

  private async onDropped(events: EventInput[], reason: DropReason): Promise<void> {
    console.warn(`Dropping ${events.length} events: ${reason}`);
    await this.options.onDropped?.(events, reason);
  }
}
