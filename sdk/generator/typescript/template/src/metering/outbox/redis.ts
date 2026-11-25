import type { Redis } from "ioredis";

import { randomUUID } from "node:crypto";
import { setTimeout as sleep } from "node:timers/promises";

import {
  CONFIRM_SCRIPT,
  DEFAULT_TIMEOUT,
  backOff,
  connectRedis,
  createRedis,
  releaseLock,
  takeLock,
} from "../../redis";
import { type ClientBase, PolarClientError, PolarError } from "../../base";
import {
  type DeliveryOptions,
  type DropReason,
  MeteringTimeoutError,
  deliveryTimeout,
  retryAfterMs,
  waitForDelivery,
} from "../errors";
import type { EventInput } from "../event";
import type { Outbox } from "./index";

const OUTBOX_BATCH = {{ redis_constants.outbox_batch }};
const FLUSHERS = {{ redis_constants.outbox_flushers }};
const OUTBOX_CLAIM_IDLE = {{ redis_constants.outbox_claim_idle }};
export const FLUSHER_LOCK_TTL = {{ redis_constants.outbox_flusher_lock_ttl }};
export const DRAIN_INTERVAL = {{ redis_constants.outbox_drain_interval }};
const OUTBOX_RETRY_DELAY = {{ redis_constants.outbox_retry_delay }};
const MAX_OUTBOX_RETRY_DELAY = {{ redis_constants.outbox_max_retry_delay }};
// The consumer group the flushers read the outbox through.
const OUTBOX_GROUP = "polar";

const OUTBOX_BACKLOG_SCRIPT = `
{{ redis_scripts.outbox.outbox_backlog }}`;

interface OutboxRedis extends Redis {
  outpostConfirm(numberOfKeys: number, ...args: (string | number)[]): Promise<number>;
  outboxBacklog(
    key: string,
    backoffKey: string,
    group: string,
    ...ended: string[]
  ): Promise<[number, number, string]>;
}

// The outbox entries a flusher delivered, and the slot it holds.
export interface Delivery {
  entries: string[];
  lockKey: string;
  token: string;
}

// How many times a batch goes again without the events Polar named, before it is dropped whole.
const REFUSED_RESENDS = 3;

// The indexes of the events Polar's validation refuses, when each of its errors names one.
const refusedIndexes = (error: unknown): Set<number> | undefined => {
  if (!(error instanceof PolarClientError) || error.statusCode !== 422) return undefined;
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
    if (!Array.isArray(loc) || loc[0] !== "body" || loc[1] !== "events" || !Number.isInteger(loc[2]))
      return undefined;
    indexes.add(loc[2] as number);
  }
  return indexes;
};

// A number too large to read, such as 1e999, parses to an infinity no request could carry.
const holdsNoInfinity = (value: unknown): boolean => {
  if (typeof value === "number") return Number.isFinite(value);
  if (typeof value !== "object" || value === null) return true;
  return Object.values(value).every(holdsNoInfinity);
};


type Settle = (events: EventInput[], refused: EventInput[], delivery: Delivery) => Promise<void>;

export interface RedisOutboxOptions {
  client: Pick<ClientBase, "sendRequest" | "buildRequest" | "parseResponse">;
  /** Use a distinct stream per Polar environment and organization. */
  stream: string;
  /** May be replayed if the stream entries have not been acknowledged. */
  onAck?: (events: EventInput[]) => void | Promise<void>;
  /** May be replayed if the stream entries have not been acknowledged. */
  onRejected?: (events: EventInput[], reason: DropReason) => void | Promise<void>;
}

export class RedisOutbox implements Outbox {
  private redis?: OutboxRedis;
  private settle?: Settle;
  private timer?: ReturnType<typeof setInterval>;
  private draining?: Promise<void>;
  private drainAgain = false;
  private undrained = false;

  constructor(
    private readonly redisUrl: string,
    private readonly options: RedisOutboxOptions,
  ) {}

