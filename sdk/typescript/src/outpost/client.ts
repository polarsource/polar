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

import type { EventInput } from "../metering/event";
import type { CustomerMeter } from "../metering/meter";

import { ClientBase, PolarClientError, PolarError, PolarRateLimitError } from "../base";
import { UnknownMeterError } from "../metering/errors";
import { customerKey, parseEvent } from "./event";
import {
  reduce,
  withMatchers,
  getBucketStart,
  BUCKET_SIZE,
  type Aggregation,
  type Reducer,
  type ReducerMatchers,
  type BucketStatistics,
  emptyStatistics,
  addStatistics,
  quantity,
} from "./reducer";
import {
  READ_STATE_SCRIPT,
  WRITE_BUCKET_SCRIPT,
  CONFIRM_SCRIPT,
  APPLY_SNAPSHOT_SCRIPT,
  COMMIT_PULL_SCRIPT,
  BACKOFF_SCRIPT,
  RELEASE_LOCK_SCRIPT,
  EXTEND_LOCK_SCRIPT,
} from "./scripts";
import { createMeterProvider, createTracerProvider, isTelemetryEnabled } from "./telemetry";

// Shared by every Outpost SDK: sdk/generator/outpost/constants.toml says what each one means.
const KEY_VERSION = "outpost:v1";
const TIMEOUT = 5000;
const SNAPSHOT_TIMEOUT = 5000;
const CONFIRM_TIMEOUT = 2000;
const CONFIRM_BATCH = 1000;
const REPORT_INTERVAL = 30000;
const POLL_INTERVAL = 25;
const REDIS_RECONNECT_DELAY = 100;
const MAX_REDIS_RECONNECT_DELAY = 2000;
const PULL_INTERVAL = 30000;
const PULL_LOCK_TTL = 10000;
const PULL_RETRY_DELAY = 1000;
const MAX_PULL_RETRY_DELAY = 30000;
const PULL_LIMIT = 500;
const PULL_CONCURRENCY = 16;
const PULL_CHECK_INTERVAL = 1000;
const BUCKET_PREFIX = "bucket:";
const PENDING_PREFIX = "pending:";
const COLD_PREFIX = "cold:";
export interface State {
  coldUntil?: number;
  cold: BucketStatistics;
  buckets: Map<number, BucketStatistics>;
  // The part of each bucket Polar has not confirmed yet.
  pending: Map<number, BucketStatistics>;
}
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
  reducer_id: string;
  customer_id: string | null;
  external_customer_id: string | null;
  bucket_start: number;
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
// A customer's state for one reducer, or `missing` while Polar does not know the customer.
type Read = State | "missing";
interface OutpostRedis extends Redis {
  outpostReadState(key: string): Promise<string[]>;
  outpostApplySnapshot(key: string, ...args: (string | number)[]): Promise<string[]>;
  outpostCommitPull(key: string, lockKey: string, ...args: (string | number)[]): Promise<number>;
}
interface OutpostPipeline extends ChainableCommander {
  outpostReadState(key: string): this;
  outpostWriteBucket(key: string, pendingKey: string, ...args: (string | number)[]): this;
  outpostConfirm(key: string, pendingKey: string, ...args: (string | number)[]): this;
  outpostApplySnapshot(key: string, ...args: (string | number)[]): this;
}

const number = (value: string): number => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed))
    throw new TypeError("Stored aggregation values must be finite numbers");
  return parsed;
};
export class PolarOutpostError extends PolarError {}
// What Polar has not sent yet: the configuration or a snapshot. A read that raises it is not ready.
class NotReadyError extends PolarError {}
export class UnavailableRedisError extends PolarOutpostError {
  constructor(options?: ErrorOptions) {
    super("Redis is unavailable", options);
  }
}
export class MissingExternalIdError extends PolarOutpostError {
  constructor() {
    super("Outpost needs an external_id on every event");
  }
}
const redisUnavailable = (error: unknown): UnavailableRedisError =>
  new UnavailableRedisError({ cause: error });
