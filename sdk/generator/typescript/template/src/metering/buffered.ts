import { setTimeout as sleep } from "node:timers/promises";

import type { EventInput } from "./event";

import {
  PolarError,
  PolarNetworkError,
  PolarRateLimitError,
  PolarServerError,
  type RequestOptions,
} from "../base";
import {
  MeteringDeliveryError,
  MeteringTimeoutError,
  deliveryTimeout,
  waitForDelivery,
  type DeliveryFailure,
  type DeliveryOptions,
  type DropReason,
} from "./errors";

export type { DropReason } from "./errors";

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
   * Maximum events per HTTP request. Defaults to 100.
   */
  batchSize?: number;
  /**
   * Milliseconds to collect a batch after its first event. Defaults to 1000.
   */
  batchIntervalMs?: number;
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
   * Defaults to undefined; drops are always logged and remain observable by flush().
   */
  onDropped?: (events: EventInput[], reason: DropReason) => void | Promise<void>;
}

interface QueuedEvent {
  sequence: number;
  event: EventInput;
}

interface FailedEvent extends QueuedEvent {
  reason: DropReason;
  cause: unknown;
}

class FlushRequest {
  resolve!: () => void;
  reject!: (error: unknown) => void;
  active = true;
  readonly completed = new Promise<void>((resolve, reject) => {
    this.resolve = resolve;
    this.reject = reject;
  });

  constructor(
    readonly after: number,
    readonly through: number,
  ) {}
}

/**
 * Batch events in memory and deliver them through Polar's HTTP API.
 */
export class BufferedMeteringStrategy {
  private readonly options: Required<Omit<BufferedMeteringOptions, "onDelivered" | "onDropped">> &
    Pick<BufferedMeteringOptions, "onDelivered" | "onDropped">;
  private readonly queue: (QueuedEvent | FlushRequest)[] = [];
  private readonly barriers = new Set<FlushRequest>();
  private readonly abort = new AbortController();
  private failures: FailedEvent[] = [];
  private batch: QueuedEvent[] = [];
  private sequence = 0;
  private acknowledged = 0;
  private worker?: Promise<void>;
  private closing?: Promise<void>;
  private wake?: () => void;
  private failure?: unknown;
  private finished = false;

  /**
   * Configure event delivery and retries.
   *
   * @param polar Client exposing the events.ingest API.
   * @param options Batch size, collection interval in milliseconds, retries, and delivery callbacks.
   * @throws RangeError if the batch size, max attempts, or batch interval is invalid.
   */
  constructor(
    private readonly polar: MeteringClient,
    options: BufferedMeteringOptions = {},
  ) {
    this.options = {
      batchSize: options.batchSize ?? 100,
      batchIntervalMs: options.batchIntervalMs ?? 1000,
      maxAttempts: options.maxAttempts ?? 3,
      onDelivered: options.onDelivered,
      onDropped: options.onDropped,
    };
    for (const value of [this.options.batchSize, this.options.maxAttempts]) {
      if (!Number.isSafeInteger(value) || value < 1)
        throw new RangeError("Batch size and max attempts must be positive integers");
    }
    const interval = this.options.batchIntervalMs;
    if (!Number.isFinite(interval) || interval < 0 || interval > 2_147_483_647)
      throw new RangeError("Batch interval must be between 0 and 2147483647 milliseconds");
  }

  /**
   * Start the background delivery worker.
   *
   * @returns This strategy, ready to accept events.
   * @throws PolarError if the worker has already started.
   */
  async start(): Promise<this> {
    if (this.worker) throw new PolarError("Buffered metering has already started");
    this.worker = this.run();
    return this;
  }

  /**
   * Queue an event without waiting for HTTP delivery.
   *
   * @param event Event including its customer identity.
   */
  async track(event: EventInput): Promise<void> {
    this.assertRunning();
    this.queue.push({ sequence: ++this.sequence, event });
    this.wake?.();
  }

  /**
   * Wait for events queued before this call and report unacknowledged delivery failures.
   *
   * Overlapping flushes each observe failures within their queue boundary. A completed
   * flush acknowledges those outcomes; a timeout leaves them observable by a later flush
   * and does not cancel background delivery or other callers.
   *
   * @param options Maximum wait in milliseconds; defaults to 30000.
   * @throws MeteringDeliveryError if earlier events were dropped or remain pending at the deadline.
   * @throws MeteringTimeoutError if the wait expires without dropped or pending events to report.
   */
  async flush(options?: DeliveryOptions): Promise<void> {
    const timeout = deliveryTimeout(options);
    if (!this.worker || this.closing) throw new PolarError("Buffered metering is not running");
    const request = this.barrier();
    if (this.finished || this.failure) this.finish(request);
    else {
      this.queue.push(request);
      this.wake?.();
    }
    const timer = setTimeout(() => {
      request.reject(this.timeoutError(request, timeout, "flush_timeout"));
      this.release(request);
    }, timeout);
    try {
      await request.completed;
    } finally {
      clearTimeout(timer);
    }
  }

  /**
   * Stop accepting events and drain the queue, aborting unfinished delivery at the deadline.
   *
   * Repeated calls share the first call's deadline and result. Does nothing if not started.
   * A callback still running at the deadline may continue after this wait rejects.
   *
   * @param options Maximum drain time in milliseconds; defaults to 30000.
   * @throws MeteringDeliveryError if delivery failures remain unacknowledged or shutdown drops events.
   * @throws MeteringTimeoutError if shutdown expires while waiting for delivery callbacks.
   */
  async close(options?: DeliveryOptions): Promise<void> {
    const timeout = deliveryTimeout(options);
    if (!this.worker) return;
    this.closing ??= this.drain(timeout);
    this.wake?.();
    await this.closing;
  }

