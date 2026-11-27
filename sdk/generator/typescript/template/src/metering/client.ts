import type { ClientBase } from "../base";
import { PolarOutpostError } from "../outpost/errors";
import { validateActor, type Actor, type ActorInput } from "./actor";
import {
  MeteringTimeoutError,
  UnknownMeterError,
  deliveryTimeout,
  waitForDelivery,
  type DeliveryOptions,
  type DropReason,
} from "./errors";
import { createIngest, type EventInput } from "./event";
import type { CustomerMeter, MeterInput } from "./meter";
import type { EventQueue, EventQueueHooks, EventQueueStartOptions } from "./queue/index";
import { MemoryEventQueue } from "./queue/memory";
import type { RedisEventQueue } from "./queue/redis";

const OUTPOST_START_RETRY_DELAY_MS = 1000;

interface OutpostBackend {
  start(): Promise<unknown>;
  close(): Promise<void>;
  track(event: EventInput): Promise<void>;
  actor(input: MeterInput): Promise<void>;
  meter(input: MeterInput & { meter_id: string }): Promise<CustomerMeter | null>;
  flush(): Promise<void>;
  onAck(events: EventInput[]): Promise<void>;
  onRejected(events: EventInput[], reason: DropReason): Promise<void>;
  redisForUrl(url: string | undefined): object | undefined;
}

export type OutpostFactory = (client: ClientBase) => OutpostBackend;

export interface PolarEventOptions {
  /** Queue used to deliver events. Defaults to a memory queue. Pass null to disable delivery. */
  eventQueue?: EventQueue | null;
  /** Configure local meter state with `outpost()` from `@polar-sh/sdk/outpost`. */
  outpost?: OutpostFactory;
  onEventAck?: EventQueueHooks["onAck"];
  onEventRejected?: EventQueueHooks["onRejected"];
}

