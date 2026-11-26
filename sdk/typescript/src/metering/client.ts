import type { Outpost } from "../outpost/client";
import type {
  ContextualEventInput,
  EventCustomerInput,
  EventExternalCustomerInput,
  EventInput,
} from "./event";
import type { CustomerMeter, MeterInput } from "./meter";
import type { EventQueue } from "./queue/index";

import { type ClientBase } from "../base";
import { PolarOutpostError } from "../outpost/errors";
import {
  MeteringError,
  InvalidActorError,
  MeteringTimeoutError,
  UnknownMeterError,
  deliveryTimeout,
  waitForDelivery,
  type DeliveryOptions,
} from "./errors";
import { MemoryEventQueue, type MeteringClient } from "./queue/memory";
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
   * Read this customer's meter.
   *
   * @param meterId Polar meter ID.
   * @returns Consumption, credits, and balance, or null if no meter is found.
   */
  meter(meterId: string): Promise<CustomerMeter | null>;
}

export type MeteringOutpost = (client: ClientBase) => Outpost;

export interface MeteringOptions {
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
    readonly outpost?: Outpost,
  ) {}

  /**
   * Enqueue an event and apply it to Outpost when enabled.
   *
   * @param event Event fields with exactly one customer_id or external_customer_id.
   * Member IDs must match the identifier kind. An event without a timestamp is dated now,
   * once, before the queue sees it. A missing external ID is also assigned here.
   * @throws InvalidActorError if customer or member identifiers are inconsistent.
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
   * @throws InvalidActorError if exactly one customer identifier was not provided.
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
    if (this.closing) throw new MeteringError("Metering is closed");
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
      await this.queue.start(
        this.outpost && {
          onAck: this.outpost.onAck.bind(this.outpost),
          onRejected: this.outpost.onRejected.bind(this.outpost),
        },
      );
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
    throw new InvalidActorError("Provide exactly one customer_id or external_customer_id");
  }
  if (input.member_id != null && input.customer_id == null) {
    throw new InvalidActorError("member_id requires customer_id");
  }
  if (input.external_member_id != null && input.external_customer_id == null) {
    throw new InvalidActorError("external_member_id requires external_customer_id");
  }
};

export const createMetering = (
  polar: MeteringClient,
  client: ClientBase,
  options: MeteringOptions = {},
): Metering =>
  new Metering(client, options.queue ?? new MemoryEventQueue(polar), options.outpost?.(client));
