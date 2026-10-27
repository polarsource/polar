import type { MeterProvider } from "@opentelemetry/sdk-metrics";
import type { TracerProvider } from "@opentelemetry/sdk-trace";

import {
  INVALID_SPAN_CONTEXT,
  SpanStatusCode,
  trace,
  type Attributes,
  type Counter,
  type Histogram,
  type Span,
  type Tracer,
} from "@opentelemetry/api";
import { Redis, type ChainableCommander } from "ioredis";
import { randomUUID } from "node:crypto";
import { once } from "node:events";
import WebSocket from "ws";

import type { EventInput } from "../metering/event";
import type { CustomerMeter } from "../metering/meter";

import { ClientBase, PolarError } from "../base";
import { customerKey, parseEvent } from "./event";
import {
  reduce,
  withMatchers,
  getBucketStart,
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
} from "./scripts";
import { createMeterProvider, createTracerProvider, isTelemetryEnabled } from "./telemetry";

const CACHE_SIZE = 1024;
const SYNC_INTERVAL = 30_000;
const TIMEOUT = 5_000;
const CONFIRM_TIMEOUT = 2_000;
// Pending ids per confirm request: Polar refuses a bigger one.
const CONFIRM_BATCH = 1_000;
const RECONNECT_DELAY = 500;
const MAX_RECONNECT_DELAY = 30_000;
const REDIS_RECONNECT_DELAY = 100;
const MAX_REDIS_RECONNECT_DELAY = 2_000;
// Every key and the channel carry the layout version. A new layout takes a new version, starts
// cold from Polar's snapshot and never reads the previous keys.
const KEY_VERSION = "outpost:v1";
const BUCKET_PREFIX = "bucket:";
const PENDING_PREFIX = "pending:";
const COLD_PREFIX = "cold:";
export interface State {
  epoch: string;
  revision: bigint;
  coldUntil?: number;
  cold: BucketStatistics;
  buckets: Map<number, BucketStatistics>;
  // The part of each bucket Polar has not confirmed yet.
  pending: Map<number, BucketStatistics>;
  credited: Record<string, number>;
}
type Customer = Parameters<typeof customerKey>[0];
interface Snapshot {
  customer_id: string | null;
  external_customer_id: string | null;
  customer_exists: boolean;
  meter_id: string;
  cold_until: number;
  version: number;
  count: number;
  sum: number;
  min: number | null;
  max: number | null;
  credited_units: number;
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
type Message =
  | { type: "connection"; payload: { id: string } }
  | { type: "configuration"; payload: { reducers: Reducer[] } }
  | { type: "meter_usage"; payload: Snapshot }
  | { type: "confirmed"; payload: Confirmed };
// A snapshot waiting for Polar to say which of the pending events it counts, one per meter.
interface Confirmation {
  key: string;
  snapshot: Snapshot;
  customer: string;
  identity: string;
  awaited: number;
  asked: number;
  confirmed: Map<number, string[]>;
  timer?: ReturnType<typeof setTimeout>;
}
type StateUpdate = { customer: string } & ({ state: string[] } | { bucket: string[] });
interface LocalState {
  state?: State;
  pending: Promise<unknown>;
  missing: boolean;
  changed: ReturnType<typeof signal>;
}
interface OutpostRedis extends Redis {
  outpostReadState(key: string, ...args: (string | number)[]): Promise<string[]>;
  outpostApplySnapshot(
    key: string,
    ...args: (string | number)[]
  ): Promise<[state: string[], replaced: string[]]>;
}
interface OutpostPipeline extends ChainableCommander {
  outpostWriteBucket(key: string, pendingKey: string, ...args: (string | number)[]): this;
  outpostConfirm(key: string, pendingKey: string, ...args: (string | number)[]): this;
  outpostApplySnapshot(key: string, ...args: (string | number)[]): this;
}

const generateEpoch = (): string => randomUUID().replaceAll("-", "");
const number = (value: string): number => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed))
    throw new TypeError("Stored aggregation values must be finite numbers");
  return parsed;
};
const signal = () => {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => {
    resolve = done;
  });
  return { promise, resolve };
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
const isReady = (local: LocalState, meterIds: readonly string[]): boolean =>
  local.missing ||
  (local.state?.coldUntil !== undefined &&
    meterIds.every((meterId) => meterId in local.state!.credited));
