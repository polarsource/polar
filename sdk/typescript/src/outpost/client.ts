import type { MeterProvider } from "@opentelemetry/sdk-metrics";
import type { TracerProvider } from "@opentelemetry/sdk-trace";

import {
  INVALID_SPAN_CONTEXT,
  SpanStatusCode,
  trace,
  type Attributes,
  type Counter,
  type Gauge,
  type Histogram,
  type Span,
  type Tracer,
} from "@opentelemetry/api";
import { Redis, type ChainableCommander } from "ioredis";
import { createHash, randomUUID } from "node:crypto";
import { once } from "node:events";
import { setTimeout as sleep } from "node:timers/promises";

import type { EventInput } from "../metering/event";
import type { CustomerMeter } from "../metering/meter";

import { ClientBase, PolarClientError, PolarError, PolarRateLimitError } from "../base";
import { type MeteringOutpost, OUTPOST } from "../metering/client";
import {
  type DropReason,
  MeteringError,
  UnknownMeterError,
  retryAfterMs,
} from "../metering/errors";
import {
  MissingExternalIdError,
  NotReadyError,
  PolarOutpostError,
  RefusedError,
  UnavailableRedisError,
  isRedisConnectionError,
  redisUnavailable,
} from "./errors";
import { customerKey, parseEvent } from "./event";
import {
  matchEvent,
  withMatchers,
  getBucketStart,
  BUCKET_SIZE,
  type Reducer,
  type ReducerMatchers,
  type BucketStatistics,
  emptyStatistics,
  addStatistics,
} from "./reducer";
import {
  READ_STATES_SCRIPT,
  PREPARE_SNAPSHOT_SCRIPT,
  PUSH_TELEMETRY_SCRIPT,
  WRITE_BUCKET_SCRIPT,
  CONFIRM_SCRIPT,
  APPLY_SNAPSHOT_SCRIPT,
  COMMIT_PULL_SCRIPT,
  BACKOFF_SCRIPT,
  RELEASE_LOCK_SCRIPT,
  EXTEND_LOCK_SCRIPT,
  OUTBOX_BACKLOG_SCRIPT,
} from "./scripts";
import {
  COLD_PREFIX,
  consumedUnits,
  decodeState,
  isReady,
  number,
  statisticsOf,
  type Read,
} from "./state";
import {
  createMeterProvider,
  createTracerProvider,
  isTelemetryEnabled,
  TelemetryBuffer,
  relay,
  SAMPLE_RATE_ATTRIBUTE,
} from "./telemetry";

// Shared by every Outpost SDK: sdk/generator/outpost/constants.toml says what each one means.
const KEY_VERSION = "outpost:v1";
const TIMEOUT = 5000;
const SNAPSHOT_TIMEOUT = 5000;
const CONFIRM_TIMEOUT = 2000;
const CONFIRM_BATCH = 1000;
const OUTBOX_BATCH = 1000;
const FLUSHERS = 32;
const OUTBOX_CLAIM_IDLE = 60000;
const FLUSHER_LOCK_TTL = 30000;
const FLUSH_TENURE = 5000;
const DRAIN_INTERVAL = 1000;
const OUTBOX_RETRY_DELAY = 1000;
const MAX_OUTBOX_RETRY_DELAY = 60000;
// The consumer group the flushers read the outbox through.
const OUTBOX_GROUP = "polar";
const REPORT_INTERVAL = 30000;
const SPAN_SAMPLE_RATE = 10;
const TELEMETRY_CAP = 1000;
const RELAY_LOCK_TTL = 30000;
const POLL_INTERVAL = 25;
const REDIS_RECONNECT_DELAY = 100;
const MAX_REDIS_RECONNECT_DELAY = 2000;
const PULL_INTERVAL = 30000;
const PULL_LOCK_TTL = 10000;
const PULL_RETRY_DELAY = 1000;
const MAX_PULL_RETRY_DELAY = 30000;
const PULL_LIMIT = 500;
const PULL_CONCURRENCY = 16;
const SNAPSHOT_BATCH = 500;
const FETCH_BATCH_WINDOW = 10;
const FETCH_CONCURRENCY = 3;
const FETCH_RETRY_DELAY = 100;
const PULL_CHECK_INTERVAL = 1000;
type Customer = Parameters<typeof customerKey>[0];
interface Snapshot {
  reducer_id: string;
  customer_id: string | null;
  external_customer_id: string | null;
  customer_exists: boolean;
  cold_until: number;
  version: number;
  count: number;
  sum: number;
  min: number | null;
  max: number | null;
}
interface Confirmed {
  ids: string[];
  // Read with the ids: it counts exactly those.
  snapshot: Snapshot;
}
interface Changes {
  changes: Snapshot[];
  cursor: string;
  has_more: boolean;
  // Changes were missed: every snapshot may be stale.
  reset: boolean;
  configuration_changed: boolean;
  // Seconds.
  next_poll_in: number;
}
// What Polar said of the pending events a snapshot seals.
interface Confirmation {
  snapshot: Snapshot;
  started: number;
  age: number;
  messages: number;
  asked: number;
  confirmed: Map<number, string[]>;
}
interface OutpostRedis extends Redis {
  outpostReadStates(numberOfKeys: number, ...args: string[]): Promise<unknown[]>;
  outpostPrepareSnapshot(
    key: string,
    missingKey: string,
    pulled: string,
    coldUntil: number,
  ): Promise<string[] | null>;
  outpostPushTelemetry(
    spansKey: string,
    metricsKey: string,
    ...args: (string | number | Buffer)[]
  ): Promise<number>;
  outpostConfirm(numberOfKeys: number, ...args: (string | number)[]): Promise<number>;
  outpostApplySnapshot(key: string, ...args: (string | number)[]): Promise<string[]>;
  outpostOutboxBacklog(
    key: string,
    backoffKey: string,
    group: string,
    ...ended: string[]
  ): Promise<[number, number, string]>;
  outpostCommitPull(key: string, lockKey: string, ...args: (string | number)[]): Promise<number>;
}
interface OutpostPipeline extends ChainableCommander {
  outpostWriteBucket(
    key: string,
    pendingKey: string,
    outboxKey: string,
    flusherKey: string,
    ...args: (string | number)[]
  ): this;
  outpostConfirm(numberOfKeys: number, ...args: (string | number)[]): this;
  outpostApplySnapshot(key: string, ...args: (string | number)[]): this;
}

interface Settlement {
  identity: string;
  bucketStart: number;
  ids: string[];
}

// The outbox entries a flusher delivered, and the slot it holds.
interface Delivery {
  entries: string[];
  lockKey: string;
  token: string;
}

// The arguments of one CONFIRM call settling every group, with its number of keys first.
const confirmArguments = (
  prefix: string,
  hotOnly: boolean,
  settlements: Settlement[],
  delivery?: Delivery,
): [number, ...(string | number)[]] => [
  2 + settlements.length * 2,
  `${prefix}:outbox`,
  delivery?.lockKey ?? `${prefix}:outbox`,
  ...settlements.flatMap(({ identity, bucketStart }) => [
    `${prefix}:state:${identity}`,
    `${prefix}:pending:${identity}:${bucketStart}`,
  ]),
  hotOnly ? "1" : "",
  delivery?.token ?? "",
  FLUSHER_LOCK_TTL,
  delivery?.entries.length ?? 0,
  ...(delivery?.entries ?? []),
  ...settlements.flatMap(({ bucketStart, ids }) => [bucketStart, ids.length, ...ids]),
];

const withTimeout = async <T>(promise: Promise<T>): Promise<T> => {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new NotReadyError("Outpost operation timed out")), TIMEOUT);
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
};
const eachAtMost = async <T>(
  items: T[],
  limit: number,
  work: (item: T) => Promise<void>,
): Promise<void> => {
  let next = 0;
  // Every worker ends before a failure goes up: the caller's cleanup must not run under them.
  const workers = await Promise.allSettled(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (next < items.length) await work(items[next++]);
    }),
  );
  const failed = workers.find((worker) => worker.status === "rejected");
  if (failed) throw failed.reason;
};
const reconnectDelay = (attempt: number): number =>
  Math.min(MAX_REDIS_RECONNECT_DELAY, REDIS_RECONNECT_DELAY * 2 ** (attempt - 1)) *
  (0.5 + Math.random() / 2);
