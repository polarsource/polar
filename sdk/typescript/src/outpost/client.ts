import type { TracerProvider } from "@opentelemetry/sdk-trace";

import {
  INVALID_SPAN_CONTEXT,
  SpanStatusCode,
  trace,
  type Attributes,
  type Span,
  type Tracer,
} from "@opentelemetry/api";
import { Redis } from "ioredis";
import { randomUUID } from "node:crypto";
import { once } from "node:events";
import WebSocket from "ws";

import { ClientBase, PolarError } from "../base";
import { customerKey, parseEvent, type EventInput } from "./event";
import {
  reduce,
  getBucketStart,
  type Reducer,
  type BucketStatistics,
  emptyStatistics,
  addStatistics,
  quantity,
} from "./reducer";
import { READ_STATE_SCRIPT, WRITE_BUCKET_SCRIPT, APPLY_SNAPSHOT_SCRIPT } from "./scripts";
import { createTracerProvider, isTelemetryEnabled } from "./telemetry";

const CACHE_SIZE = 1024;
const SYNC_INTERVAL = 30_000;
const TIMEOUT = 5_000;
const RECONNECT_DELAY = 500;
const MAX_RECONNECT_DELAY = 30_000;
const REDIS_RECONNECT_DELAY = 100;
const MAX_REDIS_RECONNECT_DELAY = 2_000;
interface State {
  epoch: string;
  revision: bigint;
  coldUntil?: number;
  cold: BucketStatistics;
  buckets: Map<number, BucketStatistics>;
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
type Message =
  | { type: "connection"; payload: { id: string } }
  | { type: "configuration"; payload: { reducers: Reducer[] } }
  | { type: "meter_usage"; payload: Snapshot };
interface StateUpdate {
  customer: string;
  state: string[];
}
interface LocalState {
  state?: State;
  pending: Promise<unknown>;
  missing: boolean;
  changed: ReturnType<typeof signal>;
}
interface OutpostRedis extends Redis {
  outpostReadState(key: string, ...args: (string | number)[]): Promise<string[]>;
  outpostWriteBucket(key: string, ...args: (string | number)[]): Promise<string[]>;
  outpostApplySnapshot(
    key: string,
    ...args: (string | number)[]
  ): Promise<[state: string[], replaced: string[]]>;
}

const generateEpoch = (): string => randomUUID().replaceAll("-", "");
const number = (value: string): number => {
  const parsed: number = JSON.parse(value);
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
export class UnavailableRedisError extends PolarOutpostError {
  constructor(options?: ErrorOptions) {
    super("Redis is unavailable", options);
  }
}
const redisUnavailable = (error: unknown): UnavailableRedisError =>
  new UnavailableRedisError({ cause: error });
const withTimeout = async <T>(promise: Promise<T>): Promise<T> => {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new PolarError("Outpost operation timed out")), TIMEOUT);
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
const decodeState = (value: string[]): State => {
  const fields: Record<string, string> = {};
  for (let i = 0; i < value.length; i += 2) fields[value[i]] = value[i + 1];
  const state: State = {
    epoch: fields.epoch,
    revision: BigInt(fields.revision),
    coldUntil: fields.cold_until === undefined ? undefined : number(fields.cold_until),
    cold: emptyStatistics(),
    buckets: new Map(),
    credited: {},
  };
  for (const [field, value] of Object.entries(fields)) {
    if (field.startsWith("cold:")) {
      const statistic = field.slice(5) as keyof BucketStatistics;
      state.cold[statistic] = number(value);
    } else if (field.startsWith("bucket:")) {
      const [, timestamp, statistic] = field.split(":");
      const start = Number(timestamp);
      const bucket = state.buckets.get(start) ?? emptyStatistics();
      bucket[statistic as keyof BucketStatistics] = number(value);
      state.buckets.set(start, bucket);
    } else if (field.startsWith("credited:")) state.credited[field.slice(9)] = number(value);
  }
  return state;
};

const isClose = (a: number, b: number): boolean =>
  Math.abs(a - b) <= 1e-9 * Math.max(Math.abs(a), Math.abs(b));

const reportLocalValue = (span: Span, snapshot: Snapshot, replaced: string[]): void => {
  const fields: Record<string, string> = {};
  for (let index = 0; index < replaced.length; index += 2)
    fields[replaced[index]] = replaced[index + 1];
  if (fields.cold_until === undefined) return;
  const local = emptyStatistics();
  const buckets = new Map<string, BucketStatistics>();
  for (const [field, value] of Object.entries(fields)) {
    if (field.startsWith("cold:")) {
      local[field.slice(5) as keyof BucketStatistics] = number(value);
    } else if (field.startsWith("bucket:")) {
      const [, start, statistic] = field.split(":");
      const bucket = buckets.get(start) ?? emptyStatistics();
      bucket[statistic as keyof BucketStatistics] = number(value);
      buckets.set(start, bucket);
    }
  }
  for (const bucket of buckets.values()) addStatistics(local, bucket);
  span.setAttributes({
    "outpost.local.cold_until": Number(fields.cold_until),
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
}
export interface IngestResult {
  inserted: number;
  duplicates: number;
}
export interface CustomerMeter extends Customer {
  meter_id: string;
  consumed_units: number;
  credited_units: number;
  balance: number;
}

export class Outpost {
  private redis?: OutpostRedis;
  private subscriber?: Redis;
  private websocket?: WebSocket;
  private _connectionId?: string;
  private tracerProvider?: TracerProvider;
  private tracer?: Tracer;
  private reducers: Reducer[] = [];
  private readonly cache = new Map<string, LocalState>();
  private readonly actors = new Set<string>();
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
      this.redis.defineCommand("outpostWriteBucket", { numberOfKeys: 1, lua: WRITE_BUCKET_SCRIPT });
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
      this.channel = `outpost:${this.redis.options.db}:updates`;
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
    const tracerProvider = this.tracerProvider;
    this.tracerProvider = undefined;
    this.tracer = undefined;
    await tracerProvider?.shutdown();
  }

  async [Symbol.asyncDispose](): Promise<void> {
    await this.close();
  }

  async ingest({ events }: { events: readonly EventInput[] }): Promise<IngestResult> {
    const redis = this.requireRedis();
    if (!events.length) return { inserted: 0, duplicates: 0 };
    return this.trace(
      "outpost.ingest",
      async (span) => {
        const parsed = events.map(parseEvent);
        await this.waitConfigured();
        const updates = reduce(
          this.reducers,
          parsed,
          parsed.reduce(
            (oldest, event) => Math.min(oldest, getBucketStart(event.timestamp)),
            Infinity,
          ),
        );
        for (const customer of new Set(parsed.map((event) => event.customer)))
          await this.warmActor(customer);
        for (const update of updates) {
          const identity = `${update.customer}:${update.reducer}`;
          const statistics = update.statistics;
          const state = await redis
            .outpostWriteBucket(
              `outpost:state:${identity}`,
              identity,
              this.channel,
              generateEpoch(),
              update.bucketStart,
              statistics.count,
              statistics.sum,
              statistics.min ?? "",
              statistics.max ?? "",
            )
            .catch((error: unknown) => {
              throw redisUnavailable(error);
            });
          await this.receiveState(identity, decodeState(state));
        }
        span.setAttribute("outpost.buckets", updates.length);
        return { inserted: parsed.length, duplicates: 0 };
      },
      { "outpost.events": events.length },
    );
  }

  async customerMeter(input: Customer & { meter_id: string }): Promise<CustomerMeter | null> {
    return this.trace("outpost.customer_meter", async () => {
      const customer = customerKey(input);
      this.requireRedis();
      await this.waitConfigured();
      const reducer = this.reducers.find((item) => item.meter_ids?.includes(input.meter_id));
      if (!reducer) return null;
      const local = await this.warmCustomer(customer, reducer);
      await this.waitReady(reducer, local, [input.meter_id]);
      if (local.missing) return null;
      const state = local.state;
      if (!state || state.coldUntil === undefined)
        throw new PolarError("Customer snapshot is not ready");
      const combined = { ...state.cold };
      for (const [start, statistics] of state.buckets)
        if (start >= state.coldUntil) addStatistics(combined, statistics);
      const consumed = quantity(combined, reducer.aggregation.func);
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
    return this.trace("outpost.actor", async () => {
      const warmed = await this.warmActor(customerKey(input));
      await Promise.all(
        warmed.map(([reducer, local]) => this.waitReady(reducer, local, reducer.meter_ids ?? [])),
      );
    });
  }

  async flushTelemetry(): Promise<void> {
    this.reportSync();
    await this.tracerProvider?.forceFlush();
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
    await withTimeout(this.configured.promise);
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
      this.messages = this.messages
        .then(() => this.receiveWebsocket(data.toString()))
        .catch((error: unknown) => this.fail(error));
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
        .outpostReadState(`outpost:state:${customer}`, epoch)
        .catch((error: unknown) => {
          throw redisUnavailable(error);
        }),
    );
  }

  private async receiveState(customer: string, state: State): Promise<boolean> {
    const local = this.cache.get(customer);
    if (!local) return false;
    return locked(local, async () => {
      const current = local.state;
      if (!current) return false;
      if (current.epoch !== state.epoch) state = await this.loadState(customer);
      else if (current.revision >= state.revision) return false;
      local.state = state;
      notify(local);
      return true;
    });
  }

  private async receiveRedis(data: string): Promise<void> {
    const update: StateUpdate = JSON.parse(data);
    const applied = await this.receiveState(update.customer, decodeState(update.state));
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
      await this.trace(
        "outpost.snapshot.received",
        async (span) => {
          const [state, replaced] = await this.requireRedis().outpostApplySnapshot(
            `outpost:state:${identity}`,
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
          );
          reportLocalValue(span, snapshot, replaced);
          await this.receiveState(identity, decodeState(state));
        },
        { "outpost.meter_id": snapshot.meter_id, "outpost.snapshot_version": snapshot.version },
      );
    }
  }
}