const notify = (local: LocalState): void => {
  local.changed.resolve();
  local.changed = signal();
};
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
const locked = <T>(local: LocalState, action: () => Promise<T>): Promise<T> => {
  const result = local.pending.then(action);
  local.pending = result.catch(() => {});
  return result;
};
export const decodeState = (value: string[]): State => {
  const state: State = {
    epoch: "",
    revision: 0n,
    coldUntil: undefined,
    cold: emptyStatistics(),
    buckets: new Map(),
    pending: new Map(),
    credited: {},
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
    else if (field.startsWith("credited:")) state.credited[field.slice(9)] = number(raw);
    else if (field === "epoch") state.epoch = raw;
    else if (field === "revision") state.revision = BigInt(raw);
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

const reportLocalValue = (span: Span, snapshot: Snapshot, replaced: string[]): void => {
  const fields: Record<string, string> = {};
  for (let index = 0; index < replaced.length; index += 2)
    fields[replaced[index]] = replaced[index + 1];
  if (fields.cold_until === undefined) return;
  const previous = Number(fields.cold_until);
  const local = emptyStatistics();
  const buckets = new Map<string, BucketStatistics>();
  const pending = new Map<string, BucketStatistics>();
  for (const [field, value] of Object.entries(fields)) {
    if (field.startsWith(COLD_PREFIX)) {
      local[field.slice(COLD_PREFIX.length) as keyof BucketStatistics] = number(value);
      continue;
    }
    const [kind, start, statistic] = field.split(":");
    if (kind !== "bucket" && kind !== "pending") continue;
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
  constructor(readonly status: number) {
    super(`Outpost connection refused with ${status}`);
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
  client: Pick<ClientBase, "buildRequest">;
  /** Send Outpost telemetry to Polar. Also disabled by `POLAR_OUTPOST_TELEMETRY=0`. */
  telemetry?: boolean;
  /** How long a read of a cold customer waits for its first snapshot, in milliseconds. */
  snapshotTimeout?: number;
  /**
   * How long a snapshot waits for Polar to confirm the pending events it counts, in
   * milliseconds. Defaults to 2000; the snapshot then applies with the events still pending.
   */
  confirmTimeout?: number;
}
export class Outpost {
  private redis?: OutpostRedis;
  private subscriber?: Redis;
  private websocket?: WebSocket;
  private _connectionId?: string;
  private tracerProvider?: TracerProvider;
  private tracer?: Tracer;
  private meterProvider?: MeterProvider;
  private ingestDuration?: Histogram;
  private ingestBuckets?: Counter;
  private readDuration?: Histogram;
  private reducers: Reducer[] = [];
  private matchers: ReducerMatchers = [];
  private readonly cache = new Map<string, LocalState>();
  private readonly actors = new Set<string>();
  private readonly confirmations = new Map<string, Confirmation>();
  private configured = signal();
  private isConfigured = false;
  private synced = signal();
  private isSynced = false;
  private generation = 0;
  private channel = "";
  private refreshTimer?: ReturnType<typeof setInterval>;
  private reconnectTimer?: ReturnType<typeof setTimeout>;
  private reconnectAttempts = 0;
  private failure?: Error;
  private messages: Promise<unknown> = Promise.resolve();
  private synchronizing?: Promise<void>;
  private syncReceived = 0;
  private syncApplied = 0;

  constructor(
    readonly redisUrl: string,
    private readonly options: OutpostOptions,
  ) {}

  get connectionId(): string | undefined {
    return this._connectionId;
  }

  get connected(): boolean {
    return (
      !this.failure &&
      this.redis?.status === "ready" &&
      this.subscriber?.status === "ready" &&
      this.isConfigured &&
      this.websocket?.readyState === WebSocket.OPEN
    );
  }

  async start(): Promise<this> {
    if (this.redis) throw new PolarError("Outpost is already connected");
    this.failure = undefined;
    this.reconnectAttempts = 0;
    this.isConfigured = false;
    this.configured = signal();
    this.synced = signal();
    this.messages = Promise.resolve();
    if (isTelemetryEnabled(this.options.telemetry ?? true)) {
      this.tracerProvider = createTracerProvider(this.options.client);
      this.tracer = this.tracerProvider.getTracer("polar.outpost");
      this.meterProvider = createMeterProvider(this.options.client);
      const meter = this.meterProvider.getMeter("polar.outpost");
      this.ingestDuration = meter.createHistogram("outpost.ingest.duration", { unit: "s" });
      this.ingestBuckets = meter.createCounter("outpost.ingest.buckets");
      this.readDuration = meter.createHistogram("outpost.read.duration", { unit: "s" });
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
      const redis = this.redis;
      this.redis.on("error", () => {});
      this.redis.on("close", () => {
        if (this.redis !== redis) return;
        this.event("outpost.redis.disconnect", new PolarError("Redis connection closed"));
        this.invalidate();
      });
      this.redis.on("ready", () => {
        if (this.subscriber?.status === "ready") void this.synchronize();
      });
      await this.trace(
        "outpost.redis.connect",
        async () => {
          await withTimeout(redis.connect());
          await redis.ping();
        },
        { "outpost.redis.connection": "primary" },
      ).catch((error: unknown) => {
        throw redisUnavailable(error);
      });
      this.channel = `${KEY_VERSION}:${this.redis.options.db}:updates`;
      this.subscriber = this.redis.duplicate({ lazyConnect: true, autoResubscribe: false });
      const subscriber = this.subscriber;
      this.subscriber.on("error", () => {});
      this.subscriber.on("close", () => {
        if (this.subscriber !== subscriber) return;
        this.event("outpost.redis.disconnect", new PolarError("Redis subscriber closed"));
        this.invalidate();
      });
      this.subscriber.on("ready", () => {
        void this.synchronize();
      });
      this.subscriber.on("message", (_channel, data) => {
        void this.receiveRedis(data).catch((error: unknown) => this.fail(error));
      });
      await this.trace("outpost.redis.connect", () => withTimeout(subscriber.connect()), {
        "outpost.redis.connection": "subscriber",
      }).catch((error: unknown) => {
        throw redisUnavailable(error);
      });
      await withTimeout(this.synced.promise);
      await this.connectWebsocket();
      this.refreshTimer = setInterval(() => {
        this.reportSync();
        if (this.synchronizing) return;
        void this.synchronize();
      }, SYNC_INTERVAL);
      this.requireRedis();
      return this;
    } catch (error) {
      await this.close();
      throw error;
    }
  }

  async close(): Promise<void> {
    clearInterval(this.refreshTimer);
    clearTimeout(this.reconnectTimer);
    for (const confirmation of this.confirmations.values()) clearTimeout(confirmation.timer);
    this.confirmations.clear();
    this.reportSync();
    const websocket = this.websocket;
    const connections = [this.subscriber, this.redis].filter(
      (redis): redis is Redis => redis !== undefined,
    );
    if (websocket) this.event("outpost.websocket.disconnect");
    if (connections.length) this.event("outpost.redis.disconnect");
    this.websocket = undefined;
    this._connectionId = undefined;
    this.subscriber = undefined;
    this.redis = undefined;
    const closed = connections.map((redis) => {
      // disconnect() stops a connection that is not up without ever emitting "end".
      const ended = ["end", "reconnecting", "wait"].includes(redis.status)
        ? Promise.resolve()
        : once(redis, "end");
      redis.disconnect();
      return ended;
    });
    if (websocket && websocket.readyState !== WebSocket.CLOSED) {
      closed.push(once(websocket, "close"));
      websocket.terminate();
    }
    this.invalidate();
    this.synced.resolve();
    this.configured.resolve();
    await Promise.allSettled([...closed, this.messages, this.synchronizing]);
    this.cache.clear();
    this.actors.clear();
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
      await this.waitConfigured();
      const updates = reduce(this.matchers, [parsed], getBucketStart(parsed.timestamp));
      this.ingestBuckets?.add(updates.length);
      await this.warmActor(parsed.customer);
      const pipeline = redis.pipeline() as OutpostPipeline;
      for (const update of updates) {
        const identity = `${update.customer}:${update.reducer}`;
        const statistics = update.statistics;
        pipeline.outpostWriteBucket(
          `${KEY_VERSION}:state:${identity}`,
          `${KEY_VERSION}:pending:${identity}:${update.bucketStart}`,
          identity,
          this.channel,
          generateEpoch(),
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
      let firstError: Error | undefined;
      for (const [index, [error, state]] of results.entries()) {
        if (error) {
          firstError ??= error;
          continue;
        }
        const update = updates[index];
        const identity = `${update.customer}:${update.reducer}`;
        await this.receiveState(identity, decodeState(state as string[]), true);
      }
      if (firstError) throw redisUnavailable(firstError);
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
    await this.waitConfigured();
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
        `${KEY_VERSION}:state:${identity}`,
        `${KEY_VERSION}:pending:${identity}:${bucketStart}`,
        identity,
        this.channel,
        generateEpoch(),
        bucketStart,
        hotOnly ? "1" : "",
        ...ids,
      );
    const results = await pipeline.exec().catch((error: unknown) => {
      throw redisUnavailable(error);
    });
    if (results === null) throw new UnavailableRedisError();
    let firstError: Error | undefined;
    for (const [index, [error, state]] of results.entries()) {
      if (error) {
        firstError ??= error;
        continue;
      }
      // Nothing settled: the state did not change.
      if (!(state as string[]).length) continue;
      await this.receiveState(confirmations[index].identity, decodeState(state as string[]));
    }
    if (firstError) throw redisUnavailable(firstError);
  }

  async meter(input: Customer & { meter_id: string }): Promise<CustomerMeter | null> {
    return this.measureRead("meter", async (read) => {
      const customer = customerKey(input);
      this.requireRedis();
      await this.waitConfigured();
      const reducer = this.reducers.find((item) => item.meter_ids?.includes(input.meter_id));
      if (!reducer) {
        read.outcome = "unknown_meter";
        return null;
      }
      const local = await this.warmCustomer(customer, reducer);
      await this.waitReady(reducer, local, [input.meter_id]);
      if (local.missing) {
        read.outcome = "unknown_customer";
        return null;
      }
      const state = local.state;
      if (!state || state.coldUntil === undefined)
        throw new NotReadyError("Customer snapshot is not ready");
      read.outcome =
        (reducer.aggregation.func as string) === "unique" || input.meter_id in state.credited
          ? "ready"
          : "not_ready";
      const consumed = consumedUnits(state, reducer.aggregation.func);
      const credited = state.credited[input.meter_id] ?? 0;
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
      const warmed = await this.warmActor(customerKey(input));
      await Promise.all(
        warmed.map(([reducer, local]) => this.waitReady(reducer, local, reducer.meter_ids ?? [])),
      );
      // Polar sends no snapshot for unique reducers.
      const snapshotted = warmed.filter(
        ([reducer]) => (reducer.aggregation.func as string) !== "unique",
      );
      read.outcome = !snapshotted.every(([reducer, local]) =>
        isReady(local, reducer.meter_ids ?? []),
      )
        ? "not_ready"
        : snapshotted.some(([, local]) => local.missing)
          ? "unknown_customer"
          : "ready";
    });
  }

  async flushTelemetry(): Promise<void> {
    this.reportSync();
    await Promise.all([this.tracerProvider?.forceFlush(), this.meterProvider?.forceFlush()]);
  }

  private async warmActor(customer: string): Promise<[Reducer, LocalState][]> {
    await this.waitConfigured();
    const warmed: [Reducer, LocalState][] = [];
    for (const reducer of this.reducers)
      warmed.push([reducer, await this.warmCustomer(customer, reducer)]);
    return warmed;
  }

  private async waitReady(
    reducer: Reducer,
    local: LocalState,
    meterIds: readonly string[],
  ): Promise<void> {
    // Polar sends no snapshot for unique reducers, nor without a connection.
    if ((reducer.aggregation.func as string) === "unique" || !this.connected) return;
    const deadline = Date.now() + (this.options.snapshotTimeout ?? 5_000);
    while (!isReady(local, meterIds) && Date.now() < deadline)
      await waitAtMost(local.changed.promise, deadline - Date.now());
  }

  private requireRedis(): OutpostRedis {
    if (this.failure) throw this.failure;
    if (!this.redis) throw new PolarError("Call Outpost.start() before using Outpost");
    return this.redis;
  }

  private async waitConfigured(): Promise<void> {
    if (!this.isConfigured) await withTimeout(this.configured.promise);
    this.requireRedis();
  }

  private async send(message: unknown): Promise<void> {
    this.requireRedis();
    if (!this.websocket || this.websocket.readyState !== WebSocket.OPEN)
      throw new PolarError("Outpost WebSocket is not connected");
    await new Promise<void>((resolve, reject) =>
      this.websocket!.send(JSON.stringify(message), (error) => (error ? reject(error) : resolve())),
    );
  }

  private async connectWebsocket(attempt = 0): Promise<void> {
    const [url, request] = this.options.client.buildRequest("GET", "/v1/outpost/");
    const endpoint = new URL(url);
    endpoint.protocol = endpoint.protocol === "https:" ? "wss:" : "ws:";
    const websocket = new WebSocket(endpoint, {
      headers: Object.fromEntries(new Headers(request.headers)),
      handshakeTimeout: TIMEOUT,
    });
    websocket.on("error", () => {});
    websocket.on("message", (data) => {
      this.queue(() => this.receiveWebsocket(data.toString()), websocket);
    });
    websocket.on("close", () => {
      if (this.websocket !== websocket) return;
      this.websocket = undefined;
      this._connectionId = undefined;
      this.event("outpost.websocket.disconnect", new PolarError("Outpost WebSocket disconnected"));
      this.reconnect();
    });
    try {
      await this.trace(
        "outpost.websocket.connect",
        () =>
          withTimeout(
            new Promise<void>((resolve, reject) => {
              websocket.once("open", resolve);
              websocket.once("error", reject);
              websocket.once("close", () => reject(new PolarError("Outpost WebSocket closed")));
              websocket.once("unexpected-response", (_request, response) => {
                reject(new RefusedError(response.statusCode ?? 0));
                websocket.terminate();
              });
            }),
          ),
        attempt ? { "outpost.reconnect.attempt": attempt } : undefined,
      );
    } catch (error) {
      websocket.terminate();
      throw error;
    }
    // Closed while this reconnection was opening.
    if (!this.redis) {
      websocket.terminate();
      return;
    }
    this.websocket = websocket;
    this.actors.clear();
    await this.send({ type: "configuration" });
  }

  private reconnect(): void {
    if (!this.redis || this.failure) return;
    const attempt = ++this.reconnectAttempts;
    const delay = Math.min(MAX_RECONNECT_DELAY, RECONNECT_DELAY * 2 ** (attempt - 1));
    this.reconnectTimer = setTimeout(
      () => {
        this.connectWebsocket(attempt).catch((error: unknown) => {
          if (error instanceof RefusedError && [401, 403].includes(error.status))
            this.fail(new PolarError("Polar refused the Outpost connection"));
          else this.reconnect();
        });
      },
      delay * (0.5 + Math.random() / 2),
    );
  }

  private async warmCustomer(customer: string, reducer: Reducer): Promise<LocalState> {
    const identity = `${customer}:${reducer.id}`;
    this.requireRedis();
    while (!this.isSynced) {
      // Fail fast during an outage; only wait for a resync in progress.
      if (this.redis?.status !== "ready" || this.subscriber?.status !== "ready")
        throw new UnavailableRedisError();
      await withTimeout(this.synced.promise).catch((error: unknown) => {
        throw redisUnavailable(error);
      });
      this.requireRedis();
    }
    let local = this.cache.get(identity);
    if (!local) {
      local = { pending: Promise.resolve(), missing: false, changed: signal() };
      this.cache.set(identity, local);
      if (this.cache.size > CACHE_SIZE) {
        const evicted = this.cache.keys().next().value!;
        this.cache.delete(evicted);
        this.actors.delete(evicted);
      }
    }
    this.cache.delete(identity);
    this.cache.set(identity, local);
    if (local.state && this.actors.has(identity)) return local;
    const entry = local;
    await locked(entry, async () => {
      if (!entry.state) {
        entry.state = await this.loadState(identity);
        notify(entry);
      }
      if (!this.actors.has(identity) && this.websocket?.readyState === WebSocket.OPEN) {
        try {
          for (const meter_id of reducer.meter_ids ?? [])
            await this.send({
              type: "meter_usage",
              payload: { ...customerArguments(customer), meter_id },
            });
        } catch (error) {
          if (this.failure) throw error;
          // Requested again once reconnected.
          return;
        }
        this.actors.add(identity);
      }
    });
    return entry;
  }

  private async loadState(customer: string): Promise<State> {
    const epoch = generateEpoch();
    return decodeState(
      await this.requireRedis()
        .outpostReadState(`${KEY_VERSION}:state:${customer}`, epoch)
        .catch((error: unknown) => {
          throw redisUnavailable(error);
        }),
    );
  }

  // A bucket update carries one bucket: it applies only on top of the revision just before it.
  private async receiveState(customer: string, state: State, bucket = false): Promise<boolean> {
    const local = this.cache.get(customer);
    if (!local) return false;
    return locked(local, async () => {
      const current = local.state;
      if (!current) return false;
      if (current.epoch === state.epoch && current.revision >= state.revision) return false;
      if (current.epoch !== state.epoch || (bucket && state.revision !== current.revision + 1n))
        state = await this.loadState(customer);
      else if (bucket) {
        for (const [start, statistics] of state.buckets) current.buckets.set(start, statistics);
        for (const [start, statistics] of state.pending) current.pending.set(start, statistics);
        current.revision = state.revision;
        state = current;
      }
      local.state = state;
      notify(local);
      return true;
    });
  }

  private async receiveRedis(data: string): Promise<void> {
    const update: StateUpdate = JSON.parse(data);
    const applied =
      "bucket" in update
        ? await this.receiveState(update.customer, decodeState(update.bucket), true)
        : await this.receiveState(update.customer, decodeState(update.state));
    this.syncReceived += 1;
    if (applied) this.syncApplied += 1;
  }

  private reportSync(): void {
    if (this.syncReceived === 0) return;
    this.startSpan("outpost.sync", {
      "outpost.sync.received": this.syncReceived,
      "outpost.sync.applied": this.syncApplied,
    }).end();
    this.syncReceived = 0;
    this.syncApplied = 0;
  }

  private synchronize(): Promise<void> {
    if (this.synchronizing) return this.synchronizing;
    const generation = this.generation;
    this.synchronizing = (async () => {
      if (
        this.failure ||
        !this.subscriber ||
        this.subscriber.status !== "ready" ||
        this.redis?.status !== "ready"
      )
        return;
      if (!this.isSynced)
        await this.trace("outpost.redis.subscribe", () => this.subscriber!.subscribe(this.channel));
      const entries = Array.from(this.cache);
      for (const [customer, local] of entries) {
        await locked(local, async () => {
          const state = await this.loadState(customer);
          if (generation === this.generation) {
            local.state = state;
            notify(local);
          }
        });
      }
      if (generation === this.generation) {
        this.isSynced = true;
        this.synced.resolve();
      }
    })()
      .catch((error: unknown) => {
        if (error instanceof TypeError) this.fail(error);
        else this.invalidate();
      })
      .finally(() => {
        this.synchronizing = undefined;
        if (
          !this.failure &&
          generation !== this.generation &&
          this.redis?.status === "ready" &&
          this.subscriber?.status === "ready"
        )
          void this.synchronize();
      });
    return this.synchronizing;
  }

  private invalidate(): void {
    this.generation++;
    this.isSynced = false;
    this.synced.resolve();
    this.synced = signal();
    for (const local of this.cache.values()) local.state = undefined;
  }

  // Messages and what they trigger run one at a time, in order.
  private queue(work: () => Promise<void>, websocket = this.websocket): void {
    this.messages = this.messages.then(work).catch((error: unknown) => {
      if (isRedisConnectionError(error)) websocket?.terminate();
      else this.fail(error);
    });
  }

  private fail(error: unknown): void {
    this.failure = error instanceof Error ? error : new PolarError(String(error));
    this.configured.resolve();
    this.synced.resolve();
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
      else if (!(error instanceof NotReadyError)) read.outcome = "error";
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

  private async receiveWebsocket(data: string): Promise<void> {
    const message: Message = JSON.parse(data);
    if (message.type === "connection") {
      this._connectionId = message.payload.id;
    } else if (message.type === "configuration") {
      this.reducers = message.payload.reducers;
      this.matchers = withMatchers(this.reducers);
      this.isConfigured = true;
      this.configured.resolve();
      // A session counts as stable once Polar configured it.
      this.reconnectAttempts = 0;
    } else if (message.type === "meter_usage") {
      const snapshot = message.payload;
      const reducer = this.reducers.find((item) => item.meter_ids?.includes(snapshot.meter_id));
      if (!reducer) return;
      if (snapshot.customer_id !== null && snapshot.external_customer_id !== null) return;
      const customer = customerKey({
        customer_id: snapshot.customer_id ?? undefined,
        external_customer_id: snapshot.external_customer_id ?? undefined,
      });
      const identity = `${customer}:${reducer.id}`;
      const local = this.cache.get(identity);
      if (local) {
        local.missing = !snapshot.customer_exists;
        notify(local);
      }
      if (!snapshot.customer_exists) {
        // Asked again on the next read, in case it was created since.
        this.actors.delete(identity);
        return;
      }
      if (!Number.isSafeInteger(snapshot.version) || !Number.isSafeInteger(snapshot.cold_until))
        throw new TypeError("Snapshot timestamps must be safe integer microseconds");
      for (const value of [
        snapshot.count,
        snapshot.sum,
        snapshot.min,
        snapshot.max,
        snapshot.credited_units,
      ])
        if (value !== null && !Number.isFinite(value))
          throw new TypeError("Snapshot values must be finite");
      if (!(await this.askConfirmation(identity, customer, snapshot)))
        await this.applySnapshot(identity, customer, snapshot);
    } else if (message.type === "confirmed") {
      const { reducer_id, customer_id, external_customer_id, bucket_start, ids, snapshot } =
        message.payload;
      const customer = customerKey({
        customer_id: customer_id ?? undefined,
        external_customer_id: external_customer_id ?? undefined,
      });
      const confirmation = this.confirmations.get(`${customer}:${reducer_id}:${snapshot.meter_id}`);
      if (!confirmation) return;
      const confirmed = confirmation.confirmed.get(bucket_start) ?? [];
      confirmed.push(...ids);
      confirmation.confirmed.set(bucket_start, confirmed);
      if (snapshot.version >= confirmation.snapshot.version) confirmation.snapshot = snapshot;
      if (--confirmation.awaited === 0) await this.settleConfirmation(confirmation, true);
    }
  }

  // Asks Polar which of the pending events in the buckets the snapshot seals it counts. The
  // snapshot Polar answers with applies once it did, or the asking one after confirmTimeout
  // with the events still pending.
  private async askConfirmation(
    identity: string,
    customer: string,
    snapshot: Snapshot,
  ): Promise<boolean> {
    const key = `${identity}:${snapshot.meter_id}`;
    const superseded = this.confirmations.get(key);
    if (superseded) {
      clearTimeout(superseded.timer);
      this.confirmations.delete(key);
    }
    const state = this.cache.get(identity)?.state ?? (await this.loadState(identity));
    const sealed = [...state.pending]
      .filter(([start, statistics]) => start < snapshot.cold_until && statistics.count > 0)
      .map(([start]) => start);
    if (!sealed.length) return false;
    const confirmation: Confirmation = {
      key,
      snapshot,
      customer,
      identity,
      awaited: 0,
      asked: 0,
      confirmed: new Map(),
    };
    const redis = this.requireRedis();
    const reducerId = identity.slice(customer.length + 1);
    for (const bucketStart of sealed) {
      const ids = await redis.hkeys(`${KEY_VERSION}:pending:${identity}:${bucketStart}`);
      for (let offset = 0; offset < ids.length; offset += CONFIRM_BATCH) {
        const batch = ids.slice(offset, offset + CONFIRM_BATCH);
        try {
          await this.send({
            type: "confirm",
            payload: {
              reducer_id: reducerId,
              ...customerArguments(customer),
              bucket_start: bucketStart,
              meter_id: snapshot.meter_id,
              ids: batch,
            },
          });
        } catch {
          // Not connected: the events stay pending until the next snapshot.
          return false;
        }
        confirmation.awaited += 1;
        confirmation.asked += batch.length;
      }
    }
    if (!confirmation.awaited) return false;
    confirmation.timer = setTimeout(
      () => this.queue(() => this.settleConfirmation(confirmation, false)),
      this.options.confirmTimeout ?? CONFIRM_TIMEOUT,
    );
    this.confirmations.set(key, confirmation);
    return true;
  }

  private async settleConfirmation(confirmation: Confirmation, answered: boolean): Promise<void> {
    if (this.confirmations.get(confirmation.key) !== confirmation) return;
    clearTimeout(confirmation.timer);
    this.confirmations.delete(confirmation.key);
    await this.applySnapshot(
      confirmation.identity,
      confirmation.customer,
      confirmation.snapshot,
      confirmation,
      answered,
    );
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
    const key = `${KEY_VERSION}:state:${identity}`;
    const snapshotArguments: (string | number)[] = [
      identity,
      this.channel,
      generateEpoch(),
      snapshot.cold_until,
      snapshot.version,
      snapshot.meter_id,
      snapshot.credited_units,
      snapshot.count,
      snapshot.sum,
      snapshot.min ?? "",
      snapshot.max ?? "",
    ];
    await this.trace(
      "outpost.snapshot.received",
      async (span) => {
        const redis = this.requireRedis();
        let applied: [state: string[], replaced: string[]];
        const confirmed = [...(confirmation?.confirmed ?? [])].filter(([, ids]) => ids.length);
        if (confirmed.length) {
          const transaction = redis.multi() as OutpostPipeline;
          for (const [bucketStart, ids] of confirmed)
            transaction.outpostConfirm(
              key,
              `${KEY_VERSION}:pending:${identity}:${bucketStart}`,
              identity,
              this.channel,
              generateEpoch(),
              bucketStart,
              "",
              ...ids,
            );
          transaction.outpostApplySnapshot(key, ...snapshotArguments);
          const results = await transaction.exec();
          if (results === null) throw new UnavailableRedisError();
          const [error, result] = results[results.length - 1];
          if (error) throw error;
          applied = result as [string[], string[]];
        } else {
          applied = await redis.outpostApplySnapshot(key, ...snapshotArguments);
        }
        const [state, replaced] = applied;
        reportLocalValue(span, snapshot, replaced);
        if (confirmation) {
          span.setAttributes({
            "outpost.pending.asked": confirmation.asked,
            "outpost.pending.confirmed": confirmed.reduce((sum, [, ids]) => sum + ids.length, 0),
            "outpost.pending.answered": answered,
          });
        }
        await this.receiveState(identity, decodeState(state));
      },
      {
        "outpost.customer": customer,
        "outpost.meter_id": snapshot.meter_id,
        "outpost.snapshot_version": snapshot.version,
      },
    );
  }
}
