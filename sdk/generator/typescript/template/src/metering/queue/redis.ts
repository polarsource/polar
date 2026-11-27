import type { Redis } from "ioredis";

import { randomUUID } from "node:crypto";
import { setTimeout as sleep } from "node:timers/promises";

import {
  backOff,
  connectRedis,
  createRedis,
  releaseLock,
  takeLock,
} from "../../redis";
import {
  type DeliveryOptions,
  MeteringTimeoutError,
  deliveryTimeout,
  IngestRejectedError,
  IngestRetryableError,
  waitForDelivery,
} from "../errors";
import type { EventInput } from "../event";
import type { EventQueue, EventQueueStartOptions } from "./index";

const QUEUE_BATCH = {{ redis_constants.queue_batch }};
const FLUSHERS = {{ redis_constants.queue_flushers }};
const QUEUE_CLAIM_IDLE = {{ redis_constants.queue_claim_idle }};
const FLUSHER_LOCK_TTL = {{ redis_constants.queue_flusher_lock_ttl }};
const FLUSH_TENURE = {{ redis_constants.queue_flush_tenure }};
const DRAIN_INTERVAL = {{ redis_constants.queue_drain_interval }};
const QUEUE_RETRY_DELAY = {{ redis_constants.queue_retry_delay }};
const MAX_QUEUE_RETRY_DELAY = {{ redis_constants.queue_max_retry_delay }};
// The consumer group the flushers read the queue through.
const QUEUE_GROUP = "polar";

const QUEUE_BACKLOG_SCRIPT = `
{{ redis_scripts.queue.queue_backlog }}`;

const ACKNOWLEDGE_SCRIPT = `
{{ redis_scripts.queue.acknowledge }}`;

interface QueueRedis extends Redis {
  queueAcknowledge(
    stream: string,
    lockKey: string,
    group: string,
    token: string,
    ttl: number,
    ...ids: string[]
  ): Promise<void>;
  queueBacklog(
    key: string,
    backoffKey: string,
    group: string,
    ...ended: string[]
  ): Promise<[number, number, string]>;
}

// The queue entries a flusher delivered, and the slot it holds.
interface Delivery {
  entries: string[];
  lockKey: string;
  token: string;
}

// How many times a batch goes again without the events Polar named, before it is dropped whole.
const REFUSED_RESENDS = 3;

// A number too large to read, such as 1e999, parses to an infinity no request could carry.
const holdsNoInfinity = (value: unknown): boolean => {
  if (typeof value === "number") return Number.isFinite(value);
  if (typeof value !== "object" || value === null) return true;
  return Object.values(value).every(holdsNoInfinity);
};

export interface RedisEventQueueOptions {
  /** Use a distinct stream per Polar environment and organization. */
  stream: string;
}

export class RedisEventQueue implements EventQueue {
  private session?: EventQueueStartOptions;
  private ownsRedis = false;

  private redis?: QueueRedis;
  private timer?: ReturnType<typeof setInterval>;
  private draining?: Promise<void>;
  private drainUntil = Infinity;
  private drainAgain = false;
  private undrained = false;

  constructor(
    private readonly redisSource: string | Redis,
    private readonly options: RedisEventQueueOptions,
  ) {}

  get redisUrl(): string | undefined {
    return typeof this.redisSource === "string" ? this.redisSource : undefined;
  }

  start(options: EventQueueStartOptions): Promise<this> {
    return this.open(this.redisSource, options);
  }

  /** @internal */
  startWithRedis(options: EventQueueStartOptions, redis: Redis): Promise<this> {
    return this.open(redis, options);
  }

  async close(options?: DeliveryOptions): Promise<void> {
    const timeout = deliveryTimeout(options);
    clearInterval(this.timer);
    try {
      if (this.redis && (this.undrained || this.draining)) this.limitDrain();
      const draining = this.redis && this.undrained ? this.drain() : this.draining;
      if (draining) await waitForDelivery(draining.catch(() => {}), timeout);
    } finally {
      this.session = undefined;
      if (this.ownsRedis) this.redis?.disconnect();
      this.redis = undefined;
    }
  }

  async enqueue(event: EventInput): Promise<void> {
    const queued = JSON.stringify({
      ...event,
      external_id: event.external_id || randomUUID(),
      timestamp: event.timestamp ?? new Date().toISOString(),
    });
    await this.requireRedis().xadd(this.options.stream, "*", "event", queued);
    this.undrained = true;
  }

