import type { Redis } from "ioredis";

import type {
  ContextualEventInput,
  EventCustomerInput,
  EventExternalCustomerInput,
  EventInput,
} from "./event";
import type { CustomerMeter, MeterInput } from "./meter";

import { PolarClientError, PolarNetworkError, PolarServerError, type ClientBase } from "../base";
import { PolarOutpostError } from "../outpost/errors";
import {
  IngestRejectedError,
  IngestRetryableError,
  MeteringTimeoutError,
  UnknownMeterError,
  deliveryTimeout,
  waitForDelivery,
  type DeliveryOptions,
  type DropReason,
  retryAfterMs,
} from "./errors";
import type { EventQueue, EventQueueHooks, EventQueueStartOptions, Ingest } from "./queue/index";
import { MemoryEventQueue } from "./queue/memory";
import type { RedisEventQueue } from "./queue/redis";
export {
  MeteringError,
  IngestRejectedError,
  IngestRetryableError,
  MeteringDeliveryError,
  MeteringTimeoutError,
  UnknownMeterError,
} from "./errors";

/** Exactly one customer identity, with an optional member of the same identifier kind. */
export type ActorInput =
  | (Pick<EventCustomerInput, "customer_id" | "member_id"> & {
      external_customer_id?: never;
      external_member_id?: never;
    })
  | (Pick<EventExternalCustomerInput, "external_customer_id" | "external_member_id"> & {
      customer_id?: never;
      member_id?: never;
    });

/**
 * Customer-bound helper returned by Metering.actor().
 *
 * Member identifiers apply to events; meter reads remain customer-wide.
 * The helper shares its parent's lifecycle and owns no resources.
 */
export interface ActorMetering {
  /**
   * Track an event with this actor's identifiers attached.
   *
   * @param event Event name and optional metadata, timestamp, or external ID.
   */
  track(event: ContextualEventInput): Promise<void>;
  /**
   * Read this customer's meter.
   *
   * @param meterId Polar meter ID.
   * @returns Consumption, credits, and balance, or null if no meter is found.
   */
  meter(meterId: string): Promise<CustomerMeter | null>;
}

interface MeteringReducer {
  start(): Promise<unknown>;
  close(): Promise<void>;
  track(event: EventInput): Promise<void>;
  actor(input: ActorInput): Promise<void>;
  meter(input: MeterInput & { meter_id: string }): Promise<CustomerMeter | null>;
  flush(): Promise<void>;
  onAck(events: EventInput[]): Promise<void>;
  onRejected(events: EventInput[], reason: DropReason): Promise<void>;
  redisForUrl?(url: string | undefined): object | undefined;
}

export type MeteringOutpost = (client: ClientBase) => MeteringReducer;

export interface MeteringOptions extends EventQueueHooks {
  queue?: EventQueue;
  outpost?: MeteringOutpost;
}

export class Metering {
  private readonly running: Pick<EventQueue, "close">[] = [];
  private starting?: Promise<void>;
  private closing?: Promise<void>;
  private shutdownDeadline?: number;
  private shutdownTimedOut = false;
  private activeOperations = 0;
  private onDrained?: () => void;
  constructor(
    private readonly client: ClientBase,
    readonly queue: EventQueue,
    readonly outpost?: MeteringReducer,
    private readonly hooks: EventQueueHooks = {},
  ) {}

  /**
   * Enqueue an event and apply it to Outpost when enabled.
   *
   * @param event Event fields with exactly one customer_id or external_customer_id.
   * Member IDs must match the identifier kind. An event without a timestamp is dated now,
   * once, before the queue sees it. A missing external ID is also assigned here.
   * @throws TypeError if customer or member identifiers are inconsistent.
   */
  async track(event: EventInput): Promise<void> {
    validateActor(event);
    const queued = {
      ...event,
      timestamp: event.timestamp ?? new Date().toISOString(),
      external_id: event.external_id || crypto.randomUUID(),
    };
    const starting = this.begin();
    try {
      await starting;
      await this.queue.enqueue(queued);
      try {
        await this.outpost?.track(queued);
      } catch (error) {
        console.warn(
          "Outpost failed to reduce an enqueued event",
          error instanceof Error ? error.constructor.name : typeof error,
        );
      }
    } finally {
      if (--this.activeOperations === 0) this.onDrained?.();
    }
  }

