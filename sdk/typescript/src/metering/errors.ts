import type { EventInput } from "./event";

import { PolarError, PolarRateLimitError } from "../base";

export class MeteringError extends PolarError {}

/** How long Polar asked to wait before the next delivery, in milliseconds: a second at least. */
export const retryAfterMs = (error: unknown): number | null =>
  error instanceof PolarRateLimitError &&
  error.retryAfter !== null &&
  Number.isFinite(error.retryAfter) &&
  error.retryAfter >= 0
    ? Math.max(error.retryAfter, 1) * 1000
    : null;
export class UnknownMeterError extends MeteringError {}

export class IngestRetryableError extends MeteringError {
  readonly retryAfterMs?: number;

  constructor({ retryAfterMs, cause }: { retryAfterMs?: number; cause?: unknown } = {}) {
    super("Event delivery can be retried", { cause });
    this.retryAfterMs = retryAfterMs;
  }
}

export class IngestRejectedError extends MeteringError {
  readonly rejectedIndexes?: ReadonlySet<number>;

  constructor({
    rejectedIndexes,
    cause,
  }: { rejectedIndexes?: ReadonlySet<number>; cause?: unknown } = {}) {
    super("Event delivery was rejected", { cause });
    this.rejectedIndexes = rejectedIndexes;
  }
}

export type DropReason =
  | "retry_exhausted"
  | "shutdown_timeout"
  | "permanent_error"
  | "worker_error";

export interface DeliveryFailure {
  events: EventInput[];
  reason: DropReason | "flush_timeout";
  cause: unknown;
}

export class MeteringDeliveryError extends MeteringError {
  readonly events: EventInput[];

  constructor(readonly failures: DeliveryFailure[]) {
    const events = failures.flatMap((failure) => failure.events);
    const cause = failures[0]?.cause;
    super(
      `Could not confirm delivery of ${events.length} events${cause instanceof Error ? ": " + cause.message : ""}`,
      { cause },
    );
    this.events = events;
  }
}

export interface DeliveryOptions {
  /** Maximum wait in milliseconds. Defaults to 30000. */
  timeoutMs?: number;
}

export const deliveryTimeout = (options: DeliveryOptions = {}): number => {
  const timeout = options.timeoutMs ?? 30_000;
  if (!Number.isFinite(timeout) || timeout < 0 || timeout > 2_147_483_647) {
    throw new RangeError("Delivery timeout must be between 0 and 2147483647 milliseconds");
  }
  return timeout;
};

export class MeteringTimeoutError extends MeteringError {
  constructor(readonly timeoutMs: number) {
    super(`Metering operation timed out after ${timeoutMs}ms`);
  }
}

export const waitForDelivery = async <T>(operation: Promise<T>, timeout: number): Promise<T> => {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      operation,
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new MeteringTimeoutError(timeout)), timeout);
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
};
