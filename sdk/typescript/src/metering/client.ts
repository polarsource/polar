import type { OutpostOptions } from "../outpost/client";
import type {
  ContextualEventInput,
  EventCustomerInput,
  EventExternalCustomerInput,
  EventInput,
} from "./event";
import type { CustomerMeter, MeterInput } from "./meter";

import { PolarError, type ClientBase } from "../base";
import {
  BufferedMeteringStrategy,
  type BufferedMeteringOptions,
  type MeteringClient,
} from "./buffered";

/** Base error for metering configuration and operations. */
export class MeteringError extends PolarError {}
/**
 * Raised when customer or member identifiers are inconsistent.
 */
export class InvalidActorError extends MeteringError {}

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
   * Accept an event for this strategy.
   *
   * @param event Event including its customer identity.
   */
  track(event: EventInput): Promise<void>;
  /** Wait until earlier events are delivered or reported as dropped. */
  flush?(): Promise<void>;
  /** Drain pending work and release resources. */
  close(): Promise<void>;
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
      outpost?: false | MeteringOutpostOptions;
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
 * Create with polar.metering(), then await start() before use and close() on
 * shutdown. By default, events are buffered for HTTP delivery, with Outpost added
 * when a Redis URL is configured. Accepting an event does not confirm delivery.
 */
export class Metering {
  readonly strategies: readonly MeteringStrategy[];
  private stack?: AsyncDisposableStack;
  private started = false;
  private closing?: Promise<void>;
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

  async start(): Promise<this> {
    if (this.stack || this.closing) throw new PolarError("Metering has already started");
    this.stack = new AsyncDisposableStack();
    try {
      for (const strategy of this.strategies) {
        await strategy.start();
        this.stack.defer(() => strategy.close());
      }
      this.started = true;
      return this;
    } catch (error) {
      try {
        await this.close();
      } catch (cleanupError) {
        throw new AggregateError([error, cleanupError], "Metering startup and cleanup failed");
      }
      throw error;
    }
  }

  /**
   * Track an event. It'll be dispatched to all configured strategies.
   *
   * @param event Event fields with exactly one customer_id or external_customer_id.
   * Member IDs must match the identifier kind.
   * @throws InvalidActorError if customer or member identifiers are inconsistent.
   */
  async track(event: EventInput): Promise<void> {
    if (!this.started) throw new PolarError("Metering is not running");
    validateActor(event);
    this.activeOperations++;
    try {
      for (const strategy of this.strategies) await strategy.track(event);
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
    if (!this.started) throw new MeteringError("Metering is not running");
    validateActor(input);
    const identity: ActorInput =
      input.customer_id != null
        ? { customer_id: input.customer_id, member_id: input.member_id }
        : {
            external_customer_id: input.external_customer_id,
            external_member_id: input.external_member_id,
          };
    this.activeOperations++;
    try {
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
    if (!this.started) throw new MeteringError("Metering is not running");
    validateActor(input);
    this.activeOperations++;
    try {
      for (const strategy of this.strategies) {
        if (strategy.meter) return await strategy.meter({ ...input, meter_id: meterId });
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

  /**
   * Flush every capable strategy without closing the helper.
   *
   * Call this explicitly in serverless environments before returning the
   * response so pending events are processed while the request is active.
   * Earlier buffered events are delivered or reported to onDropped before
   * returning. Later events are outside this flush. A successful flush does
   * not guarantee delivery or immediate visibility in Polar's meter reads.
   *
   * @throws AggregateError if one or more strategy flushes failed.
   */
  async flush(): Promise<void> {
    if (!this.started) throw new MeteringError("Metering is not running");
    this.activeOperations++;
    try {
      const errors: unknown[] = [];
      for (const strategy of this.strategies) {
        try {
          await strategy.flush?.();
        } catch (error) {
          errors.push(error);
        }
      }
      if (errors.length) throw new AggregateError(errors, "Metering flush failed");
    } finally {
      if (--this.activeOperations === 0) this.onDrained?.();
    }
  }

  async close(): Promise<void> {
    this.started = false;
    this.closing ??= this.drain();
    await this.closing;
  }

  async [Symbol.asyncDispose](): Promise<void> {
    await this.close();
  }

  private async drain(): Promise<void> {
    if (this.activeOperations > 0) {
      await new Promise<void>((resolve) => {
        this.onDrained = resolve;
      });
    }
    await this.stack?.disposeAsync();
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
 * Create an unstarted helper, usually via polar.metering().
 *
 * @param polar Polar client used for event delivery.
 * @param client Authenticated HTTP client used for meter reads.
 * @param options.buffered Buffer options; omitted fields use BufferedMeteringOptions defaults.
 * @param options.outpost Outpost options. Defaults to enabling Outpost when REDIS_URL
 * is set. false disables it; explicit options require a Redis URL.
 * @param options.strategies Replace all default strategies. Cannot be combined with
 * buffered or outpost options.
 * @returns A helper to start before use.
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
  const strategies: MeteringStrategy[] = [new BufferedMeteringStrategy(polar, options.buffered)];
  const { redisUrl: configuredRedisUrl, ...outpostOptions } = options.outpost || {};
  const redisUrl = configuredRedisUrl ?? process.env.REDIS_URL;
  if (options.outpost !== undefined && options.outpost !== false && !redisUrl) {
    throw new MeteringError("Outpost requires redisUrl or REDIS_URL");
  }
  if (options.outpost !== false && redisUrl) {
    let outpost: import("../outpost/client").Outpost | undefined;
    strategies.push({
      async start() {
        const { Outpost } = await import("../outpost/client");
        outpost = new Outpost(redisUrl, { ...outpostOptions, client });
        await outpost.start();
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
      async close() {
        await outpost?.close();
      },
    });
  }
  return new Metering({ strategies, client });
};