  private assertRunning(): void {
    if (this.failure) throw this.failure;
    if (!this.worker || this.closing) throw new PolarError("Buffered metering is not running");
  }

  private barrier(): FlushRequest {
    const request = new FlushRequest(this.acknowledged, this.sequence);
    this.barriers.add(request);
    return request;
  }

  private deliveryFailures(request: FlushRequest): DeliveryFailure[] {
    return this.failures
      .filter((item) => item.sequence > request.after && item.sequence <= request.through)
      .map((item) => ({ events: [item.event], reason: item.reason, cause: item.cause }));
  }

  private finish(request: FlushRequest): void {
    if (!request.active) return;
    const failures = this.deliveryFailures(request);
    this.acknowledged = Math.max(this.acknowledged, request.through);
    if (failures.length) request.reject(new MeteringDeliveryError(failures));
    else if (this.failure) request.reject(this.failure);
    else request.resolve();
    this.release(request);
  }

  private release(request: FlushRequest): void {
    request.active = false;
    this.barriers.delete(request);
    let oldest = this.acknowledged;
    for (const barrier of this.barriers) oldest = Math.min(oldest, barrier.after);
    this.failures = this.failures.filter((item) => item.sequence > oldest);
  }

  private timeoutError(
    request: FlushRequest,
    timeout: number,
    reason: "flush_timeout" | "shutdown_timeout",
  ): MeteringDeliveryError | MeteringTimeoutError {
    const pending = [
      ...this.batch,
      ...this.queue.filter((item): item is QueuedEvent => !(item instanceof FlushRequest)),
    ].filter((item) => item.sequence > request.after && item.sequence <= request.through);
    const failures = this.deliveryFailures(request);
    if (pending.length)
      failures.push({
        events: pending.map((item) => item.event),
        reason,
        cause: new MeteringTimeoutError(timeout),
      });
    return failures.length
      ? new MeteringDeliveryError(failures)
      : new MeteringTimeoutError(timeout);
  }

  private async drain(timeout: number): Promise<void> {
    const request = this.barrier();
    const timer = setTimeout(
      () => this.abort.abort(new Error(`Metering shutdown timed out after ${timeout}ms`)),
      timeout,
    );
    try {
      try {
        await waitForDelivery(this.worker!, timeout);
      } catch (error) {
        if (error instanceof MeteringTimeoutError)
          throw this.timeoutError(request, timeout, "shutdown_timeout");
        throw error;
      }
      this.finish(request);
      await request.completed;
    } finally {
      clearTimeout(timer);
      this.release(request);
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
          this.finish(message);
          continue;
        }
        this.batch = [message];
        const deadline = Date.now() + this.options.batchIntervalMs;
        while (this.batch.length < this.options.batchSize) {
          if (!this.queue.length) {
            const remaining = deadline - Date.now();
            if (this.closing || requests.length || remaining <= 0) break;
            await this.waitForMessage(remaining);
          }
          const next = this.queue.shift();
          if (next === undefined) break;
          if (next instanceof FlushRequest) requests.push(next);
          else this.batch.push(next);
        }
        const events = this.batch.map((item) => item.event);
        const failure = await this.processBatch(events);
        if (failure) {
          for (const item of this.batch) this.failures.push({ ...item, ...failure });
        }
        this.batch = [];
        if (failure) await this.onDropped(events, failure.reason);
        else await this.options.onDelivered?.(events);
        for (const request of requests) this.finish(request);
        requests = [];
      }
    } catch (error) {
      const reason: DropReason = this.abort.signal.aborted ? "shutdown_timeout" : "worker_error";
      const pending = this.batch;
      this.batch = [];
      for (const message of this.queue.splice(0)) {
        if (!(message instanceof FlushRequest)) pending.push(message);
      }
      for (const item of pending) this.failures.push({ ...item, reason, cause: error });
      if (!this.abort.signal.aborted)
        this.failure = error instanceof Error ? error : new PolarError(String(error));
      try {
        if (pending.length)
          await this.onDropped(
            pending.map((item) => item.event),
            reason,
          );
      } catch (callbackError) {
        this.failure = new AggregateError(
          [error, callbackError],
          "Metering worker and drop callback failed",
        );
      }
    } finally {
      this.finished = true;
      for (const request of this.barriers) this.finish(request);
    }
  }

  private async processBatch(
    events: EventInput[],
  ): Promise<{ reason: DropReason; cause: unknown } | undefined> {
    let attempt = 1;
    let waited = 0;
    for (;;) {
      try {
        await this.polar.events.ingest({ events }, { signal: this.abort.signal });
        return;
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
            if (waited > RETRY_AFTER_BUDGET_MS) return { reason: "retry_exhausted", cause: error };
          } else {
            if (attempt >= this.options.maxAttempts)
              return { reason: "retry_exhausted", cause: error };
            delay = 2 ** attempt * 1000 * (1 + (Math.random() * 2 - 1) * 0.1);
            attempt++;
          }
          await sleep(Math.min(delay, 2_147_483_647), undefined, { signal: this.abort.signal });
        } else if (error instanceof PolarError) {
          return { reason: "permanent_error", cause: error };
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