  async flush(options?: DeliveryOptions): Promise<void> {
    const redis = this.requireRedis();
    const timeout = deliveryTimeout(options);
    const deadline = performance.now() + timeout;
    const [[end] = []] = await waitForDelivery(
      redis.xrevrange(this.options.stream, "+", "-", "COUNT", 1),
      timeout,
    );
    if (end === undefined) return;
    for (;;) {
      this.limitDrain();
      await waitForDelivery(this.drain().catch(() => {}), Math.max(0, deadline - performance.now()));
      const entries = await waitForDelivery(
        redis.xrange(this.options.stream, "-", end, "COUNT", 1),
        Math.max(0, deadline - performance.now()),
      );
      if (!entries.length) return;
      const remaining = deadline - performance.now();
      if (remaining <= 0) throw new MeteringTimeoutError(timeout);
      await sleep(Math.min(DRAIN_INTERVAL, remaining));
    }
  }

  private async open(source: string | Redis, options: EventQueueStartOptions): Promise<this> {
    if (this.redis) throw new Error("Redis queue is already connected");
    const redis = typeof source === "string" ? createRedis(source) : source;
    this.ownsRedis = typeof source === "string";
    this.redis = redis as QueueRedis;
    try {
      if (this.ownsRedis) await connectRedis(redis);
      redis.defineCommand("queueBacklog", { numberOfKeys: 2, lua: QUEUE_BACKLOG_SCRIPT });
      redis.defineCommand("queueAcknowledge", { numberOfKeys: 2, lua: ACKNOWLEDGE_SCRIPT });
      await this.createQueueGroup();
      this.session = options;
      this.timer = setInterval(() => void this.drain().catch(() => {}), DRAIN_INTERVAL);
      return this;
    } catch (error) {
      this.redis = undefined;
      if (this.ownsRedis) redis.disconnect();
      throw error;
    }
  }

  private requireRedis(): QueueRedis {
    if (!this.redis) throw new Error("Call RedisEventQueue.start() before using RedisEventQueue");
    return this.redis;
  }

  private get backoffKey(): string {
    return `${this.options.stream}:backoff`;
  }

  // A flusher reads the queue through the group, which tracks each batch until Polar has it.
  private async createQueueGroup(): Promise<void> {
    await this.requireRedis()
      .xgroup("CREATE", this.options.stream, QUEUE_GROUP, "0", "MKSTREAM")
      .catch((error: unknown) => {
        if (!String(error).includes("BUSYGROUP")) throw error;
      });
  }

  // One flusher per QUEUE_BATCH events waiting, up to FLUSHERS across the fleet. Once its
  // flushers let go of their slots, the instance looks again: an event queued while they held
  // them is not left behind.
  // One drain at a time per instance: a flush during one waits for it, and asks for one more round
  // so that its own events do not stay queued.
  private drain(): Promise<void> {
    if (this.draining) {
      this.drainAgain = true;
      return this.draining;
    }
    const drain = async () => {
      do {
        this.drainAgain = false;
        this.undrained = false;
        await this.drainEventQueue().catch((error: unknown) => {
          this.undrained = true;
          console.warn("Redis queue drain failed", error);
          throw error;
        });
      } while (this.drainAgain);
    };
    this.draining = drain().finally(() => {
      this.draining = undefined;
      this.drainUntil = Infinity;
    });
    return this.draining;
  }

  private limitDrain(): void {
    this.drainUntil = Math.min(this.drainUntil, Date.now() + FLUSH_TENURE);
  }

  private async drainEventQueue(): Promise<void> {
    const redis = this.requireRedis();
    try {
      // The backoff a round delivered past: the next round's read ends it.
      let ended: string[] = [];
      for (let round = 0; ; round += 1) {
        if (Date.now() >= this.drainUntil) {
          this.undrained = true;
          return;
        }
        const [length, delivering, retryAt] = await redis.queueBacklog(
          this.options.stream,
          this.backoffKey,
          QUEUE_GROUP,
          ...ended,
        );
        // The first round also takes back the batches that wait on a failed or frozen flusher.
        if (!length || (round && length === delivering)) return;
        // Polar failed to take a batch: the fleet waits before sending the queue again.
        if (Number(retryAt) > Date.now()) {
          this.undrained = true;
          return;
        }
        // A partial batch goes only when no flusher delivers: the last one in flight takes it.
        const full = Math.floor((length - delivering) / QUEUE_BATCH);
        const slots = Math.min(FLUSHERS, full || (round && delivering ? 0 : 1));
        if (!slots) return;
        const outcomes = await Promise.all(Array.from({ length: slots }, (_, slot) => this.flushSlot(slot)));
        if (outcomes.includes("failed")) {
          this.undrained = true;
          return;
        }
        if (!outcomes.includes("drained")) return;
        // Polar takes batches again: the next failure waits the first delay.
        ended = retryAt ? [retryAt] : [];
      }
    } catch (error) {
      // Redis lost the group, with the rest of its keys: the next flush reads a new one.
      if (String(error).includes("NOGROUP")) await this.createQueueGroup();
      throw error;
    }
  }