const waitAtMost = async (promise: Promise<unknown>, milliseconds: number): Promise<void> => {
  let timer: ReturnType<typeof setTimeout> | undefined;
  await Promise.race([
    promise,
    new Promise((resolve) => {
      timer = setTimeout(resolve, milliseconds);
    }),
  ]);
  clearTimeout(timer);
};
// Extends a lock at most once per quarter of its time to live: it stays held, and a page of
// snapshots does not cost a command each.
const throttled = (extend: () => Promise<unknown>, ttl: number): (() => Promise<unknown>) => {
  let extended = Date.now();
  return async () => {
    if (Date.now() - extended < ttl / 4) return;
    extended = Date.now();
    await extend();
  };
};

const isClose = (a: number, b: number): boolean =>
  Math.abs(a - b) <= 1e-9 * Math.max(Math.abs(a), Math.abs(b));

const reportLocalValue = (
  span: Span,
  snapshot: Snapshot,
  replaced: string[],
  // The state before the transaction settled confirmed events out of the pending part.
  before?: Record<string, string>,
): void => {
  const fields: Record<string, string> = {};
  for (let index = 0; index < replaced.length; index += 2)
    fields[replaced[index]] = replaced[index + 1];
  if (fields.cold_until === undefined) return;
  const previous = Number(fields.cold_until);
  const local = emptyStatistics();
  const buckets = new Map<string, BucketStatistics>();
  const pending = new Map<string, BucketStatistics>();
  for (const [field, value] of Object.entries(before ?? fields)) {
    if (field.startsWith(COLD_PREFIX)) {
      local[field.slice(COLD_PREFIX.length) as keyof BucketStatistics] = number(value);
      continue;
    }
    const [kind, start, statistic] = field.split(":");
    if ((kind !== "bucket" && kind !== "pending") || Number(start) >= snapshot.cold_until) continue;
    const group = kind === "bucket" ? buckets : pending;
    const statistics = group.get(start) ?? emptyStatistics();
    statistics[statistic as keyof BucketStatistics] = number(value);
    group.set(start, statistics);
  }
  // A bucket already cold before this snapshot was read by its pending part only.
  for (const [start, bucket] of buckets)
    addStatistics(
      local,
      Number(start) < previous ? (pending.get(start) ?? emptyStatistics()) : bucket,
    );
  span.setAttributes({
    "outpost.local.cold_until": previous,
    "outpost.local.count": local.count,
    "outpost.local.sum": local.sum,
    "outpost.snapshot.count": snapshot.count,
    "outpost.snapshot.sum": snapshot.sum,
    "outpost.snapshot.delta":
      local.count !== snapshot.count ||
      !isClose(local.sum, snapshot.sum) ||
      local.min !== snapshot.min ||
      local.max !== snapshot.max,
  });
  for (const statistic of ["min", "max"] as const) {
    const localValue = local[statistic];
    if (localValue !== null) span.setAttribute(`outpost.local.${statistic}`, localValue);
    const snapshotValue = snapshot[statistic];
    if (snapshotValue !== null) span.setAttribute(`outpost.snapshot.${statistic}`, snapshotValue);
  }
};

// The reset count of a state whose snapshot Polar did not confirm.
const UNCONFIRMED = -1;

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
    if (
      !Array.isArray(loc) ||
      loc[0] !== "body" ||
      loc[1] !== "events" ||
      !Number.isInteger(loc[2])
    )
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

// A lock holds its owner's token: only the owner extends or releases it. Past its TTL, it may be
// another instance's.
const takeLock = async (redis: Redis, key: string, ttl: number): Promise<string | null> => {
  const token = randomUUID();
  return (await redis.set(key, token, "PX", ttl, "NX")) ? token : null;
};

const releaseLock = async (redis: Redis, key: string, token: string): Promise<void> => {
  await redis.eval(RELEASE_LOCK_SCRIPT, 1, key, token).catch(() => {});
};

const recordError = (span: Span, error: unknown): void => {
  span.recordException(error instanceof Error ? error : String(error));
  span.setStatus({ code: SpanStatusCode.ERROR });
};

export const isSampled = (traceId: string): boolean =>
  Number.parseInt(traceId.slice(-8), 16) % SPAN_SAMPLE_RATE === 0;

const customerArguments = (customer: string): Customer => {
  const separator = customer.indexOf(":");
  return {
    [customer.startsWith("customer:") ? "customer_id" : "external_customer_id"]: customer.slice(
      separator + 1,
    ),
  };
};

export interface OutpostOptions {
  client: Pick<ClientBase, "buildRequest" | "sendRequest" | "parseResponse">;
  /** Send Outpost telemetry to Polar. Also disabled by `POLAR_OUTPOST_TELEMETRY=0`. */
  telemetry?: boolean;
  /** How long a read of a cold customer waits for its first snapshot, in milliseconds. */
  snapshotTimeout?: number;
  /**
   * How long a confirm request waits for Polar, in milliseconds. Defaults to 2000; the snapshot
   * then applies with the events still pending.
   */
  confirmTimeout?: number;
  /** Called with each batch of events Polar accepted from the outbox; may be async. */
  onDelivered?: (events: EventInput[]) => void | Promise<void>;
  /** Called with each batch of events Polar refused, which leave the outbox; may be async. */
  onDropped?: (events: EventInput[], reason: DropReason) => void | Promise<void>;
}
export class Outpost {
  private redis?: OutpostRedis;
  private _connectionId?: string;
  private tracerProvider?: TracerProvider;
  private tracer?: Tracer;
  private meterProvider?: MeterProvider;
  private ingestDuration?: Histogram;
  private ingestBuckets?: Counter;
  private readDuration?: Histogram;
  private redisMemory?: Gauge;
  private redisKeys?: Gauge;
  private reducers: Reducer[] = [];
  private matchers: ReducerMatchers = [];
  private readonly requesting = new Map<string, Promise<void>>();
  private readonly telemetryBuffer = new TelemetryBuffer();
  private queued: { identity: string; done: () => void }[] = [];
  private fetchTimer?: ReturnType<typeof setTimeout>;
  private isConfigured = false;
  private prefix = KEY_VERSION;
  private telemetryTimer?: ReturnType<typeof setInterval>;
  private pullTimer?: ReturnType<typeof setInterval>;
  private drainTimer?: ReturnType<typeof setInterval>;
  private pulledAt = 0;
  private pullInterval = PULL_INTERVAL;
  private pulling?: Promise<void>;
  private relaying?: Promise<void>;
  private releaseFlush?: () => void;
  private draining?: Promise<void>;
  // When the drain in flight hands its slots over: never, unless a flush or a close waits on it.
  private drainUntil = Infinity;
  private drainAgain = false;
  // This instance queued an event that no flusher was there to deliver: its next flush drains.
  private undrained = false;
  private pullRetryAt = 0;
  // The configuration's revision in the pull hash, as of the configuration this instance runs.
  private configurationRevision: number | null = null;
  // How many times Polar's changes went past their retention, as of the last read of the pull hash.
  private resets: number | null = null;
  private failure?: PolarOutpostError;
  private failedAt = 0;
  private applying: Promise<unknown> = Promise.resolve();

  constructor(
    readonly redisUrl: string,
    private readonly options: OutpostOptions,
  ) {}

  get connectionId(): string | undefined {
    return this._connectionId;
  }

  get connected(): boolean {
    return !this.failure && this.redis?.status === "ready" && this.isConfigured;
  }