  /**
   * Create customer-bound helper.
   *
   * When enabled, Outpost warms up customer state.
   *
   * @param input Customer identity and optional matching member identity.
   * @returns A helper that attaches this identity to events and reads customer meters.
   * @throws TypeError if customer or member identifiers are inconsistent.
   */
  async actor(input: ActorInput): Promise<ActorMetering> {
    validateActor(input);
    const identity: ActorInput =
      input.customer_id != null
        ? { customer_id: input.customer_id, member_id: input.member_id }
        : {
            external_customer_id: input.external_customer_id,
            external_member_id: input.external_member_id,
          };
    const starting = this.begin();
    try {
      await starting;
      try {
        await this.outpost?.actor(identity);
      } catch (error) {
        if (!(error instanceof PolarOutpostError)) throw error;
      }
      return {
        track: (event) => this.track({ ...event, ...identity }),
        meter: (meterId) => this.meter(meterId, identity),
      };
    } finally {
      if (--this.activeOperations === 0) this.onDrained?.();
    }
  }

  /**
   * Read a meter value.
   *
   * If enabled, the local value from Outpost will be read. Otherwise, it'll
   * fall back to the Polar API.
   *
   * @param meterId Polar meter ID.
   * @param input Exactly one customer identifier.
   * @returns Consumption, credits, and balance, or null if no meter is found.
   * @throws TypeError if exactly one customer identifier was not provided.
   */
  async meter(meterId: string, input: MeterInput): Promise<CustomerMeter | null> {
    validateActor(input);
    const starting = this.begin();
    try {
      await starting;
      if (this.outpost) {
        try {
          return await this.outpost.meter({ ...input, meter_id: meterId });
        } catch (error) {
          if (!(error instanceof UnknownMeterError || error instanceof PolarOutpostError))
            throw error;
        }
      }
      const request = this.client.buildRequest(
        "GET",
        "/v1/customer-meters/",
        {},
        {
          meter_id: meterId,
          customer_id: input.customer_id,
          external_customer_id: input.external_customer_id,
          limit: 1,
        },
      );
      const response = await this.client.sendRequest(request);
      const result = await this.client.parseResponse<{ items: CustomerMeter[] }>(response, "json");
      return result.items[0] ?? null;
    } finally {
      if (--this.activeOperations === 0) this.onDrained?.();
    }
  }

  /** Wait for earlier events; rejects if delivery cannot be confirmed. */
  async flush(options?: DeliveryOptions): Promise<void> {
    const timeout = deliveryTimeout(options);
    const deadline = Date.now() + timeout;
    const starting = this.begin();
    try {
      await waitForDelivery(starting, timeout);
      const remaining = Math.max(0, deadline - Date.now());
      await waitForDelivery(this.queue.flush({ timeoutMs: remaining }), remaining);
      if (this.outpost)
        await waitForDelivery(this.outpost.flush(), Math.max(0, deadline - Date.now()));
    } finally {
      if (--this.activeOperations === 0) this.onDrained?.();
    }
  }

  /** Stop accepting work, drain pending events, and release resources. */
  async close(options?: DeliveryOptions): Promise<void> {
    const timeout = deliveryTimeout(options);
    if (!this.closing) {
      this.shutdownDeadline = Date.now() + timeout;
      this.closing = this.drain(this.shutdownDeadline);
    }
    await this.closing;
  }

  private begin(): Promise<void> {
    if (this.closing) throw new Error("Metering is closed");
    this.activeOperations++;
    this.starting ??= this.startResources();
    return this.starting;
  }

  private async startResources(): Promise<void> {
    const checkDeadline = () => {
      if (
        this.shutdownTimedOut ||
        (this.shutdownDeadline !== undefined && Date.now() >= this.shutdownDeadline)
      )
        throw new MeteringTimeoutError(0);
    };
    try {
      if (this.outpost) {
        await this.outpost.start();
        this.running.push(this.outpost);
        checkDeadline();
      }
      const options: EventQueueStartOptions = {
        ingest: createIngest(this.client),
        onAck: this.outpost || this.hooks.onAck ? this.onAck.bind(this) : undefined,
        onRejected: this.outpost || this.hooks.onRejected ? this.onRejected.bind(this) : undefined,
      };
      const queue = this.queue as EventQueue & Partial<RedisEventQueue>;
      const redis = this.outpost?.redisForUrl?.(queue.redisUrl) as Redis | undefined;
      if (redis && typeof queue.startWithRedis === "function")
        await queue.startWithRedis(options, redis);
      else await queue.start(options);
      this.running.push(this.queue);
      checkDeadline();
    } catch (error) {
      try {
        await this.closeResources(0);
      } catch (cleanupError) {
        throw new AggregateError([error, cleanupError], "Metering startup and cleanup failed");
      }
      throw error;
    }
  }

  private async onAck(events: EventInput[]): Promise<void> {
    await this.outpost?.onAck(events);
    try {
      await this.hooks.onAck?.(events);
    } catch (error) {
      console.warn(
        "Metering acknowledgement hook failed",
        error instanceof Error ? error.constructor.name : typeof error,
      );
    }
  }