  async start(): Promise<this> {
    if (this.redis) throw new PolarError("Redis outbox is already connected");
    const redis = createRedis(this.redisUrl);
    this.redis = redis as OutboxRedis;
    try {
      await connectRedis(redis);
      await this.attach(redis);
      this.timer = setInterval(() => void this.drain().catch(() => {}), DRAIN_INTERVAL);
      return this;
    } catch (error) {
      this.redis = undefined;
      redis.disconnect();
      throw error;
    }
  }

  async close(): Promise<void> {
    clearInterval(this.timer);
    try {
      await waitForDelivery(this.drainQueued(), deliveryTimeout()).catch(() => {});
    } finally {
      this.redis?.disconnect();
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
    this.markQueued();
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

  /** @internal Attach to the Redis connection owned by Outpost. */
  async attach(redis: Redis, settle?: Settle): Promise<void> {
    this.redis = redis as OutboxRedis;
    this.settle = settle;
    redis.defineCommand("outboxBacklog", { numberOfKeys: 2, lua: OUTBOX_BACKLOG_SCRIPT });
    if (!settle) redis.defineCommand("outpostConfirm", { lua: CONFIRM_SCRIPT });
    await this.createOutboxGroup();
  }

  /** @internal Outpost may enqueue through its bucket script. */
  markQueued(): void {
    this.undrained = true;
  }

  /** @internal Preserve Outpost's best-effort drain and shutdown behavior. */
  async drainQueued(force = false): Promise<void> {
    if (!this.redis) return;
    await (force || this.undrained ? this.drain() : this.draining)?.catch(() => {});
  }

  private requireRedis(): OutboxRedis {
    if (!this.redis) throw new PolarError("Call RedisOutbox.start() before using RedisOutbox");
    return this.redis;
  }

  private get backoffKey(): string {
    return `${this.options.stream}:backoff`;
  }

  // A flusher reads the outbox through the group, which tracks each batch until Polar has it.
  private async createOutboxGroup(): Promise<void> {
    await this.requireRedis()
      .xgroup("CREATE", this.options.stream, OUTBOX_GROUP, "0", "MKSTREAM")
      .catch((error: unknown) => {
        if (!String(error).includes("BUSYGROUP")) throw error;
      });
  }

  // One flusher per OUTBOX_BATCH events waiting, up to FLUSHERS across the fleet. Once its
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
        await this.drainOutbox().catch((error: unknown) => {
          this.undrained = true;
          throw error;
        });
      } while (this.drainAgain);
    };
    this.draining = drain().finally(() => (this.draining = undefined));
    return this.draining;
  }

  private async drainOutbox(): Promise<void> {
    const redis = this.requireRedis();
    try {
      // The backoff a round delivered past: the next round's read ends it.
      let ended: string[] = [];
      for (let round = 0; ; round += 1) {
        const [length, delivering, retryAt] = await redis.outboxBacklog(
          this.options.stream,
          this.backoffKey,
          OUTBOX_GROUP,
          ...ended,
        );
        // The first round also takes back the batches that wait on a failed or frozen flusher.
        if (!length || (round && length === delivering)) return;
        // Polar failed to take a batch: the fleet waits before sending the outbox again.
        if (Number(retryAt) > Date.now()) {
          this.undrained = true;
          return;
        }
        // A partial batch goes only when no flusher delivers: the last one in flight takes it.
        const full = Math.floor((length - delivering) / OUTBOX_BATCH);
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
      if (String(error).includes("NOGROUP")) await this.createOutboxGroup();
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
        await redis.xautoclaim(this.options.stream, OUTBOX_GROUP, consumer, OUTBOX_CLAIM_IDLE, "0-0", "COUNT", OUTBOX_BATCH, "JUSTID");
      for (let from = "0"; ; ) {
        if (from === ">") {
          const [length, delivering] = await redis.outboxBacklog(this.options.stream, this.backoffKey, OUTBOX_GROUP);
          if (length === delivering) return "drained";
          // The flusher still in flight takes a partial batch; if it let go meanwhile, the next
          // drain does.
          if (delivering && length - delivering < OUTBOX_BATCH) {
            this.undrained = true;
            return "drained";
          }
        }
        const read = (await redis.xreadgroup("GROUP", OUTBOX_GROUP, consumer, "COUNT", OUTBOX_BATCH, "STREAMS", this.options.stream, from)) as
          | [string, [string, string[] | null][]][]
          | null;
        const entries = read?.[0]?.[1] ?? [];
        if (entries.length) {
          const ids = entries.map(([id]) => id);
          if (!(await this.deliver(entries, { entries: ids, lockKey, token }))) {
            // Slot 0 starts every drain and sends what it holds first: the batch goes to it, and
            // does not wait for a drain large enough to start this slot again.
            if (slot)
              await redis.xclaim(this.options.stream, OUTBOX_GROUP, "flusher-0", 0, ...ids, "JUSTID").catch(() => {});
            return "failed";
          }
        } else if (from === "0") from = ">";
      }
    } finally {
      // Past its TTL, the slot may be another flusher's.
      await releaseLock(redis, lockKey, token);
    }
  }

  // Sends a batch to Polar, then acknowledges it and settles its events in one script. Polar
  // refusing the batch drops it; failing to take it leaves it for the next flush.
  private async deliver(entries: [string, string[] | null][], delivery: Delivery): Promise<boolean> {
    // An entry that is not JSON can never be sent: it leaves the outbox with the batch.
    let events = entries.flatMap(([, fields]) => {
      if (!fields) return [];
      try {
        const event: EventInput = JSON.parse(fields[1]);
        if (!holdsNoInfinity(event)) throw new TypeError("An infinity is not JSON");
        return [event];
      } catch {
        console.warn("Redis outbox dropped an outbox entry it cannot read");
        return [];
      }
    });
    const refused: EventInput[] = [];
    for (let resent = 0; events.length; resent += 1)
      try {
        const { client } = this.options;
        const response = await client.sendRequest(
          client.buildRequest("POST", "/v1/events/ingest", undefined, undefined, { events }),
          { timeout: DEFAULT_TIMEOUT / 1000 },
        );
        if (!response.ok) {
          if (response.status < 400) throw new PolarError(`Polar answered ${response.status}`);
          await client.parseResponse(response, "none");
        }
        await response.body?.cancel().catch(() => {});
        break;
      } catch (error) {
        // Polar refuses a whole request for the events it names: the others go again without
        // them, a few times at most.
        const named = refusedIndexes(error);
        if (named?.size && named.size < events.length && resent < REFUSED_RESENDS) {
          refused.push(...events.filter((_, index) => named.has(index)));
          events = events.filter((_, index) => !named.has(index));
          continue;
        }
        if (error instanceof PolarClientError && ![401, 403, 408, 429].includes(error.statusCode)) {
          refused.push(...events);
          events = [];
          break;
        }
        // As long as Polar asks, or longer after each failure in a row.
        const wait = retryAfterMs(error);
        await backOff(this.redis, this.backoffKey, {
          first: wait ?? OUTBOX_RETRY_DELAY,
          max: wait ?? MAX_OUTBOX_RETRY_DELAY,
        });
        return false;
      }
    if (this.settle) {
      await this.settle(events, refused, delivery);
    } else {
      if (refused.length) await this.options.onRejected?.(refused, "permanent_error");
      if (events.length) await this.options.onAck?.(events);
      await this.requireRedis().outpostConfirm(
        2,
        this.options.stream,
        delivery.lockKey,
        "",
        delivery.token,
        FLUSHER_LOCK_TTL,
        delivery.entries.length,
        ...delivery.entries,
      );
    }
    return true;
  }
}