  async start(): Promise<this> {
    if (this.redis) throw new PolarError("Outpost is already connected");
    this.failure = undefined;
    this.pullRetryAt = 0;
    this.configurationRevision = null;
    this.resets = null;
    this.isConfigured = false;
    this.applying = Promise.resolve();
    if (isTelemetryEnabled(this.options.telemetry ?? true)) {
      this.tracerProvider = createTracerProvider(this.telemetryBuffer);
      this.tracer = this.tracerProvider.getTracer("polar.outpost");
      this.meterProvider = createMeterProvider(this.telemetryBuffer);
      const meter = this.meterProvider.getMeter("polar.outpost");
      this.ingestDuration = meter.createHistogram("outpost.ingest.duration", { unit: "s" });
      this.ingestBuckets = meter.createCounter("outpost.ingest.buckets");
      this.readDuration = meter.createHistogram("outpost.read.duration", { unit: "s" });
      this.redisMemory = meter.createGauge("outpost.redis.memory", { unit: "By" });
      this.redisKeys = meter.createGauge("outpost.redis.keys");
    }
    try {
      this.redis = new Redis(this.redisUrl, {
        lazyConnect: true,
        enableOfflineQueue: false,
        autoResendUnfulfilledCommands: false,
        maxRetriesPerRequest: 0,
        connectTimeout: TIMEOUT,
        commandTimeout: TIMEOUT,
        retryStrategy: reconnectDelay,
      }) as OutpostRedis;
      this.redis.defineCommand("outpostReadStates", { lua: READ_STATES_SCRIPT });
      this.redis.defineCommand("outpostPrepareSnapshot", {
        numberOfKeys: 2,
        lua: PREPARE_SNAPSHOT_SCRIPT,
      });
      this.redis.defineCommand("outpostPushTelemetry", {
        numberOfKeys: 2,
        lua: PUSH_TELEMETRY_SCRIPT,
      });
      this.redis.defineCommand("outpostWriteBucket", {
        numberOfKeys: 4,
        lua: WRITE_BUCKET_SCRIPT,
      });
      this.redis.defineCommand("outpostConfirm", { lua: CONFIRM_SCRIPT });
      this.redis.defineCommand("outpostApplySnapshot", {
        numberOfKeys: 1,
        lua: APPLY_SNAPSHOT_SCRIPT,
      });
      this.redis.defineCommand("outpostOutboxBacklog", {
        numberOfKeys: 2,
        lua: OUTBOX_BACKLOG_SCRIPT,
      });
      this.redis.defineCommand("outpostCommitPull", { numberOfKeys: 2, lua: COMMIT_PULL_SCRIPT });
      const redis = this.redis;
      this.redis.on("error", () => {});
      this.redis.on("close", () => {
        if (this.redis !== redis) return;
        this.event("outpost.redis.disconnect", new PolarError("Redis connection closed"));
      });
      // A connection the server closes at once, as under a burst of new ones, is tried again
      // until the timeout.
      await this.trace(
        "outpost.redis.connect",
        async () => {
          const deadline = Date.now() + TIMEOUT;
          for (let attempt = 1; ; attempt++) {
            try {
              await withTimeout(redis.connect());
              await redis.ping();
              return;
            } catch (error) {
              if (Date.now() >= deadline) throw error;
              redis.disconnect();
              await sleep(reconnectDelay(attempt));
            }
          }
        },
        { "outpost.redis.connection": "primary" },
      ).catch((error: unknown) => {
        throw redisUnavailable(error);
      });
      // Keys carry the organization: organizations can share a Redis.
      await this.configure();
      await this.createOutboxGroup().catch((error: unknown) => {
        throw redisUnavailable(error);
      });
      this._connectionId = randomUUID();
      await this.loadPull().catch((error: unknown) => {
        throw redisUnavailable(error);
      });
      // A long-running process pulls on time, reads or not.
      this.pullTimer = setInterval(() => void this.refresh().catch(() => {}), PULL_CHECK_INTERVAL);
      this.telemetryTimer = setInterval(() => void this.flushTelemetry(), REPORT_INTERVAL);
      // A long-running process delivers what it queued without a flush.
      this.drainTimer = setInterval(() => {
        if (this.undrained && this.delivers) void this.drain().catch(() => {});
      }, DRAIN_INTERVAL);
      this.requireRunning();
      return this;
    } catch (error) {
      await this.close();
      throw error;
    }
  }

  async close(): Promise<void> {
    clearInterval(this.telemetryTimer);
    clearInterval(this.pullTimer);
    clearInterval(this.drainTimer);
    await this.inFlight();
    if (this.delivers) {
      this.limitDrain();
      await this.drain().catch(() => {});
    }
    const redis = this.redis;
    if (redis) this.event("outpost.redis.disconnect");
    const tracerProvider = this.tracerProvider;
    const meterProvider = this.meterProvider;
    this.tracerProvider = undefined;
    this.tracer = undefined;
    this.meterProvider = undefined;
    this.ingestDuration = undefined;
    this.ingestBuckets = undefined;
    this.readDuration = undefined;
    this.redisMemory = undefined;
    this.redisKeys = undefined;
    // Their last exports land in the buffer, which the shared Redis takes before it closes.
    await Promise.all([tracerProvider?.shutdown(), meterProvider?.shutdown()]);
    await this.pushTelemetry();
    this._connectionId = undefined;
    this.redis = undefined;
    // disconnect() stops a connection that is not up without ever emitting "end".
    const closed =
      !redis || ["end", "reconnecting", "wait"].includes(redis.status)
        ? Promise.resolve()
        : once(redis, "end");
    redis?.disconnect();
    await Promise.allSettled([closed, this.applying, ...this.requesting.values()]);
    this.requesting.clear();
    this.reducers = [];
    this.matchers = [];
  }

  async [Symbol.asyncDispose](): Promise<void> {
    await this.close();
  }

  /**
   * Reject an event Outpost cannot reconcile with Polar.
   *
   * @throws MissingExternalIdError when the event has no external_id.
   */
  validate(event: EventInput): void {
    if (!event.external_id) throw new MissingExternalIdError();
  }

  async track(event: EventInput): Promise<void> {
    const redis = this.requireRunning();
    const started = performance.now();
    let outcome = "ok";
    try {
      this.validate(event);
      const parsed = parseEvent(event);
      const bucketStart = getBucketStart(parsed.timestamp);
      const matches = matchEvent(this.matchers, parsed);
      this.ingestBuckets?.add(matches.length);
      // Polar dates the event as Outpost bucketed it.
      const queued = JSON.stringify({
        ...event,
        timestamp: event.timestamp ?? new Date(Math.floor(parsed.timestamp / 1000)).toISOString(),
      });
      const pipeline = redis.pipeline() as OutpostPipeline;
      if (!matches.length) pipeline.xadd(this.outboxKey, "*", "event", queued);
      for (const [index, match] of matches.entries()) {
        const identity = `${parsed.customer}:${match.reducer}`;
        pipeline.outpostWriteBucket(
          `${this.prefix}:state:${identity}`,
          `${this.prefix}:pending:${identity}:${bucketStart}`,
          this.outboxKey,
          `${this.outboxKey}:flusher:0`,
          bucketStart,
          match.value ?? "",
          event.external_id!,
          index === 0 ? queued : "",
        );
      }
      const results = await pipeline.exec().catch((error: unknown) => {
        throw redisUnavailable(error);
      });
      if (results === null) throw new UnavailableRedisError();
      const failed = results.find(([error]) => error)?.[0];
      if (failed) throw redisUnavailable(failed);
      if (!matches.length || results[0][1] === 2) this.undrained = true;
    } catch (error) {
      outcome = "error";
      throw error;
    } finally {
      const attributes = { "outpost.outcome": outcome };
      this.ingestDuration?.record((performance.now() - started) / 1000, attributes);
    }
  }