const isRedisConnectionError = (error: unknown): boolean => {
  if (error instanceof UnavailableRedisError) return isRedisConnectionError(error.cause);
  return (
    error instanceof Error &&
    (error.name === "MaxRetriesPerRequestError" ||
      [
        "ECONNABORTED",
        "ECONNREFUSED",
        "ECONNRESET",
        "EHOSTUNREACH",
        "ENETUNREACH",
        "ENOTFOUND",
        "EPIPE",
        "ETIMEDOUT",
        "EAI_AGAIN",
      ].includes((error as NodeJS.ErrnoException).code ?? "") ||
      [
        "Command timed out",
        "Connection is closed.",
        "Stream isn't writeable and enableOfflineQueue options is false",
      ].includes(error.message))
  );
};
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
const isReady = (read: Read): boolean => read === "missing" || read.coldUntil !== undefined;
// Runs `work` on every item, at most `limit` at a time.
const eachAtMost = async <T>(
  items: T[],
  limit: number,
  work: (item: T) => Promise<void>,
): Promise<void> => {
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (next < items.length) await work(items[next++]);
    }),
  );
};
const sleep = (milliseconds: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, milliseconds));
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
export const decodeState = (value: string[]): State => {
  const state: State = {
    coldUntil: undefined,
    cold: emptyStatistics(),
    buckets: new Map(),
    pending: new Map(),
  };
  for (let i = 0; i < value.length; i += 2) {
    const field = value[i];
    const raw = value[i + 1];
    const buckets = field.startsWith(BUCKET_PREFIX)
      ? state.buckets
      : field.startsWith(PENDING_PREFIX)
        ? state.pending
        : undefined;
    if (buckets) {
      const prefix = buckets === state.buckets ? BUCKET_PREFIX : PENDING_PREFIX;
      const separator = field.lastIndexOf(":");
      const start = Number(field.slice(prefix.length, separator));
      let bucket = buckets.get(start);
      if (!bucket) buckets.set(start, (bucket = emptyStatistics()));
      bucket[field.slice(separator + 1) as keyof BucketStatistics] = number(raw);
    } else if (field.startsWith(COLD_PREFIX))
      state.cold[field.slice(COLD_PREFIX.length) as keyof BucketStatistics] = number(raw);
    else if (field === "cold_until") state.coldUntil = number(raw);
  }
  return state;
};
// Polar's totals cover the cold buckets: the local read adds what Polar has not confirmed in
// them, and every local event in the buckets Polar has not sealed yet.
export const consumedUnits = (state: State, func: Aggregation["func"]): number => {
  const combined = { ...state.cold };
  for (const [start, statistics] of state.pending)
    if (start < state.coldUntil!) addStatistics(combined, statistics);
  for (const [start, statistics] of state.buckets)
    if (start >= state.coldUntil!) addStatistics(combined, statistics);
  return quantity(combined, func);
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

class RefusedError extends PolarError {
  constructor(message = "Polar refused Outpost") {
    super(message);
  }
}

const recordError = (span: Span, error: unknown): void => {
  span.recordException(error instanceof Error ? error : String(error));
  span.setStatus({ code: SpanStatusCode.ERROR });
};

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
  private isConfigured = false;
  private prefix = KEY_VERSION;
  private refreshTimer?: ReturnType<typeof setInterval>;
  private pullTimer?: ReturnType<typeof setInterval>;
  private pulledAt = 0;
  private pullInterval = PULL_INTERVAL;
  private pulling?: Promise<void>;
  private pullRetryAt = 0;
  // The configuration's revision in the pull hash: undefined until the first read.
  private configurationRevision?: string | null;
  private failure?: Error;
  private messages: Promise<unknown> = Promise.resolve();

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
    this.configurationRevision = undefined;
    this.isConfigured = false;
    this.messages = Promise.resolve();
    if (isTelemetryEnabled(this.options.telemetry ?? true)) {
      this.tracerProvider = createTracerProvider(this.options.client);
      this.tracer = this.tracerProvider.getTracer("polar.outpost");
      this.meterProvider = createMeterProvider(this.options.client);
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
        retryStrategy: (attempt) => {
          const delay = Math.min(
            MAX_REDIS_RECONNECT_DELAY,
            REDIS_RECONNECT_DELAY * 2 ** (attempt - 1),
          );
          return delay * (0.5 + Math.random() / 2);
        },
      }) as OutpostRedis;
      this.redis.defineCommand("outpostReadState", { numberOfKeys: 1, lua: READ_STATE_SCRIPT });
      this.redis.defineCommand("outpostWriteBucket", {
        numberOfKeys: 2,
        lua: WRITE_BUCKET_SCRIPT,
      });
      this.redis.defineCommand("outpostConfirm", { numberOfKeys: 2, lua: CONFIRM_SCRIPT });
      this.redis.defineCommand("outpostApplySnapshot", {
        numberOfKeys: 1,
        lua: APPLY_SNAPSHOT_SCRIPT,
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
              await sleep(
                Math.min(MAX_REDIS_RECONNECT_DELAY, REDIS_RECONNECT_DELAY * 2 ** (attempt - 1)),
              );
            }
          }
        },
        { "outpost.redis.connection": "primary" },
      ).catch((error: unknown) => {
        throw redisUnavailable(error);
      });
      // Keys carry the organization: organizations can share a Redis.
      await this.configure();
      this._connectionId = randomUUID();
      await this.loadPull().catch((error: unknown) => {
        throw redisUnavailable(error);
      });
      // A long-running process pulls on time, reads or not.
      this.pullTimer = setInterval(() => {
        if (!this.failure) void this.refresh().catch(() => {});
      }, PULL_CHECK_INTERVAL);
      this.refreshTimer = setInterval(() => void this.reportRedisSize(), REPORT_INTERVAL);
      this.requireRedis();
      return this;
    } catch (error) {
      await this.close();
      throw error;
    }
  }

  async close(): Promise<void> {
    clearInterval(this.refreshTimer);
    clearInterval(this.pullTimer);
    await this.flush();
    const redis = this.redis;
    if (redis) this.event("outpost.redis.disconnect");
    this._connectionId = undefined;
    this.redis = undefined;
    // disconnect() stops a connection that is not up without ever emitting "end".
    const closed =
      !redis || ["end", "reconnecting", "wait"].includes(redis.status)
        ? Promise.resolve()
        : once(redis, "end");
    redis?.disconnect();
    await Promise.allSettled([closed, this.messages, ...this.requesting.values()]);
    this.requesting.clear();
    this.reducers = [];
    this.matchers = [];
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
    await Promise.all([tracerProvider?.shutdown(), meterProvider?.shutdown()]);
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
    const redis = this.requireRedis();
    const started = performance.now();
    let outcome = "ok";
    try {
      this.validate(event);
      const parsed = parseEvent(event);
      const updates = reduce(this.matchers, [parsed], getBucketStart(parsed.timestamp));
      this.ingestBuckets?.add(updates.length);
      const pipeline = redis.pipeline() as OutpostPipeline;
      for (const update of updates) {
        const identity = `${update.customer}:${update.reducer}`;
        const statistics = update.statistics;
        pipeline.outpostWriteBucket(
          `${this.prefix}:state:${identity}`,
          `${this.prefix}:pending:${identity}:${update.bucketStart}`,
          update.bucketStart,
          statistics.count,
          statistics.sum,
          statistics.min ?? "",
          statistics.max ?? "",
          event.external_id!,
        );
      }
      const results = await pipeline.exec().catch((error: unknown) => {
        throw redisUnavailable(error);
      });
      if (results === null) throw new UnavailableRedisError();
      const failed = results.find(([error]) => error)?.[0];
      if (failed) throw redisUnavailable(failed);
    } catch (error) {
      outcome = "error";
      throw error;
    } finally {
      const attributes = { "outpost.outcome": outcome };
      this.ingestDuration?.record((performance.now() - started) / 1000, attributes);
    }
  }

  /**
   * Settle events Polar has ingested: their usage stays in its bucket, no longer pending.
   *
   * @param events Tracked events, including their external_id.
   */
  async confirm(events: EventInput[]): Promise<void> {
    await this.settle(events, false);
  }

  /**
   * Settle events Polar has received, in the buckets no snapshot has sealed yet. Events of a
   * sealed bucket stay pending until a snapshot counts them.
   *
   * @param events Tracked events, including their external_id.
   */
  async acknowledge(events: EventInput[]): Promise<void> {
    await this.settle(events, true);
  }

  private async settle(events: EventInput[], hotOnly: boolean): Promise<void> {
    const redis = this.requireRedis();
    const groups = new Map<string, { identity: string; bucketStart: number; ids: string[] }>();
    for (const event of events) {
      this.validate(event);
      const parsed = parseEvent(event);
      for (const update of reduce(this.matchers, [parsed], getBucketStart(parsed.timestamp))) {
        const identity = `${update.customer}:${update.reducer}`;
        const key = `${identity}:${update.bucketStart}`;
        let group = groups.get(key);
        if (!group)
          groups.set(key, (group = { identity, bucketStart: update.bucketStart, ids: [] }));
        group.ids.push(event.external_id!);
      }
    }
    const confirmations = [...groups.values()];
    const pipeline = redis.pipeline() as OutpostPipeline;
    for (const { identity, bucketStart, ids } of confirmations)
      pipeline.outpostConfirm(
        `${this.prefix}:state:${identity}`,
        `${this.prefix}:pending:${identity}:${bucketStart}`,
        bucketStart,
        hotOnly ? "1" : "",
        ...ids,
      );
    const results = await pipeline.exec().catch((error: unknown) => {
      throw redisUnavailable(error);
    });
    if (results === null) throw new UnavailableRedisError();
    const failed = results.find(([error]) => error)?.[0];
    if (failed) throw redisUnavailable(failed);
  }

  async meter(input: Customer & { meter_id: string }): Promise<CustomerMeter | null> {
    return this.measureRead("meter", async (read) => {
      const customer = customerKey(input);
      this.requireRedis();
      await this.refresh();
      const reducer = this.findReducer("usage", input.meter_id);
      if (!reducer) {
        read.outcome = "unknown_meter";
        throw new UnknownMeterError(`Outpost reduces no meter ${input.meter_id}`);
      }
      const creditReducer = this.findReducer("credit", input.meter_id);
      const [state, creditState] = await this.read(
        customer,
        creditReducer ? [reducer, creditReducer] : [reducer],
      );
      if (state === "missing" || creditState === "missing") {
        read.outcome = "unknown_customer";
        return null;
      }
      if (state.coldUntil === undefined) throw new NotReadyError("Customer snapshot is not ready");
      const creditReady = creditState?.coldUntil !== undefined;
      read.outcome = !creditReducer || creditReady ? "ready" : "not_ready";
      const consumed = consumedUnits(state, reducer.aggregation.func);
      const credited = creditReady
        ? consumedUnits(creditState, creditReducer!.aggregation.func)
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
      this.requireRedis();
      await this.refresh();
      const reads = await this.read(customerKey(input), this.reducers);
      read.outcome = !reads.every(isReady)
        ? "not_ready"
        : reads.includes("missing")
          ? "unknown_customer"
          : "ready";
    });
  }

  /** Wait for the pull in flight: a serverless function must not freeze in the middle of it. */
  async flush(): Promise<void> {
    await Promise.allSettled([this.pulling, this.messages, ...this.requesting.values()]);
  }

  async flushTelemetry(): Promise<void> {
    await Promise.all([this.tracerProvider?.forceFlush(), this.meterProvider?.forceFlush()]);
  }

  // Reads the customer's states from Redis. One Polar has no snapshot of yet is asked for once,
  // then read again until it lands.
  private async read(customer: string, reducers: Reducer[]): Promise<Read[]> {
    const deadline = Date.now() + (this.options.snapshotTimeout ?? SNAPSHOT_TIMEOUT);
    let reads = await this.load(customer, reducers);
    // Polar sends no snapshot without a connection.
    if (reads.every(isReady) || !this.connected) return reads;
    const fetched = Promise.all(
      reducers.map((reducer, index) =>
        isReady(reads[index]) ? undefined : this.fetch(customer, reducer),
      ),
    );
    await waitAtMost(fetched, deadline - Date.now());
    for (;;) {
      reads = await this.load(customer, reducers);
      if (reads.every(isReady) || Date.now() >= deadline) return reads;
      await sleep(Math.min(POLL_INTERVAL, deadline - Date.now()));
    }
  }

  // One round trip: each reducer's state, unless Polar does not know the customer.
  private async load(customer: string, reducers: Reducer[]): Promise<Read[]> {
    const pipeline = this.requireRedis().pipeline() as OutpostPipeline;
    for (const reducer of reducers) {
      const identity = `${customer}:${reducer.id}`;
      pipeline.outpostReadState(`${this.prefix}:state:${identity}`);
      pipeline.hget(this.missingKey(identity), "retry_at");
    }
    const results = await pipeline.exec().catch((error: unknown) => {
      throw redisUnavailable(error);
    });
    if (results === null) throw new UnavailableRedisError();
    const failed = results.find(([error]) => error)?.[0];
    if (failed) throw redisUnavailable(failed);
    return reducers.map((_, index) =>
      Number(results[2 * index + 1][1]) > Date.now()
        ? "missing"
        : decodeState(results[2 * index][1] as string[]),
    );
  }

  private findReducer(kind: Reducer["kind"], meterId: string): Reducer | undefined {
    return this.reducers.find(
      (reducer) => reducer.kind === kind && reducer.meter_ids?.includes(meterId),
    );
  }

  private requireRedis(): OutpostRedis {
    if (this.failure) throw this.failure;
    if (!this.redis) throw new PolarError("Call Outpost.start() before using Outpost");
    return this.redis;
  }

  private get pullKey(): string {
    return `${this.prefix}:pull`;
  }

  private get pullLockKey(): string {
    return `${this.prefix}:pull:lock`;
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
    return client.parseResponse<T>(response, "json");
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

  private async configure(fromPolar = false): Promise<void> {
    const redis = this.requireRedis();
    const unavailable = (error: unknown) => {
      throw redisUnavailable(error);
    };
    const stored = fromPolar ? null : await redis.get(this.configurationKey).catch(unavailable);
    const configuration: { organization_id: string; reducers: Reducer[] } = stored
      ? JSON.parse(stored)
      : await this.request("GET", "/v1/outpost/configuration");
    if (!stored)
      await redis.set(this.configurationKey, JSON.stringify(configuration)).catch(unavailable);
    const { organization_id, reducers } = configuration;
    this.prefix = `${KEY_VERSION}:${organization_id}`;
    this.reducers = reducers;
    this.matchers = withMatchers(reducers);
    this.isConfigured = true;
  }

  // A read starts the pull once it is due, and waits for it once the Redis may be stale, no longer
  // than for a snapshot. While a failed pull backs off, it does neither; once the backoff ends, it
  // no longer waits. Another instance may have pulled since: the pull hash in Redis says.
  private async refresh(): Promise<void> {
    if (!this.pullDue()) return;
    await this.loadPull();
    if (!this.pullDue()) return;
    const age = Date.now() - this.pulledAt;
    const pull = this.pull();
    if (age >= 2 * this.pullInterval && !this.pullRetryAt)
      await waitAtMost(pull, this.options.snapshotTimeout ?? SNAPSHOT_TIMEOUT);
  }

  private pullDue(): boolean {
    return Date.now() - this.pulledAt >= this.pullInterval && Date.now() >= this.pullRetryAt;
  }

  private async loadPull(): Promise<void> {
    const [pulledAt, nextPoll, retryAt, revision] = await this.requireRedis()
      .hmget(this.pullKey, "pulled_at", "next_poll_in", "retry_at", "configuration")
      .catch((error: unknown) => {
        throw redisUnavailable(error);
      });
    // Another instance pulled a new configuration.
    if (this.configurationRevision !== undefined && revision !== this.configurationRevision)
      await this.configure();
    this.configurationRevision = revision;
    this.pulledAt = Number(pulledAt ?? 0);
    this.pullInterval = Number(nextPoll ?? PULL_INTERVAL);
    this.pullRetryAt = Number(retryAt ?? 0);
  }

  // Another instance holds the pull: it has ended, pulled or failed, once its lock is gone.
  private async waitForPull(): Promise<void> {
    const redis = this.requireRedis();
    const deadline = Date.now() + TIMEOUT;
    while (Date.now() < deadline && (await redis.exists(this.pullLockKey)))
      await sleep(POLL_INTERVAL);
    await this.loadPull();
  }

  private pull(): Promise<void> {
    this.pulling ??= this.trace("outpost.pull", (span) => this.pullChanges(span))
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
  private async backOff(key: string, ...forget: number[]): Promise<number> {
    const now = Date.now();
    const retryAt = await this.redis
      ?.eval(BACKOFF_SCRIPT, 1, key, now, PULL_RETRY_DELAY, MAX_PULL_RETRY_DELAY, ...forget)
      .catch(() => undefined);
    return Number(retryAt ?? now + PULL_RETRY_DELAY);
  }

  private missingKey(identity: string): string {
    return `${this.prefix}:missing:${identity}`;
  }

  // One instance of the fleet pulls at a time: the others learn the result through Redis.
  private async pullChanges(span: Span): Promise<void> {
    const redis = this.requireRedis();
    // A pull another instance failed still holds the fleet back.
    const retryAt = Number(await redis.hget(this.pullKey, "retry_at"));
    if (retryAt > Date.now()) {
      this.pullRetryAt = retryAt;
      return;
    }
    const lock = randomUUID();
    if (!(await redis.set(this.pullLockKey, lock, "PX", PULL_LOCK_TTL, "NX"))) {
      span.setAttribute("outpost.pull.locked", true);
      await this.waitForPull();
      return;
    }
    // The page's snapshots and their confirms would outlast the lock otherwise.
    const renew = () => redis.eval(EXTEND_LOCK_SCRIPT, 1, this.pullLockKey, lock, PULL_LOCK_TTL);
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
        if (changes.reset) await this.reset();
        if (changes.configuration_changed) {
          await this.configure(true);
          this.configurationRevision = String(
            await redis.hincrby(this.pullKey, "configuration", 1),
          );
        }
        // Each customer's snapshots apply in order; customers apply side by side.
        const customers = new Map<string, Snapshot[]>();
        for (const snapshot of changes.changes) {
          const identity = `${snapshot.reducer_id}:${snapshot.customer_id}:${snapshot.external_customer_id}`;
          customers.set(identity, [...(customers.get(identity) ?? []), snapshot]);
        }
        await this.serial(() =>
          eachAtMost([...customers.values()], PULL_CONCURRENCY, async (snapshots) => {
            for (const snapshot of snapshots)
              if (await this.receiveSnapshot(snapshot, true, renew)) {
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
          this.pulledAt = pulledAt;
          this.pullInterval = nextPoll;
          this.pullRetryAt = 0;
        }
        released = !committed || !changes.has_more;
        if (released) break;
      }
    } finally {
      span.setAttributes({ "outpost.pull.pages": pages, "outpost.pull.applied": applied });
      if (!released)
        await redis.eval(RELEASE_LOCK_SCRIPT, 1, this.pullLockKey, lock).catch(() => {});
    }
  }

  // Polar's changes went past its retention: no snapshot can be trusted any more.
  private async reset(): Promise<void> {
    const redis = this.requireRedis();
    for await (const keys of redis.scanStream({ match: `${this.prefix}:state:*`, count: 1000 })) {
      if (!(keys as string[]).length) continue;
      const pipeline = redis.pipeline();
      for (const key of keys as string[]) pipeline.hdel(key, "cold_until", "snapshot_version");
      await pipeline.exec();
    }
  }

  // Snapshots and what they trigger run one at a time, in order.
  private serial<T>(work: () => Promise<T>): Promise<T> {
    const result = this.messages.then(work);
    this.messages = result.catch(() => {});
    return result;
  }

  // One instance of the fleet asks Polar for a cold customer; the others read the state it applies.
  private fetch(customer: string, reducer: Reducer): Promise<void> {
    const identity = `${customer}:${reducer.id}`;
    let fetching = this.requesting.get(identity);
    if (!fetching) {
      fetching = this.fetchSnapshot(customer, reducer, identity).finally(() =>
        this.requesting.delete(identity),
      );
      this.requesting.set(identity, fetching);
    }
    return fetching;
  }

  private async fetchSnapshot(customer: string, reducer: Reducer, identity: string): Promise<void> {
    const lock = `${this.prefix}:fetch:${identity}`;
    const token = randomUUID();
    let locked = false;
    try {
      const redis = this.requireRedis();
      locked = (await redis.set(lock, token, "PX", TIMEOUT, "NX")) !== null;
      if (!locked) return;
      const snapshots = await this.request<Snapshot[]>("POST", "/v1/outpost/meter-usage", {
        body: { ...customerArguments(customer), reducer_id: reducer.id },
      });
      await this.serial(async () => {
        for (const snapshot of snapshots) await this.receiveSnapshot(snapshot, false);
      });
    } catch (error) {
      this.failUnlessTransient(error);
    } finally {
      // Past its TTL, the lock may be another instance's.
      if (locked) await this.redis?.eval(RELEASE_LOCK_SCRIPT, 1, lock, token).catch(() => {});
    }
  }

  private async loadState(identity: string): Promise<State> {
    return decodeState(
      await this.requireRedis()
        .outpostReadState(`${this.prefix}:state:${identity}`)
        .catch((error: unknown) => {
          throw redisUnavailable(error);
        }),
    );
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

  private failUnlessTransient(error: unknown): void {
    if (
      error instanceof RefusedError ||
      !(error instanceof PolarError || isRedisConnectionError(error))
    )
      this.fail(error);
  }

  private fail(error: unknown): void {
    this.failure = error instanceof Error ? error : new PolarError(String(error));
  }

  private startSpan(name: string, attributes: Attributes = {}): Span {
    if (!this.tracer) return trace.wrapSpanContext(INVALID_SPAN_CONTEXT);
    return this.tracer.startSpan(name, {
      root: true,
      attributes: this._connectionId
        ? { ...attributes, "outpost.connection_id": this._connectionId }
        : attributes,
    });
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

  private event(name: string, error?: Error): void {
    const span = this.startSpan(name);
    if (error) recordError(span, error);
    span.end();
  }

  // Applies a snapshot of Polar's, unless it was pulled for a customer nobody here reads.
  private async receiveSnapshot(
    snapshot: Snapshot,
    pulled: boolean,
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
    // A pulled snapshot of a customer nobody here reads or writes has no state in Redis.
    if (pulled && !(await this.requireRedis().exists(key))) return false;
    if (!snapshot.customer_exists) {
      // The fleet asks again later, longer after each miss, and forgets the misses past the
      // longest wait.
      await this.backOff(this.missingKey(identity), 2 * MAX_PULL_RETRY_DELAY);
      return false;
    }
    await this.redis?.del(this.missingKey(identity)).catch(() => {});
    if (!Number.isSafeInteger(snapshot.version) || !Number.isSafeInteger(snapshot.cold_until))
      throw new TypeError("Snapshot timestamps must be safe integer microseconds");
    for (const value of [snapshot.count, snapshot.sum, snapshot.min, snapshot.max])
      if (value !== null && !Number.isFinite(value))
        throw new TypeError("Snapshot values must be finite");
    const [confirmation, answered] = await this.askConfirmation(
      identity,
      customer,
      snapshot,
      renew,
    );
    await this.applySnapshot(
      identity,
      customer,
      confirmation?.snapshot ?? snapshot,
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
    renew?: () => Promise<unknown>,
  ): Promise<[Confirmation | undefined, boolean]> {
    const started = performance.now();
    const state = await this.loadState(identity);
    const sealed = [...state.pending]
      .filter(([start, statistics]) => start < snapshot.cold_until && statistics.count > 0)
      .map(([start]) => start);
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
          for (const [bucketStart, ids] of confirmed)
            transaction.outpostConfirm(
              key,
              `${this.prefix}:pending:${identity}:${bucketStart}`,
              bucketStart,
              "",
              ...ids,
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
}
