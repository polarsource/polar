import type { OutpostOptions } from "../outpost/client";
import type {
  ContextualEventInput,
  EventCustomerInput,
  EventExternalCustomerInput,
  EventInput,
} from "./event";
import type { CustomerMeter, MeterInput } from "./meter";

import { type ClientBase } from "../base";
import {
  BufferedMeteringStrategy,
  type BufferedMeteringOptions,
  type MeteringClient,
} from "./buffered";
import {
  MeteringError,
  InvalidActorError,
  MeteringTimeoutError,
  UnknownMeterError,
  deliveryTimeout,
  waitForDelivery,
  type DeliveryOptions,
} from "./errors";
export {
  MeteringError,
  InvalidActorError,
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
   * Read this customer's meter using the parent's read strategy.
   *
   * @param meterId Polar meter ID.
   * @returns Consumption, credits, and balance, or null if no meter is found.
   */
  meter(meterId: string): Promise<CustomerMeter | null>;
}

/**
 * Strategy contract: manage resources with start() and close().
 *
 * Strategies receive events in order. Implement actor(), meter(), or flush()
 * to opt into warmup, meter reads, or explicit draining respectively.
 */
export interface MeteringStrategy {
  /** Start strategy resources. */
  start(): Promise<MeteringStrategy | void>;
  /**
   * Warm customer state using exactly one customer identifier.
   *
   * @param input Polar customer ID or customer ID in your application.
   */
  actor?(input: ActorInput): Promise<void>;
  meter?(input: MeterInput & { meter_id: string }): Promise<CustomerMeter | null>;
  /**
   * Reject an event before any strategy accepts it.
   *
   * @param event Event including its customer identity.
   */
  validate?(event: EventInput): void;
  /**
   * Accept an event for this strategy.
   *
   * @param event Event including its customer identity.
   */
  track(event: EventInput): Promise<void>;
  /** Wait until earlier events are delivered or reported as dropped. */
  flush?(options?: DeliveryOptions): Promise<void>;
  /** Drain pending work and release resources. */
  close(options?: DeliveryOptions): Promise<void>;
}

/**
 * Configure the optional Outpost strategy.
 */
export type MeteringOutpostOptions = Omit<OutpostOptions, "client"> & {
  /** Redis connection URL. Defaults to the REDIS_URL environment variable. */
  redisUrl?: string;
};

/** Configure the built-in strategies, or replace them with an explicit strategies list. */
export type MeteringOptions =
  | {
      buffered?: BufferedMeteringOptions;
      outpost?: boolean | MeteringOutpostOptions;
      strategies?: never;
    }
  | {
      strategies: readonly MeteringStrategy[];
      buffered?: never;
      outpost?: never;
    };

/**
 * Dispatch events, actor warmup, and meter reads to metering strategies.
 *
 * Create with polar.metering(); the first operation starts its resources. Call close() on
 * shutdown. By default, events are buffered for HTTP delivery, with Outpost added
 * when the outpost option is set. Accepting an event does not confirm delivery.
 */
export class Metering {
  readonly strategies: readonly MeteringStrategy[];
  private readonly running: MeteringStrategy[] = [];
  private starting?: Promise<void>;
  private closing?: Promise<void>;
  private shutdownDeadline?: number;
  private shutdownTimedOut = false;
  private activeOperations = 0;
  private onDrained?: () => void;
  private readonly client: ClientBase;

  /**
   * Create a helper with explicit strategies.
   *
   * @param options.strategies Strategies to start and invoke in order.
   * @param options.client Authenticated HTTP client.
   */
  constructor({
    strategies,
    client,
  }: {
    strategies: readonly MeteringStrategy[];
    client: ClientBase;
  }) {
    this.strategies = strategies;
    this.client = client;
  }

  /**
   * Track an event. It'll be dispatched to all configured strategies.
   *
   * @param event Event fields with exactly one customer_id or external_customer_id.
   * Member IDs must match the identifier kind. An event without a timestamp is dated now,
   * once, before any strategy sees it.
   * @throws InvalidActorError if customer or member identifiers are inconsistent.
   */
  async track(event: EventInput): Promise<void> {
    validateActor(event);
    const dated =
      event.timestamp === undefined ? { ...event, timestamp: new Date().toISOString() } : event;
    const starting = this.begin();
    try {
      await starting;
      for (const strategy of this.strategies) strategy.validate?.(dated);
      for (const strategy of this.strategies) await strategy.track(dated);
    } finally {
      if (--this.activeOperations === 0) this.onDrained?.();
    }
  }

