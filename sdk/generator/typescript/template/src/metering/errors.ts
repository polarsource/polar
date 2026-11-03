import type { EventInput } from "./event";

import { PolarError } from "../base";

export class MeteringError extends PolarError {}
export class InvalidActorError extends MeteringError {}
export class UnknownMeterError extends MeteringError {}

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