  private async onRejected(events: EventInput[], reason: DropReason): Promise<void> {
    await this.outpost?.onRejected(events, reason);
    try {
      await this.hooks.onRejected?.(events, reason);
    } catch (error) {
      console.warn(
        "Metering rejection hook failed",
        error instanceof Error ? error.constructor.name : typeof error,
      );
    }
  }

  private async drain(deadline: number): Promise<void> {
    const errors: unknown[] = [];
    try {
      await waitForDelivery(
        this.starting?.catch(() => {}) ?? Promise.resolve(),
        Math.max(0, deadline - Date.now()),
      );
      if (this.activeOperations > 0) {
        await waitForDelivery(
          new Promise<void>((resolve) => {
            this.onDrained = resolve;
          }),
          Math.max(0, deadline - Date.now()),
        );
      }
    } catch (error) {
      if (error instanceof MeteringTimeoutError) this.shutdownTimedOut = true;
      errors.push(error);
    }
    try {
      await this.closeResources(Math.max(0, deadline - Date.now()));
    } catch (error) {
      errors.push(error);
    }
    if (errors.length === 1) throw errors[0];
    if (errors.length) throw new AggregateError(errors, "Metering close failed");
  }

  private async closeResources(timeout: number): Promise<void> {
    const deadline = Date.now() + timeout;
    const errors: unknown[] = [];
    for (const resource of this.running.splice(0).reverse()) {
      try {
        const remaining = Math.max(0, deadline - Date.now());
        await waitForDelivery(resource.close({ timeoutMs: remaining }), remaining);
      } catch (error) {
        errors.push(error);
      }
    }
    if (errors.length === 1) throw errors[0];
    if (errors.length) throw new AggregateError(errors, "Metering close failed");
  }
}

const validateActor = (input: {
  customer_id?: string;
  member_id?: string | null;
  external_customer_id?: string;
  external_member_id?: string | null;
}): void => {
  if ((input.customer_id == null) === (input.external_customer_id == null)) {
    throw new TypeError("Provide exactly one customer_id or external_customer_id");
  }
  if (input.member_id != null && input.customer_id == null) {
    throw new TypeError("member_id requires customer_id");
  }
  if (input.external_member_id != null && input.external_customer_id == null) {
    throw new TypeError("external_member_id requires external_customer_id");
  }
};

export const createMetering = (client: ClientBase, options: MeteringOptions = {}): Metering =>
  new Metering(client, options.queue ?? new MemoryEventQueue(), options.outpost?.(client), options);

// The indexes of the events Polar's validation refuses, when each of its errors names one.
const refusedIndexes = (error: PolarClientError, batchSize: number): Set<number> | undefined => {
  if (error.statusCode !== 422) return undefined;
  let detail: unknown;
  try {
    // The client keeps the body of an error it has no class for as text.
    detail = (JSON.parse(String(error.error)) as { detail?: unknown } | null)?.detail;
  } catch {
    return undefined;
  }
  if (!Array.isArray(detail)) return undefined;
  const indexes = new Set<number>();
  for (const error of detail as ({ loc?: unknown } | null)[]) {
    const loc = error?.loc;
    if (
      !Array.isArray(loc) ||
      loc[0] !== "body" ||
      loc[1] !== "events" ||
      !Number.isInteger(loc[2])
    )
      return undefined;
    const index = loc[2] as number;
    if (index < 0 || index >= batchSize) return undefined;
    indexes.add(index);
  }
  return indexes.size ? indexes : undefined;
};

export const createIngest =
  (client: ClientBase): Ingest =>
  async (events, options) => {
    try {
      const response = await client.sendRequest(
        client.buildRequest("POST", "/v1/events/ingest", undefined, undefined, { events }),
        options,
      );
      try {
        if (!response.ok) {
          if (response.status < 400)
            throw new IngestRetryableError({
              cause: new Error(`Polar answered ${response.status}`),
            });
          await client.parseResponse(response, "none");
        }
      } finally {
        if (!response.bodyUsed) await response.body?.cancel().catch(() => {});
      }
    } catch (error) {
      if (error instanceof PolarClientError && ![401, 403, 408, 429].includes(error.statusCode)) {
        throw new IngestRejectedError({
          rejectedIndexes: refusedIndexes(error, events.length),
          cause: error,
        });
      }
      if (
        error instanceof PolarClientError ||
        error instanceof PolarNetworkError ||
        error instanceof PolarServerError
      ) {
        throw new IngestRetryableError({
          retryAfterMs: retryAfterMs(error) ?? undefined,
          cause: error,
        });
      }
      throw error;
    }
};