  // A batch whose flusher froze is taken back once idle long enough; one this slot left behind,
  // as Polar failed, goes before the new events.
  private async flushSlot(slot: number): Promise<"busy" | "failed" | "drained"> {
    const redis = this.requireRedis();
    const lockKey = `${this.options.stream}:flusher:${slot}`;
    const consumer = `flusher-${slot}`;
    const token = await takeLock(redis, lockKey, FLUSHER_LOCK_TTL);
    if (!token) return "busy";
    try {
      if (slot === 0)
        await redis.xautoclaim(this.options.stream, QUEUE_GROUP, consumer, QUEUE_CLAIM_IDLE, "0-0", "COUNT", QUEUE_BATCH, "JUSTID");
      for (let from = "0"; ; ) {
        if (from === ">") {
          if (Date.now() >= this.drainUntil) {
            this.undrained = true;
            return "drained";
          }
          const [length, delivering] = await redis.queueBacklog(this.options.stream, this.backoffKey, QUEUE_GROUP);
          if (length === delivering) return "drained";
          // The flusher still in flight takes a partial batch; if it let go meanwhile, the next
          // drain does.
          if (delivering && length - delivering < QUEUE_BATCH) {
            this.undrained = true;
            return "drained";
          }
        }
        const read = (await redis.xreadgroup("GROUP", QUEUE_GROUP, consumer, "COUNT", QUEUE_BATCH, "STREAMS", this.options.stream, from)) as
          | [string, [string, string[] | null][]][]
          | null;
        const entries = read?.[0]?.[1] ?? [];
        if (entries.length) {
          const ids = entries.map(([id]) => id);
          if (!(await this.deliver(entries, { entries: ids, lockKey, token }))) {
            // Slot 0 starts every drain and sends what it holds first: the batch goes to it, and
            // does not wait for a drain large enough to start this slot again.
            if (slot)
              await redis.xclaim(this.options.stream, QUEUE_GROUP, "flusher-0", 0, ...ids, "JUSTID").catch(() => {});
            return "failed";
          }
        } else if (from === "0") from = ">";
      }
    } finally {
      // Past its TTL, the slot may be another flusher's.
      await releaseLock(redis, lockKey, token);
    }
  }

  private async deliver(entries: [string, string[] | null][], delivery: Delivery): Promise<boolean> {
    const session = this.session;
    if (!session) return false;
    // An entry that is not JSON can never be sent: it leaves the queue with the batch.
    let events = entries.flatMap(([, fields]) => {
      if (!fields) return [];
      try {
        const event: EventInput = JSON.parse(fields[1]);
        if (!holdsNoInfinity(event)) throw new TypeError("An infinity is not JSON");
        return [event];
      } catch {
        console.warn("Redis queue dropped an unreadable entry");
        return [];
      }
    });
    const refused: EventInput[] = [];
    for (let resent = 0; events.length; resent += 1) {
      try {
        await session.ingest(events);
        break;
      } catch (error) {
        if (error instanceof IngestRetryableError) {
          const wait = error.retryAfterMs;
          await backOff(this.redis, this.backoffKey, {
            first: wait ?? QUEUE_RETRY_DELAY,
            max: wait ?? MAX_QUEUE_RETRY_DELAY,
          });
          return false;
        }
        if (!(error instanceof IngestRejectedError)) throw error;
        const named = error.rejectedIndexes;
        if (named?.size && named.size < events.length && resent < REFUSED_RESENDS) {
          refused.push(...events.filter((_, index) => named.has(index)));
          events = events.filter((_, index) => !named.has(index));
          continue;
        }
        refused.push(...events);
        events = [];
      }
    }
    if (refused.length) await this.session?.onRejected?.(refused, "permanent_error");
    if (events.length) await this.session?.onAck?.(events);
    await this.requireRedis().queueAcknowledge(
      this.options.stream,
      delivery.lockKey,
      QUEUE_GROUP,
      delivery.token,
      FLUSHER_LOCK_TTL,
      ...delivery.entries,
    );
    return true;
  }
}
