import { Redis } from "ioredis";
import { randomUUID } from "node:crypto";
import { once } from "node:events";
import WebSocket from "ws";

import { ClientBase, PolarError } from "../base";
import { customerKey, parseEvent, type EventInput } from "./event";
import { parseReducers, reduce, getBucketStart, type Reducer } from "./reducer";
import { READ_STATE_SCRIPT, WRITE_BUCKET_SCRIPT, APPLY_SNAPSHOT_SCRIPT } from "./scripts";

const CACHE_SIZE = 1024;
const SYNC_INTERVAL = 30_000;
const TIMEOUT = 5_000;
type State = Record<string, string>;
type Customer = Pick<EventInput, "customer_id" | "external_customer_id">;
interface LocalState {
  state?: State;
  pending: Promise<unknown>;
}
interface OutpostRedis extends Redis {
  outpostReadState(key: string, ...args: (string | number)[]): Promise<unknown>;
  outpostWriteBucket(key: string, ...args: (string | number)[]): Promise<unknown>;
  outpostApplySnapshot(key: string, ...args: (string | number)[]): Promise<unknown>;
}

const generateEpoch = (): string => randomUUID().replaceAll("-", "");
const number = (value: string): number => {
  const parsed: unknown = JSON.parse(value);
  if (typeof parsed !== "number" || !Number.isFinite(parsed))
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
const locked = <T>(local: LocalState, action: () => Promise<T>): Promise<T> => {
  const result = local.pending.then(action);
  local.pending = result.catch(() => {});
  return result;
};
const decodeState = (value: unknown): State => {
  if (
    !Array.isArray(value) ||
    value.length % 2 !== 0 ||
    !value.every((item) => typeof item === "string")
  )
    throw new TypeError("Invalid Outpost state");
  const pairs: [string, string][] = [];
  for (let i = 0; i < value.length; i += 2) pairs.push([value[i], value[i + 1]]);
  const state = Object.fromEntries(pairs);
  if (typeof state.epoch !== "string" || !/^\d+$/.test(state.revision))
    throw new TypeError("Invalid Outpost state version");
  return state;
};
const object = (value: unknown): Record<string, unknown> => {
  if (value === null || typeof value !== "object" || Array.isArray(value))
    throw new TypeError("Invalid Outpost message");
  return value as Record<string, unknown>;
};

export interface OutpostOptions {
  client: Pick<ClientBase, "buildRequest">;
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
  private reducers: Reducer[] = [];
  private readonly cache = new Map<string, LocalState>();
  private readonly actors = new Set<string>();
  private configured = signal();
  private synced = signal();
  private isSynced = false;
  private generation = 0;
  private channel = "";
  private refreshTimer?: ReturnType<typeof setInterval>;
  private failure?: Error;
  private messages: Promise<unknown> = Promise.resolve();
  private synchronizing?: Promise<void>;

  constructor(
    readonly redisUrl: string,
    private readonly options: OutpostOptions,
  ) {}

  async start(): Promise<this> {
    if (this.redis) throw new PolarError("Outpost is already connected");
    this.failure = undefined;
    this.configured = signal();
    this.synced = signal();
    this.messages = Promise.resolve();
    try {
      this.redis = new Redis(this.redisUrl, {
        lazyConnect: true,
        enableOfflineQueue: false,
        autoResendUnfulfilledCommands: false,
        maxRetriesPerRequest: 0,
        commandTimeout: TIMEOUT,
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
        if (this.redis === redis) this.invalidate();
      });
      this.redis.on("ready", () => {
        if (this.subscriber?.status === "ready") void this.synchronize();
      });
      await withTimeout(this.redis.connect());
      await this.redis.ping();
      this.channel = `outpost:${this.redis.options.db}:updates`;
      this.subscriber = this.redis.duplicate({ lazyConnect: true, autoResubscribe: false });
      const subscriber = this.subscriber;
      this.subscriber.on("error", () => {});
      this.subscriber.on("close", () => {
        if (this.subscriber === subscriber) this.invalidate();
      });
      this.subscriber.on("ready", () => {
        void this.synchronize();
      });
      this.subscriber.on("message", (_channel, data) => {
        void this.receiveRedis(data).catch((error: unknown) => this.fail(error));
      });
      await withTimeout(this.subscriber.connect());
      await withTimeout(this.synced.promise);
      const [url, request] = this.options.client.buildRequest("GET", "/v1/outpost/");
      const endpoint = new URL(url);
      endpoint.protocol = endpoint.protocol === "https:" ? "wss:" : "ws:";
      this.websocket = new WebSocket(endpoint, {
        headers: Object.fromEntries(new Headers(request.headers)),
        handshakeTimeout: TIMEOUT,
      });
      this.websocket.on("error", (error) => this.fail(error));
      this.websocket.on("close", () => {
        if (this.websocket) this.fail(new PolarError("Outpost WebSocket disconnected"));
      });
      this.websocket.on("message", (data) => {
        this.messages = this.messages
          .then(() => this.receiveWebsocket(data.toString()))
          .catch((error: unknown) => this.fail(error));
      });
      await withTimeout(once(this.websocket, "open"));
      await this.send({ type: "configuration" });
      this.refreshTimer = setInterval(() => {
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
    const websocket = this.websocket;
    const connections = [this.subscriber, this.redis].filter(
      (redis): redis is Redis => redis !== undefined,
    );
    this.websocket = undefined;
    this.subscriber = undefined;
    this.redis = undefined;
    const closed = connections.map((redis) => {
      const ended = redis.status === "end" ? Promise.resolve() : once(redis, "end");
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
  }

  async [Symbol.asyncDispose](): Promise<void> {
    await this.close();
  }

  async ingest({ events }: { events: readonly EventInput[] }): Promise<IngestResult> {
    const redis = this.requireRedis();
    if (!events.length) return { inserted: 0, duplicates: 0 };
    const parsed = events.map(parseEvent);
    await this.waitConfigured();
    const updates = reduce(
      this.reducers,
      parsed,
      parsed.reduce((oldest, event) => Math.min(oldest, getBucketStart(event.timestamp)), Infinity),
    );
    for (const customer of new Set(parsed.map((event) => event.customer)))
      await this.warmCustomer(customer);
    for (const update of updates) {
      const epoch = generateEpoch();
      const state = await redis.outpostWriteBucket(
        `outpost:state:${update.customer}`,
        update.customer,
        this.channel,
        epoch,
        update.bucketStart,
        `bucket:${update.reducer}:${update.bucketStart}`,
        update.func,
        update.value,
      );
      await this.receiveState(update.customer, decodeState(state));
    }
    return { inserted: parsed.length, duplicates: 0 };
  }

  async customerMeter(input: Customer & { meter_id: string }): Promise<CustomerMeter | null> {
    const customer = customerKey(input);
    this.requireRedis();
    await this.waitConfigured();
    const reducer = this.reducers.find((item) => item.meter_ids?.includes(input.meter_id));
    if (!reducer) return null;
    const state = (await this.warmCustomer(customer)).state;
    if (!state || state.cold_until === undefined)
      throw new PolarError("Customer snapshot is not ready");
    const cutoff = number(state.cold_until);
    const values = Object.entries(state)
      .filter(
        ([field]) =>
          field.startsWith(`bucket:${reducer.id}:`) &&
          Number(field.slice(field.lastIndexOf(":") + 1)) >= cutoff,
      )
      .map(([, value]) => number(value));
    if (state[`cold:${reducer.id}`] !== undefined) values.push(number(state[`cold:${reducer.id}`]));
    const consumed =
      values.length === 0
        ? 0
        : reducer.aggregation.func === "min"
          ? values.reduce((a, b) => Math.min(a, b))
          : reducer.aggregation.func === "max"
            ? values.reduce((a, b) => Math.max(a, b))
            : values.reduce((a, b) => a + b, 0);
    const credited = number(state[`credited:${input.meter_id}`] ?? "0");
    return {
      ...input,
      consumed_units: consumed,
      credited_units: credited,
      balance: credited - consumed,
    };
  }

  async actor(input: Customer): Promise<void> {
    await this.warmCustomer(customerKey(input));
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

  private async warmCustomer(customer: string): Promise<LocalState> {
    this.requireRedis();
    while (!this.isSynced) {
      await withTimeout(this.synced.promise);
      this.requireRedis();
    }
    let local = this.cache.get(customer);
    if (!local) {
      local = { pending: Promise.resolve() };
      this.cache.set(customer, local);
      if (this.cache.size > CACHE_SIZE) {
        const evicted = this.cache.keys().next().value!;
        this.cache.delete(evicted);
        this.actors.delete(evicted);
      }
    }
    this.cache.delete(customer);
    this.cache.set(customer, local);
    if (local.state && this.actors.has(customer)) return local;
    const entry = local;
    await locked(entry, async () => {
      if (!entry.state) entry.state = await this.loadState(customer);
      if (!this.actors.has(customer)) {
        const separator = customer.indexOf(":");
        await this.send({
          type: "snapshot",
          payload: {
            [customer.startsWith("customer:") ? "customer_id" : "external_customer_id"]:
              customer.slice(separator + 1),
          },
        });
        this.actors.add(customer);
      }
    });
    return entry;
  }

  private async loadState(customer: string): Promise<State> {
    const epoch = generateEpoch();
    return decodeState(
      await this.requireRedis().outpostReadState(`outpost:state:${customer}`, epoch),
    );
  }

  private async receiveState(customer: string, state: State): Promise<void> {
    const local = this.cache.get(customer);
    if (!local) return;
    await locked(local, async () => {
      const current = local.state;
      if (!current) return;
      if (current.epoch !== state.epoch) state = await this.loadState(customer);
      else if (BigInt(current.revision) >= BigInt(state.revision)) return;
      local.state = state;
    });
  }

  private async receiveRedis(data: string): Promise<void> {
    const update = object(JSON.parse(data));
    if (typeof update.customer !== "string") throw new TypeError("Invalid Outpost customer");
    await this.receiveState(update.customer, decodeState(update.state));
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
      if (!this.isSynced) await this.subscriber.subscribe(this.channel);
      const entries = Array.from(this.cache);
      for (const [customer, local] of entries) {
        await locked(local, async () => {
          const state = await this.loadState(customer);
          if (generation === this.generation) local.state = state;
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

  private async receiveWebsocket(data: string): Promise<void> {
    const message = object(JSON.parse(data));
    if (message.type === "configuration") {
      this.reducers = parseReducers(message.payload);
      this.configured.resolve();
    } else if (message.type === "snapshot") {
      const snapshot = object(message.payload);
      const customer = customerKey(snapshot as Customer);
      if (typeof snapshot.cold_until !== "number" || !Number.isSafeInteger(snapshot.cold_until))
        throw new TypeError("Invalid snapshot boundary");
      const epoch = generateEpoch();
      const args: (string | number)[] = [customer, this.channel, epoch, snapshot.cold_until];
      for (const group of ["cold", "credited"]) {
        for (const [id, value] of Object.entries(object(snapshot[group]))) {
          if (typeof value !== "number" || !Number.isFinite(value))
            throw new TypeError("Snapshot values must be finite");
          args.push(`${group}:${id}`, value);
        }
      }
      // shortcut: equal-cutoff snapshots are unordered until Polar supplies snapshot versions.
      const state = await this.requireRedis().outpostApplySnapshot(
        `outpost:state:${customer}`,
        ...args,
      );
      await this.receiveState(customer, decodeState(state));
    }
  }
}