  async meter(input: Customer & { meter_id: string }): Promise<CustomerMeter | null> {
    return this.measureRead("meter", async (read) => {
      const customer = customerKey(input);
      this.requireRunning();
      await this.refresh();
      const reducer = this.findReducer("usage", input.meter_id);
      if (!reducer) {
        read.outcome = "unknown_meter";
        throw new UnknownMeterError(`Outpost reduces no meter ${input.meter_id}`);
      }
      const creditReducer = this.findReducer("credit", input.meter_id);
      const reducers = creditReducer ? [reducer, creditReducer] : [reducer];
      const [state, creditState] = await this.read(customer, reducers, reducers.map(statisticsOf));
      if (state === "missing" || creditState === "missing") {
        read.outcome = "unknown_customer";
        return null;
      }
      // A balance without its credits would read as overdrawn.
      if (state.coldUntil === undefined || (creditReducer && creditState.coldUntil === undefined))
        throw new NotReadyError("Customer snapshot is not ready");
      read.outcome = "ready";
      const consumed = consumedUnits(state, reducer.aggregation.func);
      const credited = creditReducer
        ? consumedUnits(creditState, creditReducer.aggregation.func)
        : 0;
      return {
        ...input,
        consumed_units: consumed,
        credited_units: credited,
        balance: credited - consumed,
      };
    });
  }

  async actor(input: Customer): Promise<void> {
    return this.measureRead("actor", async (read) => {
      this.requireRunning();
      await this.refresh();
      // Readiness alone: no statistic of any state.
      const reads = await this.read(
        customerKey(input),
        this.reducers,
        this.reducers.map(() => ""),
      );
      read.outcome = !reads.every(isReady)
        ? "not_ready"
        : reads.includes("missing")
          ? "unknown_customer"
          : "ready";
    });
  }

  /**
   * Deliver the events this instance queued, and wait for the pull in flight: a serverless function
   * must not freeze in the middle of either. A newer flush releases this one, since it waits for the
   * same work.
   */
  async flush(): Promise<void> {
    this.releaseFlush?.();
    const released = new Promise<void>((resolve) => (this.releaseFlush = resolve));
    // Redis keeps what a drain fails to deliver: the next flush takes it. Without an event of its
    // own to deliver, a flush waits for the drain in flight, if any.
    if (this.delivers && (this.undrained || this.draining)) this.limitDrain();
    const draining = !this.delivers
      ? undefined
      : (this.undrained ? this.drain() : this.draining)?.catch(() => {});
    await Promise.race([Promise.all([this.inFlight(), draining]), released]);
  }

  readonly [OUTPOST] = true;

  // Hands this instance's telemetry to the shared Redis, where the next pull sends it to Polar.
  async flushTelemetry(): Promise<void> {
    await Promise.all([this.tracerProvider?.forceFlush(), this.meterProvider?.forceFlush()]);
    await this.pushTelemetry();
  }

  private requireRedis(): OutpostRedis {
    if (!this.redis) throw new PolarError("Call Outpost.start() before using Outpost");
    return this.redis;
  }

  // What the merchant calls fails while the instance is stopped. The pull goes on behind it,
  // at its backoff: one that succeeds ends the failure.
  private requireRunning(): OutpostRedis {
    if (this.failure) {
      void this.refresh().catch(() => {});
      throw this.failure;
    }
    return this.requireRedis();
  }

  // A pull that succeeded since the failure, on this instance or another, ends it.
  private pulled(at: number): void {
    this.pulledAt = at;
    if (this.failure && at > this.failedAt) this.failure = undefined;
  }

  private failUnlessTransient(error: unknown): void {
    if (
      error instanceof RefusedError ||
      !(error instanceof PolarError || isRedisConnectionError(error))
    )
      this.fail(error);
  }

  private fail(error: unknown): void {
    this.failure =
      error instanceof PolarOutpostError
        ? error
        : new PolarOutpostError("Outpost stopped", { cause: error });
    this.failedAt = Date.now();
  }

  private get pullKey(): string {
    return `${this.prefix}:pull`;
  }

  private get pullLockKey(): string {
    return `${this.prefix}:pull:lock`;
  }

  private get coldKey(): string {
    return `${this.prefix}:cold`;
  }

  private get coldLockKey(): string {
    return `${this.prefix}:cold:lock`;
  }

  // The events Polar has yet to receive, in the order Outpost tracked them.
  private get outboxKey(): string {
    return `${this.prefix}:outbox`;
  }

  private get outboxBackoffKey(): string {
    return `${this.outboxKey}:backoff`;
  }

  // The instances of a token share its configuration in Redis, where a new instance reads it
  // instead of asking Polar. The key hashes the token: Redis never sees it.
  private get configurationKey(): string {
    const [url, { headers }] = this.options.client.buildRequest("GET", "/v1/outpost/configuration");
    const sent = new Headers(headers);
    const identity = createHash("sha256")
      .update(JSON.stringify([url, sent.get("authorization"), sent.get("polar-organization")]))
      .digest("hex");
    return `${KEY_VERSION}:configuration:${identity}`;
  }

  private telemetryKey(kind: "spans" | "metrics"): string {
    return `${this.prefix}:telemetry:${kind}`;
  }

  private missingKey(identity: string): string {
    return `${this.prefix}:missing:${identity}`;
  }

  private fetchKey(identity: string): string {
    return `${this.prefix}:fetch:${identity}`;
  }

  private async request<T>(
    method: string,
    path: string,
    {
      query,
      body,
      timeout,
    }: { query?: Record<string, string | number>; body?: unknown; timeout?: number } = {},
  ): Promise<T> {
    const { client } = this.options;
    const response = await client.sendRequest(
      client.buildRequest(method, path, undefined, query, body),
      timeout === undefined ? undefined : { timeout: timeout / 1000 },
    );
    if (response.status === 401 || response.status === 403) throw new RefusedError();
    // Only a 2xx carries Polar's answer: a redirect is a failure that may pass.
    if (response.status >= 300 && response.status < 400)
      throw new PolarError(`Polar answered ${response.status}`);
    return client.parseResponse<T>(response, "json");
  }

  // From "redis", the organization's copy: every token of the organization reloads it once the
  // pull hash says the configuration changed. False when Redis holds none.
  private async configure(from: "redis" | "polar" | "either" = "either"): Promise<boolean> {
    const redis = this.requireRedis();
    const unavailable = (error: unknown) => {
      throw redisUnavailable(error);
    };
    const key = from === "redis" ? `${this.prefix}:configuration` : this.configurationKey;
    const stored = from === "polar" ? null : await redis.get(key).catch(unavailable);
    if (!stored && from === "redis") return false;
    const configuration: { organization_id: string; reducers: Reducer[] } = stored
      ? JSON.parse(stored)
      : await this.request("GET", "/v1/outpost/configuration");
    const { organization_id, reducers } = configuration;
    if (!stored) {
      const json = JSON.stringify(configuration);
      await redis.set(this.configurationKey, json).catch(unavailable);
      // Only the pull writes the organization's copy: a fetch at start may be older than it.
      if (from === "polar")
        await redis.set(`${KEY_VERSION}:${organization_id}:configuration`, json).catch(unavailable);
    }
    this.prefix = `${KEY_VERSION}:${organization_id}`;
    this.reducers = reducers;
    this.matchers = withMatchers(reducers);
    this.isConfigured = true;
    return true;
  }

  private findReducer(kind: Reducer["kind"], meterId: string): Reducer | undefined {
    return this.reducers.find(
      (reducer) => reducer.kind === kind && reducer.meter_ids?.includes(meterId),
    );
  }

  // Reads the customer's states from Redis. One Polar has no snapshot of yet is asked for once,
  // then read again once the fleet's fetch of it ends.
  private async read(customer: string, reducers: Reducer[], statistics: string[]): Promise<Read[]> {
    const deadline = Date.now() + (this.options.snapshotTimeout ?? SNAPSHOT_TIMEOUT);
    let reads = await this.load(customer, reducers, statistics);
    // Polar sends no snapshot without a connection.
    if (!this.connected) return reads;
    // A state confirmed before the last reset serves the read while Polar confirms it again.
    const fetched = Promise.all(
      reducers.map((reducer, index) =>
        isReady(reads[index]) && !this.isStale(reads[index])
          ? undefined
          : this.fetch(customer, reducer),
      ),
    );
    if (reads.every(isReady)) return reads;
    await waitAtMost(fetched, deadline - Date.now());
    const markers = reducers
      .filter((_, index) => !isReady(reads[index]))
      .map((reducer) => this.fetchKey(`${customer}:${reducer.id}`));
    for (;;) {
      const fetching = await this.requireRunning()
        .exists(...markers)
        .catch((error: unknown) => {
          throw redisUnavailable(error);
        });
      if (!fetching || Date.now() >= deadline) {
        reads = await this.load(customer, reducers, statistics);
        if (reads.every(isReady) || Date.now() >= deadline) return reads;
      }
      await sleep(Math.min(POLL_INTERVAL, deadline - Date.now()));
    }
  }