  /**
   * Create customer-bound helper.
   *
   * For strategies that support it, it warms up their state in memory.
   *
   * @param input Customer identity and optional matching member identity.
   * @returns A helper that attaches this identity to events and reads customer meters.
   * @throws InvalidActorError if customer or member identifiers are inconsistent.
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
      for (const strategy of this.strategies) await strategy.actor?.(identity);
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
   * @throws InvalidActorError if exactly one customer identifier was not provided.
   */
  async meter(meterId: string, input: MeterInput): Promise<CustomerMeter | null> {
    validateActor(input);
    const starting = this.begin();
    try {
      await starting;
      for (const strategy of this.strategies) {
        if (!strategy.meter) continue;
        try {
          return await strategy.meter({ ...input, meter_id: meterId });
        } catch (error) {
          if (!(error instanceof UnknownMeterError)) throw error;
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
      const results = await Promise.allSettled(
        this.strategies.map(async (strategy) =>
          waitForDelivery(
            strategy.flush?.({ timeoutMs: Math.max(0, deadline - Date.now()) }) ??
              Promise.resolve(),
            Math.max(0, deadline - Date.now()),
          ),
        ),
      );
      const errors = results
        .filter((result) => result.status === "rejected")
        .map((result) => result.reason);
      if (errors.length === 1) throw errors[0];
      if (errors.length) throw new AggregateError(errors, "Metering flush failed");
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
    if (this.closing) throw new MeteringError("Metering is closed");
    this.activeOperations++;
    this.starting ??= this.startStrategies();
    return this.starting;
  }

  private async startStrategies(): Promise<void> {
    try {
      for (const strategy of this.strategies) {
        await strategy.start();
        this.running.push(strategy);
        if (
          this.shutdownTimedOut ||
          (this.shutdownDeadline !== undefined && Date.now() >= this.shutdownDeadline)
        ) {
          throw new MeteringTimeoutError(0);
        }
      }
    } catch (error) {
      try {
        await this.closeStrategies(0);
      } catch (cleanupError) {
        throw new AggregateError([error, cleanupError], "Metering startup and cleanup failed");
      }
      throw error;
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
      await this.closeStrategies(Math.max(0, deadline - Date.now()));
    } catch (error) {
      errors.push(error);
    }
    if (errors.length === 1) throw errors[0];
    if (errors.length) throw new AggregateError(errors, "Metering close failed");
  }

  private async closeStrategies(timeout: number): Promise<void> {
    const deadline = Date.now() + timeout;
    const errors: unknown[] = [];
    for (const strategy of this.running.splice(0)) {
      try {
        const remaining = Math.max(0, deadline - Date.now());
        await waitForDelivery(strategy.close({ timeoutMs: remaining }), remaining);
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
    throw new InvalidActorError("Provide exactly one customer_id or external_customer_id");
  }
  if (input.member_id != null && input.customer_id == null) {
    throw new InvalidActorError("member_id requires customer_id");
  }
  if (input.external_member_id != null && input.external_customer_id == null) {
    throw new InvalidActorError("external_member_id requires external_customer_id");
  }
};

/**
 * Create a lazily started helper, usually via polar.metering().
 *
 * @param polar Polar client used for event delivery.
 * @param client Authenticated HTTP client used for meter reads.
 * @param options.buffered Buffer options; omitted fields use BufferedMeteringOptions defaults.
 * @param options.outpost true or Outpost options to enable Outpost, which then requires
 * redisUrl or REDIS_URL. Disabled by default.
 * @param options.strategies Replace all default strategies. Cannot be combined with
 * buffered or outpost options.
 * @returns A helper that starts on its first operation.
 * @throws MeteringError if options conflict or Outpost has no Redis URL.
 */
export const createMetering = (
  polar: MeteringClient,
  client: ClientBase,
  options: MeteringOptions = {},
): Metering => {
  if (options.strategies !== undefined) {
    if (options.buffered !== undefined || options.outpost !== undefined) {
      throw new MeteringError("Cannot combine strategies with buffered or outpost options");
    }
    return new Metering({ strategies: options.strategies, client });
  }
  const { redisUrl: configuredRedisUrl, ...outpostOptions } =
    options.outpost === true ? {} : options.outpost || {};
  const redisUrl = configuredRedisUrl ?? process.env.REDIS_URL;
  if (options.outpost && !redisUrl) {
    throw new MeteringError("Outpost requires redisUrl or REDIS_URL");
  }
  let buffered = options.buffered;
  const strategies: MeteringStrategy[] = [];
  if (options.outpost && redisUrl) {
    let outpost: import("../outpost/client").Outpost | undefined;

    // Polar received the delivered events: they settle where their bucket is hot. It will
    // never count the dropped ones: they settle everywhere.
    const settle = async (events: EventInput[], dropped: boolean): Promise<void> => {
      try {
        await (dropped ? outpost?.confirm(events) : outpost?.acknowledge(events));
      } catch (error) {
        console.warn(`Could not settle ${events.length} events in Outpost: ${String(error)}`);
      }
    };
    buffered = {
      ...options.buffered,
      async onDelivered(events) {
        await settle(events, false);
        await options.buffered?.onDelivered?.(events);
      },
      async onDropped(events, reason) {
        await settle(events, true);
        await options.buffered?.onDropped?.(events, reason);
      },
    };
    strategies.push({
      async start() {
        const { Outpost } = await import("../outpost/client");
        outpost = new Outpost(redisUrl, { ...outpostOptions, client });
        await outpost.start();
      },
      validate(event) {
        outpost!.validate(event);
      },
      async track(event) {
        await outpost!.track(event);
      },
      async actor(input) {
        await outpost!.actor(input);
      },
      async meter(input) {
        return outpost!.meter(input);
      },
      async flush() {
        await outpost?.flush();
      },
      async close() {
        await outpost?.close();
      },
    });
  }
  return new Metering({
    strategies: [new BufferedMeteringStrategy(polar, buffered), ...strategies],
    client,
  });
};