export class PolarEventClient {
  private readonly running: Pick<EventQueue, "close">[] = [];
  private startingOutpost?: Promise<OutpostBackend | undefined>;
  private outpostRetryAt = 0;
  private startingQueue?: Promise<void>;
  private outpost?: OutpostBackend;
  private readonly queue: EventQueue | null;
  private closing?: Promise<void>;
  private shutdownDeadline?: number;
  private shutdownTimedOut = false;
  private activeOperations = 0;
  private onDrained?: () => void;
  constructor(
    private readonly client: ClientBase,
    private readonly options: PolarEventOptions,
  ) {
    this.queue = options.eventQueue === undefined ? new MemoryEventQueue() : options.eventQueue;
  }

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
    const queue = this.requireQueue();
    this.begin();
    try {
      await this.startQueue(queue);
      await queue.enqueue(queued);
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
   * @param input Customer identity and optional matching member identity.
   * @returns A helper that attaches this identity to events and reads customer meters.
   * @throws TypeError if customer or member identifiers are inconsistent.
   */
  actor(input: ActorInput): Actor {
    validateActor(input);
    const identity: ActorInput =
      input.customer_id != null
        ? { customer_id: input.customer_id, member_id: input.member_id }
        : {
            external_customer_id: input.external_customer_id,
            external_member_id: input.external_member_id,
          };
    const customer: MeterInput = identity.customer_id != null
      ? { customer_id: identity.customer_id }
      : { external_customer_id: identity.external_customer_id };
    return {
      warmup: () => this.warmup(customer),
      track: (event) => this.track({ ...event, ...identity }),
      meter: (meterId) => this.meter(meterId, customer),
    };
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
    this.begin();
    try {
      try {
        const outpost = await this.startOutpost();
        if (outpost) return await outpost.meter({ ...input, meter_id: meterId });
      } catch (error) {
        if (!(error instanceof UnknownMeterError || error instanceof PolarOutpostError))
          throw error;
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
    const queue = this.requireQueue();
    this.begin();
    try {
      await waitForDelivery(this.startQueue(queue), timeout);
      const remaining = Math.max(0, deadline - Date.now());
      await waitForDelivery(queue.flush({ timeoutMs: remaining }), remaining);
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

  private async warmup(customer: MeterInput): Promise<void> {
    this.begin();
    try {
      const outpost = await this.startOutpost();
      await outpost?.actor(customer);
    } catch (error) {
      if (!(error instanceof PolarOutpostError)) throw error;
    } finally {
      if (--this.activeOperations === 0) this.onDrained?.();
    }
  }

  private requireQueue(): EventQueue {
    if (!this.queue) throw new Error("Configure an eventQueue on the Polar client to track or flush events");
    return this.queue;
  }

  private begin(): void {
    if (this.closing) throw new Error("Polar client is closed");
    this.activeOperations++;
  }

  private startOutpost(): Promise<OutpostBackend | undefined> | undefined {
    if (!this.options.outpost || Date.now() < this.outpostRetryAt) return;
    this.startingOutpost ??= this.openOutpost(this.options.outpost).then((outpost) => {
      if (outpost === undefined) {
        this.outpostRetryAt = Date.now() + OUTPOST_START_RETRY_DELAY_MS;
        this.startingOutpost = undefined;
      }
      return outpost;
    });
    return this.startingOutpost;
  }

  private async openOutpost(createOutpost: OutpostFactory): Promise<OutpostBackend | undefined> {
    this.checkShutdownDeadline();
    try {
      const outpost = createOutpost(this.client);
      await outpost.start();
      await this.registerResource(outpost);
      this.outpost = outpost;
      return outpost;
    } catch (error) {
      if (!(error instanceof PolarOutpostError)) throw error;
      return undefined;
    }
  }

  private startQueue(queue: EventQueue): Promise<void> {
    this.startingQueue ??= this.openQueue(queue);
    return this.startingQueue;
  }

  private async openQueue(
    queue: EventQueue & Partial<Pick<RedisEventQueue, "redisUrl" | "startWithRedis">>,
  ): Promise<void> {
    const outpost = await this.startOutpost();
    this.checkShutdownDeadline();
    const options: EventQueueStartOptions = {
      ingest: createIngest(this.client),
      onAck: this.options.outpost || this.options.onEventAck ? this.onAck.bind(this) : undefined,
      onRejected: this.options.outpost || this.options.onEventRejected ? this.onRejected.bind(this) : undefined,
    };
    try {
      const redis = outpost?.redisForUrl(queue.redisUrl) as
        | Parameters<RedisEventQueue["startWithRedis"]>[1]
        | undefined;
      if (redis && queue.startWithRedis) await queue.startWithRedis(options, redis);
      else await queue.start(options);
    } catch (error) {
      if (!outpost) throw error;
      this.outpost = undefined;
      const timeout = this.shutdownDeadline === undefined
        ? deliveryTimeout()
        : Math.max(0, this.shutdownDeadline - Date.now());
      const cleanup = this.closeResources(timeout);
      this.startingOutpost = cleanup.then(() => undefined, () => undefined);
      try {
        await cleanup;
      } catch (cleanupError) {
        throw new AggregateError([error, cleanupError], "Polar client startup and cleanup failed");
      }
      throw error;
    }
    await this.registerResource(queue);
  }

  private checkShutdownDeadline(): void {
    if (
      this.shutdownTimedOut ||
      (this.shutdownDeadline !== undefined && Date.now() >= this.shutdownDeadline)
    )
      throw new MeteringTimeoutError(0);
  }

  private async registerResource(resource: Pick<EventQueue, "close">): Promise<void> {
    try {
      this.checkShutdownDeadline();
    } catch (error) {
      try {
        await waitForDelivery(resource.close({ timeoutMs: 0 }), 0);
      } catch (cleanupError) {
        throw new AggregateError([error, cleanupError], "Polar client startup and cleanup failed");
      }
      throw error;
    }
    if (resource === this.queue) this.running.push(resource);
    else this.running.unshift(resource);
  }

  private async onAck(events: EventInput[]): Promise<void> {
    await this.outpost?.onAck(events);
    try {
      await this.options.onEventAck?.(events);
    } catch (error) {
      console.warn(
        "Event acknowledgement hook failed",
        error instanceof Error ? error.constructor.name : typeof error,
      );
    }
  }

  private async onRejected(events: EventInput[], reason: DropReason): Promise<void> {
    await this.outpost?.onRejected(events, reason);
    try {
      await this.options.onEventRejected?.(events, reason);
    } catch (error) {
      console.warn(
        "Event rejection hook failed",
        error instanceof Error ? error.constructor.name : typeof error,
      );
    }
  }

  private async drain(deadline: number): Promise<void> {
    const errors: unknown[] = [];
    try {
      await waitForDelivery(
        Promise.allSettled([this.startingOutpost, this.startingQueue]),
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
    if (errors.length) throw new AggregateError(errors, "Polar client close failed");
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
    if (errors.length) throw new AggregateError(errors, "Polar client close failed");
  }
}