  // One command: each reducer's state, with only the statistics the read adds up, unless Polar
  // does not know the customer.
  private async load(customer: string, reducers: Reducer[], statistics: string[]): Promise<Read[]> {
    const keys = reducers.flatMap((reducer) => {
      const identity = `${customer}:${reducer.id}`;
      return [`${this.prefix}:state:${identity}`, this.missingKey(identity)];
    });
    const results = await this.requireRunning()
      .outpostReadStates(keys.length + 1, ...keys, this.pullKey, ...statistics)
      .catch((error: unknown) => {
        throw redisUnavailable(error);
      });
    const resets = results[reducers.length] as string | null;
    this.resets = resets === null ? null : Number(resets);
    return reducers.map((_, index) => {
      const [retryAt, state] = results[index] as [string | null, string[]];
      return Number(retryAt) > Date.now() ? "missing" : decodeState(state);
    });
  }

  private isStale(read: Read): boolean {
    return read !== "missing" && (read.confirmedAfterResets ?? null) !== this.resets;
  }

  private async measureRead<T>(
    operation: "meter" | "actor",
    run: (read: { outcome: string }) => Promise<T>,
  ): Promise<T> {
    const started = performance.now();
    const read = { outcome: "not_ready" };
    try {
      return await run(read);
    } catch (error) {
      if (error instanceof UnavailableRedisError) read.outcome = "redis_unavailable";
      else if (!(error instanceof NotReadyError || error instanceof UnknownMeterError))
        read.outcome = "error";
      throw error;
    } finally {
      this.readDuration?.record((performance.now() - started) / 1000, {
        "outpost.read.operation": operation,
        "outpost.read.outcome": read.outcome,
      });
    }
  }

  // Queues the identity once. The instance holding the cold lock asks Polar for the fleet's cold
  // customers together and applies their states.
  private fetch(customer: string, reducer: Reducer): Promise<void> {
    const identity = `${customer}:${reducer.id}`;
    let fetching = this.requesting.get(identity);
    if (!fetching) {
      fetching = new Promise<void>((done) => this.queued.push({ identity, done })).finally(() =>
        this.requesting.delete(identity),
      );
      this.requesting.set(identity, fetching);
      this.fetchTimer ??= setTimeout(() => void this.fetchQueued());
    }
    return fetching;
  }

  private async fetchQueued(): Promise<void> {
    this.fetchTimer = undefined;
    const queued = this.queued.splice(0);
    try {
      const redis = this.requireRedis();
      // A customer already queued or asked for stays out of the queue until Polar answers.
      const marking = redis.pipeline();
      for (const { identity } of queued)
        marking.set(this.fetchKey(identity), "1", "PX", TIMEOUT, "NX");
      const marked = await marking.exec().catch((error: unknown) => {
        throw redisUnavailable(error);
      });
      if (marked === null) throw new UnavailableRedisError();
      const failed = marked.find(([error]) => error)?.[0];
      if (failed) throw redisUnavailable(failed);
      const identities = queued
        .filter((_, index) => marked[index]?.[1] === "OK")
        .map(({ identity }) => identity);
      if (identities.length)
        await redis.sadd(this.coldKey, ...identities).catch((error: unknown) => {
          throw redisUnavailable(error);
        });
      await this.drainCold();
    } catch (error) {
      this.failUnlessTransient(error);
    } finally {
      for (const { done } of queued) done();
    }
  }

  // Once it lets go of the lock, the instance looks again: a customer queued while it held the
  // lock is not left behind.
  private async drainCold(): Promise<void> {
    const redis = this.requireRedis();
    for (;;) {
      const token = await takeLock(redis, this.coldLockKey, TIMEOUT);
      if (!token) return;
      try {
        await sleep(FETCH_BATCH_WINDOW);
        const renew = () => redis.eval(EXTEND_LOCK_SCRIPT, 1, this.coldLockKey, token, TIMEOUT);
        for (;;) {
          const batches: string[][] = [];
          while (batches.length < FETCH_CONCURRENCY) {
            const identities = await redis.spop(this.coldKey, SNAPSHOT_BATCH);
            if (!identities.length) break;
            batches.push(identities);
          }
          if (!batches.length) break;
          await renew();
          // A few batches at once: the cold start lasts as long as the slowest, not their sum.
          await eachAtMost(batches, FETCH_CONCURRENCY, (identities) =>
            this.fetchBatch(identities, renew),
          );
        }
      } finally {
        // Past its TTL, the lock may be another instance's.
        await releaseLock(redis, this.coldLockKey, token);
      }
      if (!(await redis.scard(this.coldKey))) return;
    }
  }

  private async fetchBatch(identities: string[], renew: () => Promise<unknown>): Promise<void> {
    try {
      // Its clock starts with the batch: a slow fetch does not push back the first extension.
      const renewed = throttled(renew, TIMEOUT);
      const resets = this.resets;
      const body = {
        identities: identities.map((identity) => {
          const separator = identity.lastIndexOf(":");
          return {
            ...customerArguments(identity.slice(0, separator)),
            reducer_id: identity.slice(separator + 1),
          };
        }),
      };
      const deadline = Date.now() + (this.options.snapshotTimeout ?? SNAPSHOT_TIMEOUT);
      // Its reads still wait: a failure that may pass is asked for again until they give up.
      const ask = async (delay: number): Promise<Snapshot[]> => {
        try {
          return await this.request<Snapshot[]>("POST", "/v1/outpost/meter-usage", { body });
        } catch (error) {
          const wait = retryAfterMs(error) ?? delay;
          if (
            error instanceof RefusedError ||
            (error instanceof PolarClientError && !(error instanceof PolarRateLimitError)) ||
            Date.now() + wait >= deadline
          )
            throw error;
          await sleep(wait);
          await renew();
          return ask(delay * 2);
        }
      };
      const snapshots = await ask(FETCH_RETRY_DELAY);
      // Side by side, as a pulled page: one instance applies the snapshots of the fleet.
      await this.serial(() =>
        eachAtMost(snapshots, PULL_CONCURRENCY, async (snapshot) => {
          if (await this.receiveSnapshot(snapshot, false, resets, renew)) await renewed();
        }),
      );
    } finally {
      await this.requireRedis()
        .del(...identities.map((identity) => this.fetchKey(identity)))
        .catch(() => {});
    }
  }

  private get delivers(): boolean {
    return Boolean(this.redis && !this.failure);
  }

  private async inFlight(): Promise<void> {
    await Promise.allSettled([this.pulling, this.applying, ...this.requesting.values()]);
    // The pull that just ended may have started one.
    await this.relaying;
  }

  // A flusher reads the outbox through the group, which tracks each batch until Polar has it.
  private async createOutboxGroup(): Promise<void> {
    await this.requireRedis()
      .xgroup("CREATE", this.outboxKey, OUTBOX_GROUP, "0", "MKSTREAM")
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
    this.draining = drain().finally(() => {
      this.draining = undefined;
      this.drainUntil = Infinity;
    });
    return this.draining;
  }

  // The fleet's other instances keep writing: a drain a flush or a close waits on would never end.
  private limitDrain(): void {
    this.drainUntil = Math.min(this.drainUntil, Date.now() + FLUSH_TENURE);
  }

