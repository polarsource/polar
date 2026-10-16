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

export interface IngestionClient {
  events: {
    ingest(body: { events: EventInput[] }, options?: RequestOptions): Promise<unknown>;
  };
}

export interface BufferedIngestionOptions {
  batchSize?: number;
  batchIntervalMs?: number;
  shutdownTimeoutMs?: number;
  maxAttempts?: number;
  onDropped?: (events: EventInput[], reason: DropReason) => void | Promise<void>;
}

export class BufferedIngestionStrategy {
  private readonly options: Required<Omit<BufferedIngestionOptions, "onDropped">> &
    Pick<BufferedIngestionOptions, "onDropped">;
  private readonly queue: EventInput[] = [];
  private readonly abort = new AbortController();
  private worker?: Promise<void>;
  private closing?: Promise<void>;
  private wake?: () => void;
  private failure?: Error;

  constructor(
    private readonly polar: IngestionClient,
    options: BufferedIngestionOptions = {},
  ) {
    this.options = {
      batchSize: options.batchSize ?? 100,
      batchIntervalMs: options.batchIntervalMs ?? 1_000,
      shutdownTimeoutMs: options.shutdownTimeoutMs ?? 5_000,
      maxAttempts: options.maxAttempts ?? 3,
      onDropped: options.onDropped,
    };
    for (const value of [this.options.batchSize, this.options.maxAttempts]) {
      if (!Number.isSafeInteger(value) || value < 1)
        throw new RangeError("Batch size and max attempts must be positive integers");
    }
    for (const value of [this.options.batchIntervalMs, this.options.shutdownTimeoutMs]) {
      if (!Number.isFinite(value) || value < 0 || value > 2_147_483_647)
        throw new RangeError("Ingestion intervals must be between 0 and 2147483647 milliseconds");
    }
  }

  async start(): Promise<this> {
    if (this.worker) throw new PolarError("Buffered ingestion has already started");
    this.worker = this.run().catch((error: unknown) => {
      this.failure = error instanceof Error ? error : new PolarError(String(error));
    });
    return this;
  }

  async ingest(event: EventInput): Promise<void> {
    if (this.failure) throw this.failure;
    if (!this.worker || this.closing) throw new PolarError("Buffered ingestion is not running");
    this.queue.push(event);
    if (this.queue.length >= this.options.batchSize) this.wake?.();
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

  private async drain(): Promise<void> {
    const timer = setTimeout(() => this.abort.abort(), this.options.shutdownTimeoutMs);
    try {
      await this.worker;
      if (this.failure) throw this.failure;
    } finally {
      clearTimeout(timer);
    }
  }

  private async waitForBatch(): Promise<void> {
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      await new Promise<void>((resolve) => {
        this.wake = resolve;
        timer = setTimeout(resolve, this.options.batchIntervalMs);
      });
    } finally {
      clearTimeout(timer);
      this.wake = undefined;
    }
  }

  private async run(): Promise<void> {
    let batch: EventInput[] = [];
    try {
      while (!this.closing || this.queue.length) {
        this.abort.signal.throwIfAborted();
        if (!this.closing && this.queue.length < this.options.batchSize) await this.waitForBatch();
        batch = this.queue.splice(0, this.options.batchSize);
        if (batch.length) await this.processBatch(batch);
        batch = [];
      }
    } catch (error) {
      if (!this.abort.signal.aborted) throw error;
      const unfinished = [...batch, ...this.queue.splice(0)];
      if (unfinished.length) await this.onDropped(unfinished, "shutdown_timeout");
    }
  }

  private async processBatch(batch: EventInput[]): Promise<void> {
    for (let attempt = 1; ; attempt++) {
      try {
        await this.polar.events.ingest({ events: batch }, { signal: this.abort.signal });
        return;
      } catch (error) {
        this.abort.signal.throwIfAborted();
        if (
          error instanceof PolarNetworkError ||
          error instanceof PolarRateLimitError ||
          error instanceof PolarServerError
        ) {
          if (attempt >= this.options.maxAttempts) {
            await this.onDropped(batch, "retry_exhausted");
            return;
          }
          const retryAfter = error instanceof PolarRateLimitError ? error.retryAfter : null;
          const delay =
            retryAfter !== null && Number.isFinite(retryAfter) && retryAfter >= 0
              ? retryAfter * 1000
              : 2 ** attempt * 1000 * (1 + (Math.random() * 2 - 1) * 0.1);
          await sleep(Math.min(delay, 2_147_483_647), undefined, { signal: this.abort.signal });
        } else if (error instanceof PolarError) {
          await this.onDropped(batch, "permanent_error");
          return;
        } else {
          throw error;
        }
      }
    }
  }

  private async onDropped(events: EventInput[], reason: DropReason): Promise<void> {
    console.warn(`Dropping ${events.length} events: ${reason}`);
    await this.options.onDropped?.(events, reason);
  }
}