  private async drainOutbox(): Promise<void> {
    const redis = this.requireRedis();
    try {
      // The backoff a round delivered past: the next round's read ends it.
      let ended: string[] = [];
      for (let round = 0; ; round += 1) {
        if (Date.now() >= this.drainUntil) {
          this.undrained = true;
          return;
        }
        const [length, delivering, retryAt] = await redis.outpostOutboxBacklog(
          this.outboxKey,
          this.outboxBackoffKey,
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
        const outcomes = await Promise.all(
          Array.from({ length: slots }, (_, slot) => this.flushSlot(slot)),
        );
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
    const lockKey = `${this.outboxKey}:flusher:${slot}`;
    const consumer = `flusher-${slot}`;
    const token = await takeLock(redis, lockKey, FLUSHER_LOCK_TTL);
    if (!token) return "busy";
    try {
      if (slot === 0)
        await redis.xautoclaim(
          this.outboxKey,
          OUTBOX_GROUP,
          consumer,
          OUTBOX_CLAIM_IDLE,
          "0-0",
          "COUNT",
          OUTBOX_BATCH,
          "JUSTID",
        );
      for (let from = "0"; ; ) {
        if (from === ">") {
          // Between two batches, the slot goes to the next instance that writes.
          if (Date.now() >= this.drainUntil) {
            this.undrained = true;
            return "drained";
          }
          const [length, delivering] = await redis.outpostOutboxBacklog(
            this.outboxKey,
            this.outboxBackoffKey,
            OUTBOX_GROUP,
          );
          if (length === delivering) return "drained";
          // The flusher still in flight takes a partial batch; if it let go meanwhile, the next
          // drain does.
          if (delivering && length - delivering < OUTBOX_BATCH) {
            this.undrained = true;
            return "drained";
          }
        }
        const read = (await redis.xreadgroup(
          "GROUP",
          OUTBOX_GROUP,
          consumer,
          "COUNT",
          OUTBOX_BATCH,
          "STREAMS",
          this.outboxKey,
          from,
        )) as [string, [string, string[] | null][]][] | null;
        const entries = read?.[0]?.[1] ?? [];
        if (entries.length) {
          const ids = entries.map(([id]) => id);
          if (!(await this.deliver(entries, { entries: ids, lockKey, token }))) {
            // Slot 0 starts every drain and sends what it holds first: the batch goes to it, and
            // does not wait for a drain large enough to start this slot again.
            if (slot)
              await redis
                .xclaim(this.outboxKey, OUTBOX_GROUP, "flusher-0", 0, ...ids, "JUSTID")
                .catch(() => {});
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
  private async deliver(
    entries: [string, string[] | null][],
    delivery: Delivery,
  ): Promise<boolean> {
    // An entry that is not JSON can never be sent: it leaves the outbox with the batch.
    let events = entries.flatMap(([, fields]) => {
      if (!fields) return [];
      try {
        const event: EventInput = JSON.parse(fields[1]);
        if (!holdsNoInfinity(event)) throw new TypeError("An infinity is not JSON");
        return [event];
      } catch {
        console.warn("Outpost dropped an outbox entry it cannot read");
        return [];
      }
    });
    const refused: EventInput[] = [];
    for (let resent = 0; events.length; resent += 1)
      try {
        await this.request("POST", "/v1/events/ingest", { body: { events }, timeout: TIMEOUT });
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
        if (error instanceof PolarClientError && !(error instanceof PolarRateLimitError)) {
          refused.push(...events);
          events = [];
          break;
        }
        // As long as Polar asks, or longer after each failure in a row.
        const wait = retryAfterMs(error);
        await this.backOff(this.outboxBackoffKey, {
          first: wait ?? OUTBOX_RETRY_DELAY,
          max: wait ?? MAX_OUTBOX_RETRY_DELAY,
        });
        return false;
      }
    const redis = this.requireRedis();
    // Polar will never count a refused event: it settles everywhere, hot bucket or cold.
    if (refused.length && events.length)
      await redis.outpostConfirm(
        ...confirmArguments(this.prefix, false, this.settlements(refused)),
      );
    await redis.outpostConfirm(
      ...confirmArguments(
        this.prefix,
        events.length > 0,
        this.settlements(events.length ? events : refused),
        delivery,
      ),
    );
    const report = async (name: string, callback: () => unknown): Promise<void> => {
      try {
        await callback();
      } catch (error) {
        console.warn(`Outpost ${name} failed: ${String(error)}`);
      }
    };
    if (refused.length)
      await report("onDropped", () => this.options.onDropped?.(refused, "permanent_error"));
    if (events.length) await report("onDelivered", () => this.options.onDelivered?.(events));
    return true;
  }

  // The events' ids, by the (customer, reducer, bucket) whose pending usage they settle. An event
  // another SDK queued in a form this one cannot parse settles nothing here: it stays pending
  // until the snapshot that counts it.
  private settlements(events: EventInput[]): Settlement[] {
    const groups = new Map<string, Settlement>();
    for (const event of events) {
      let parsed: ReturnType<typeof parseEvent>;
      try {
        this.validate(event);
        parsed = parseEvent(event);
      } catch {
        continue;
      }
      const bucketStart = getBucketStart(parsed.timestamp);
      for (const match of matchEvent(this.matchers, parsed)) {
        const identity = `${parsed.customer}:${match.reducer}`;
        const key = `${identity}:${bucketStart}`;
        let group = groups.get(key);
        if (!group) groups.set(key, (group = { identity, bucketStart, ids: [] }));
        group.ids.push(event.external_id!);
      }
    }
    return [...groups.values()];
  }

  // Starts the pull once due and no other instance pulled since. Waits for it, at most
  // SNAPSHOT_TIMEOUT, once Redis may be stale, unless the last pull failed.
  private async refresh(): Promise<void> {
    if (!this.pullDue()) return;
    await this.loadPull();
    if (!this.pullDue()) return;
    const stale = Date.now() - this.pulledAt >= 2 * this.pullInterval && !this.pullRetryAt;
    const pull = this.pull(stale);
    if (stale) await waitAtMost(pull, this.options.snapshotTimeout ?? SNAPSHOT_TIMEOUT);
  }

  private pullDue(): boolean {
    return Date.now() - this.pulledAt >= this.pullInterval && Date.now() >= this.pullRetryAt;
  }

  private async loadPull(): Promise<void> {
    const [pulledAt, nextPoll, retryAt, revision, resets] = await this.requireRedis()
      .hmget(this.pullKey, "pulled_at", "next_poll_in", "retry_at", "configuration", "reset")
      .catch((error: unknown) => {
        throw redisUnavailable(error);
      });
    // Another instance pulled a new configuration, maybe while this one started. Redis holds it;
    // once Redis lost it, the next read tries again.
    const configured = revision === null ? null : Number(revision);
    if (configured !== this.configurationRevision && (await this.configure("redis")))
      this.configurationRevision = configured;
    this.pulled(Number(pulledAt ?? 0));
    this.pullInterval = Number(nextPoll ?? PULL_INTERVAL);
    this.pullRetryAt = Number(retryAt ?? 0);
    this.resets = resets === null ? null : Number(resets);
  }

  // Another instance holds the pull: it has ended, pulled or failed, once its lock is gone.
  private async waitForPull(): Promise<void> {
    const redis = this.requireRedis();
    const deadline = Date.now() + TIMEOUT;
    while (Date.now() < deadline && (await redis.exists(this.pullLockKey)))
      await sleep(POLL_INTERVAL);
    await this.loadPull();
  }

  // `wait`: a read needs the pull's snapshots, and waits for another instance's pull to end.
  private pull(wait = true): Promise<void> {
    this.pulling ??= this.trace("outpost.pull", (span) => this.pullChanges(span, wait))
      .catch(async (error: unknown) => {
        // Polar or Redis failed: the next pull starts again from the same cursor, later.
        this.pullRetryAt = await this.backOff(this.pullKey);
        this.failUnlessTransient(error);
      })
      .finally(() => {
        this.pulling = undefined;
      });
    return this.pulling;
  }

  // One more failure on the key, for the whole fleet: when to try again, in milliseconds.
  private async backOff(
    key: string,
    {
      first = PULL_RETRY_DELAY,
      max = MAX_PULL_RETRY_DELAY,
      forget,
    }: { first?: number; max?: number; forget?: number } = {},
  ): Promise<number> {
    const now = Date.now();
    const retryAt = await this.redis
      ?.eval(BACKOFF_SCRIPT, 1, key, now, first, max, ...(forget === undefined ? [] : [forget]))
      .catch(() => undefined);
    return Number(retryAt ?? now + first);
  }

  // One instance of the fleet pulls at a time: the others learn the result through Redis.
  private async pullChanges(span: Span, wait: boolean): Promise<void> {
    const redis = this.requireRedis();
    // A pull another instance failed still holds the fleet back.
    const retryAt = Number(await redis.hget(this.pullKey, "retry_at"));
    if (retryAt > Date.now()) {
      this.pullRetryAt = retryAt;
      return;
    }
    const lock = await takeLock(redis, this.pullLockKey, PULL_LOCK_TTL);
    if (!lock) {
      span.setAttribute("outpost.pull.locked", true);
      // Unless a read needs it, this instance does not wait for the other one's pull: it checks
      // the pull again once a pull check has passed.
      if (wait) await this.waitForPull();
      else this.pulledAt = Date.now() - this.pullInterval + PULL_CHECK_INTERVAL;
      return;
    }
    // The page's snapshots and their confirms would outlast the lock otherwise.
    const extend = () => redis.eval(EXTEND_LOCK_SCRIPT, 1, this.pullLockKey, lock, PULL_LOCK_TTL);
    const renew = throttled(extend, PULL_LOCK_TTL);
    let pages = 0;
    let applied = 0;
    let released = false;
    try {
      for (;;) {
        const cursor = await redis.hget(this.pullKey, "cursor");
        const changes = await this.request<Changes>("GET", "/v1/outpost/changes", {
          query: cursor ? { cursor, limit: PULL_LIMIT } : { limit: PULL_LIMIT },
        }).catch((error: unknown) => {
          // Only a rate limit clears on its own: any other 4xx would repeat forever.
          if (error instanceof PolarClientError && !(error instanceof PolarRateLimitError))
            throw new RefusedError("Polar rejected the pull");
          throw error;
        });
        pages += 1;
        if (changes.configuration_changed) await this.configure("polar");
        // Past its lock, another instance may pull the same page: only one counts its reset
        // and its configuration change.
        if ((changes.reset || changes.configuration_changed) && !(await extend())) break;
        if (changes.reset) this.resets = await redis.hincrby(this.pullKey, "reset", 1);
        if (changes.configuration_changed)
          this.configurationRevision = await redis.hincrby(this.pullKey, "configuration", 1);
        const resets = this.resets;
        // Each customer's snapshots apply in order; customers apply side by side.
        const customers = new Map<string, Snapshot[]>();
        for (const snapshot of changes.changes) {
          const identity = `${snapshot.reducer_id}:${snapshot.customer_id}:${snapshot.external_customer_id}`;
          customers.set(identity, [...(customers.get(identity) ?? []), snapshot]);
        }
        await this.serial(() =>
          eachAtMost([...customers.values()], PULL_CONCURRENCY, async (snapshots) => {
            for (const snapshot of snapshots)
              // A confirm waits on Polar: the lock is extended before each one.
              if (await this.receiveSnapshot(snapshot, true, resets, extend)) {
                applied += 1;
                await renew();
              }
          }),
        );
        const pulledAt = Date.now();
        const nextPoll = Math.round(changes.next_poll_in * 1000);
        const committed = await redis.outpostCommitPull(
          this.pullKey,
          this.pullLockKey,
          lock,
          changes.cursor,
          pulledAt,
          nextPoll,
          changes.has_more ? "" : "1",
        );
        if (committed) {
          this.pulled(pulledAt);
          this.pullInterval = nextPoll;
          this.pullRetryAt = 0;
        }
        released = !committed || !changes.has_more;
        if (released) break;
      }
    } finally {
      span.setAttributes({ "outpost.pull.pages": pages, "outpost.pull.applied": applied });
      if (!released) await releaseLock(redis, this.pullLockKey, lock);
    }
    // The instance that pulled measures the shared Redis for the fleet.
    void this.reportRedisSize();
    // In the background: a read that waits for the pull does not wait for telemetry.
    this.relaying ??= this.relayTelemetry()
      .catch(() => {})
      .finally(() => {
        this.relaying = undefined;
      });
  }

  // Snapshots and what they trigger run one at a time, in order.
  private serial<T>(work: () => Promise<T>): Promise<T> {
    const result = this.applying.then(work);
    this.applying = result.catch(() => {});
    return result;
  }

  // Applies a snapshot of Polar's, unless it was pulled for a customer nobody here reads.
  // `resets` is the reset count when the snapshot was asked for: one asked for before a reset may
  // have missed changes the pull skipped.
  private async receiveSnapshot(
    snapshot: Snapshot,
    pulled: boolean,
    resets: number | null,
    renew?: () => Promise<unknown>,
  ): Promise<boolean> {
    const reducer = this.reducers.find((item) => item.id === snapshot.reducer_id);
    if (!reducer) return false;
    if (snapshot.customer_id !== null && snapshot.external_customer_id !== null) return false;
    const customer = customerKey({
      customer_id: snapshot.customer_id ?? undefined,
      external_customer_id: snapshot.external_customer_id ?? undefined,
    });
    const identity = `${customer}:${reducer.id}`;
    const key = `${this.prefix}:state:${identity}`;
    if (!snapshot.customer_exists) {
      // A pulled snapshot of a customer nobody here reads or writes has no state in Redis.
      if (pulled && !(await this.requireRedis().exists(key))) return false;
      // The fleet asks again later, longer after each miss, and forgets the misses past the
      // longest wait.
      await this.backOff(this.missingKey(identity), { forget: 2 * MAX_PULL_RETRY_DELAY });
      return false;
    }
    if (!Number.isSafeInteger(snapshot.version) || !Number.isSafeInteger(snapshot.cold_until))
      throw new TypeError("Snapshot timestamps must be safe integer microseconds");
    for (const value of [snapshot.count, snapshot.sum, snapshot.min, snapshot.max])
      if (value !== null && !Number.isFinite(value))
        throw new TypeError("Snapshot values must be finite");
    const sealed = await this.requireRedis()
      .outpostPrepareSnapshot(
        key,
        this.missingKey(identity),
        pulled ? "1" : "",
        snapshot.cold_until,
      )
      .catch((error: unknown) => {
        throw redisUnavailable(error);
      });
    if (sealed === null) return false;
    const [confirmation, answered] = await this.askConfirmation(
      identity,
      customer,
      snapshot,
      sealed.map(Number),
      renew,
    );
    await this.applySnapshot(
      identity,
      customer,
      confirmation?.snapshot ?? snapshot,
      // Polar did not say which pending events the snapshot counts: no reset count matches, so
      // the state asks again at its next read.
      confirmation && !answered ? UNCONFIRMED : resets,
      confirmation,
      answered,
    );
    return true;
  }

  // Asks Polar which of the pending events in the buckets the snapshot seals it counts. A
  // request that fails leaves its events pending until a later snapshot.
  private async askConfirmation(
    identity: string,
    customer: string,
    snapshot: Snapshot,
    // The buckets the snapshot seals that hold pending events.
    sealed: number[],
    renew?: () => Promise<unknown>,
  ): Promise<[Confirmation | undefined, boolean]> {
    const started = performance.now();
    if (!sealed.length) return [undefined, false];
    const confirmation: Confirmation = {
      snapshot,
      started,
      // Seconds since the oldest bucket asked ended.
      age: (Date.now() * 1_000 - Math.min(...sealed) - BUCKET_SIZE) / 1_000_000,
      messages: 0,
      asked: 0,
      confirmed: new Map(),
    };
    const redis = this.requireRedis();
    for (const bucketStart of sealed) {
      const ids = await redis.hkeys(`${this.prefix}:pending:${identity}:${bucketStart}`);
      for (let offset = 0; offset < ids.length; offset += CONFIRM_BATCH) {
        const batch = ids.slice(offset, offset + CONFIRM_BATCH);
        confirmation.messages += 1;
        confirmation.asked += batch.length;
        let answer: Confirmed;
        await renew?.();
        try {
          answer = await this.request<Confirmed>("POST", "/v1/outpost/confirm", {
            body: {
              reducer_id: snapshot.reducer_id,
              ...customerArguments(customer),
              bucket_start: bucketStart,
              ids: batch,
            },
            timeout: this.options.confirmTimeout ?? CONFIRM_TIMEOUT,
          });
        } catch (error) {
          if (error instanceof RefusedError) throw error;
          return [confirmation, false];
        }
        const confirmed = confirmation.confirmed.get(bucketStart) ?? [];
        confirmed.push(...answer.ids);
        confirmation.confirmed.set(bucketStart, confirmed);
        if (answer.snapshot.version >= confirmation.snapshot.version)
          confirmation.snapshot = answer.snapshot;
      }
    }
    return [confirmation, true];
  }

  // Settles the confirmed events and applies the snapshot in one transaction: a read sees the
  // bucket either fully local or as Polar's total plus what is still pending.
  private async applySnapshot(
    identity: string,
    customer: string,
    snapshot: Snapshot,
    resets: number | null,
    confirmation?: Confirmation,
    answered = false,
  ): Promise<void> {
    const confirmDuration = confirmation && (performance.now() - confirmation.started) / 1_000;
    const key = `${this.prefix}:state:${identity}`;
    const snapshotArguments: (string | number)[] = [
      snapshot.cold_until,
      snapshot.version,
      snapshot.count,
      snapshot.sum,
      snapshot.min ?? "",
      snapshot.max ?? "",
      resets ?? "",
    ];
    await this.trace(
      "outpost.snapshot.received",
      async (span) => {
        const redis = this.requireRedis();
        let replaced: string[];
        let before: Record<string, string> | undefined;
        const confirmed = [...(confirmation?.confirmed ?? [])].filter(([, ids]) => ids.length);
        if (confirmed.length) {
          const transaction = redis.multi() as OutpostPipeline;
          transaction.hgetall(key);
          transaction.outpostConfirm(
            ...confirmArguments(
              this.prefix,
              false,
              confirmed.map(([bucketStart, ids]) => ({ identity, bucketStart, ids })),
            ),
          );
          transaction.outpostApplySnapshot(key, ...snapshotArguments);
          const results = await transaction.exec();
          if (results === null) throw new UnavailableRedisError();
          const [error, result] = results[results.length - 1];
          if (error) throw error;
          replaced = result as string[];
          before = results[0][1] as Record<string, string>;
        } else {
          replaced = await redis.outpostApplySnapshot(key, ...snapshotArguments);
        }
        reportLocalValue(span, snapshot, replaced, before);
        if (confirmation) {
          span.setAttributes({
            "outpost.pending.asked": confirmation.asked,
            "outpost.pending.confirmed": confirmed.reduce((sum, [, ids]) => sum + ids.length, 0),
            "outpost.pending.answered": answered,
            "outpost.pending.messages": confirmation.messages,
            "outpost.pending.age": confirmation.age,
            "outpost.confirm.duration": confirmDuration,
          });
        }
      },
      {
        "outpost.customer": customer,
        "outpost.reducer_id": snapshot.reducer_id,
        "outpost.reducer_kind": this.reducers.find((item) => item.id === snapshot.reducer_id)?.kind,
        "outpost.snapshot_version": snapshot.version,
      },
    );
  }

  private async pushTelemetry(): Promise<void> {
    const spans = this.telemetryBuffer.spans.splice(0);
    const metrics = this.telemetryBuffer.metrics.splice(0);
    if (!this.redis || (!spans.length && !metrics.length)) return;
    // A fleet that stops pulling keeps its newest exports only.
    const pushed = await this.redis
      .outpostPushTelemetry(
        this.telemetryKey("spans"),
        this.telemetryKey("metrics"),
        TELEMETRY_CAP,
        spans.length,
        ...[...spans, ...metrics].map((body) => Buffer.from(body)),
      )
      .then(
        () => true,
        () => false,
      );
    if (pushed) return;
    // Redis lost the write: the exports wait for the next flush, the newest at most.
    this.telemetryBuffer.spans = [...spans, ...this.telemetryBuffer.spans].slice(-TELEMETRY_CAP);
    this.telemetryBuffer.metrics = [...metrics, ...this.telemetryBuffer.metrics].slice(
      -TELEMETRY_CAP,
    );
  }

  // The instance that pulled sends the fleet's telemetry: one relay of each kind per pull.
  private async relayTelemetry(): Promise<void> {
    if (!this.tracerProvider) return;
    const redis = this.requireRedis();
    const lock = `${this.prefix}:telemetry:lock`;
    const token = await takeLock(redis, lock, RELAY_LOCK_TTL);
    if (!token) return;
    try {
      for (const [kind, path] of [
        ["spans", "/v1/outpost/telemetry"],
        ["metrics", "/v1/outpost/telemetry/metrics"],
      ] as const) {
        const key = this.telemetryKey(kind);
        const batch = `${key}:relaying`;
        // A batch Polar failed goes first; otherwise the list moves aside, and exports written
        // meanwhile start a new one.
        if (!(await redis.exists(batch))) await redis.rename(key, batch).catch(() => {});
        const exports = await redis.lrangeBuffer(batch, 0, -1);
        if (!exports.length) continue;
        const status = await relay(this.options.client, path, Buffer.concat(exports));
        // One Polar refused would be refused again.
        if (status < 500 && status !== 429) await redis.del(batch);
      }
    } finally {
      await releaseLock(redis, lock, token);
    }
  }

  // Includes whatever else the merchant keeps in that Redis.
  private async reportRedisSize(): Promise<void> {
    const redis = this.redis;
    if (!this.redisMemory || !this.redisKeys || redis?.status !== "ready") return;
    try {
      const [memory, keys] = await Promise.all([redis.info("memory"), redis.dbsize()]);
      const used = /^used_memory:(\d+)/m.exec(memory);
      if (used) this.redisMemory?.record(Number(used[1]));
      this.redisKeys?.record(keys);
    } catch {
      // A Redis that refuses INFO or DBSIZE reports nothing.
    }
  }

  private startSpan(name: string, attributes: Attributes = {}): Span {
    if (!this.tracer) return trace.wrapSpanContext(INVALID_SPAN_CONTEXT);
    const span = this.tracer.startSpan(name, {
      root: true,
      attributes: this._connectionId
        ? { ...attributes, "outpost.connection_id": this._connectionId }
        : attributes,
    });
    if (isSampled(span.spanContext().traceId))
      span.setAttribute(SAMPLE_RATE_ATTRIBUTE, SPAN_SAMPLE_RATE);
    return span;
  }

  private async trace<T>(
    name: string,
    run: (span: Span) => Promise<T>,
    attributes?: Attributes,
  ): Promise<T> {
    const span = this.startSpan(name, attributes);
    try {
      return await run(span);
    } catch (error) {
      recordError(span, error);
      throw error;
    } finally {
      span.end();
    }
  }

  private event(name: string, error?: Error): void {
    const span = this.startSpan(name);
    if (error) recordError(span, error);
    span.end();
  }
}

export type OutpostFactoryOptions = Omit<OutpostOptions, "client" | "confirmTimeout"> & {
  /** Redis connection URL. Defaults to the REDIS_URL environment variable. */
  redisUrl?: string;
};

/**
 * Configure Outpost for polar.metering({ outpost: outpost({ redisUrl }) }).
 *
 * @throws MeteringError if neither redisUrl nor REDIS_URL is set.
 */
export const outpost = ({
  redisUrl = process.env.REDIS_URL,
  ...options
}: OutpostFactoryOptions = {}): MeteringOutpost => {
  if (!redisUrl) throw new MeteringError("Outpost requires redisUrl or REDIS_URL");
  return (client) => new Outpost(redisUrl, { ...options, client });
};
