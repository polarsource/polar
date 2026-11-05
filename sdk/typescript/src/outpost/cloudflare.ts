import type {
  DurableObjectNamespace,
  DurableObjectState,
  DurableObjectStub,
} from "@cloudflare/workers-types";

import { DurableObject } from "cloudflare:workers";

import type { EventInput } from "../metering/event";
import type { CustomerMeter } from "../metering/meter";

import { ClientBase, PolarError } from "../base";
import { UnknownMeterError } from "../metering/errors";
import { customerKey, parseEvent } from "./event";
import {
  getBucketStart,
  reduce,
  withMatchers,
  type Reducer,
  type ReducerMatchers,
} from "./reducer";
import {
  applySnapshot,
  confirm,
  consumedUnits,
  emptyState,
  sealedPending,
  writeBucket,
  type ReducerState,
  type Snapshot,
} from "./state";

const API_VERSION = "2026-10";
// Polar sets the interval with each pull; this one holds until the first.
const PULL_INTERVAL = 30_000;
const PULL_LIMIT = 500;
// Pending ids per confirm request: Polar refuses a bigger one.
const CONFIRM_BATCH = 1_000;
// A customer tells its organization it is awake this often, and is forgotten after the
// retention of Polar's changes without a sign of life.
const REGISTER_INTERVAL = 5 * 60_000;
const REGISTRATION_TTL = 60 * 60_000;
// A customer Polar does not know is not asked about again before this.
const MISSING_RETRY = 30_000;

export interface OutpostEnv {
  POLAR_ACCESS_TOKEN: string;
  /** Defaults to https://api.polar.sh. */
  POLAR_BASE_URL?: string;
  OUTPOST_CUSTOMER: DurableObjectNamespace<CustomerDO>;
  OUTPOST_SYNC: DurableObjectNamespace<SyncDO>;
}
type Customer = Parameters<typeof customerKey>[0];
interface Configuration {
  organization_id: string;
  reducers: Reducer[];
}
interface Changes {
  changes: Snapshot[];
  cursor: string;
  has_more: boolean;
  reset: boolean;
  configuration_changed: boolean;
  // Seconds.
  next_poll_in: number;
}
interface Confirmed {
  bucket_start: number;
  ids: string[];
  snapshot: Snapshot;
}
// When the organization last pulled Polar's changes, and how often it does.
interface Pulled {
  pulledAt: number;
  interval: number;
}

export class PolarOutpostError extends PolarError {}
export class MissingExternalIdError extends PolarOutpostError {
  constructor() {
    super("Outpost needs an external_id on every event");
  }
}

const polarClient = (env: OutpostEnv, organizationId: string): ClientBase =>
  new ClientBase({
    baseUrl: env.POLAR_BASE_URL ?? "https://api.polar.sh",
    accessToken: env.POLAR_ACCESS_TOKEN,
    version: API_VERSION,
    organizationId,
  });
const request = async <T>(
  client: ClientBase,
  method: string,
  path: string,
  { query, body }: { query?: Record<string, string | number>; body?: unknown } = {},
): Promise<T> =>
  client.parseResponse<T>(
    await client.sendRequest(client.buildRequest(method, path, undefined, query, body)),
    "json",
  );
const customerArguments = (customer: string): Customer => {
  const separator = customer.indexOf(":");
  return {
    [customer.startsWith("customer:") ? "customer_id" : "external_customer_id"]: customer.slice(
      separator + 1,
    ),
  };
};
const snapshotCustomer = (snapshot: Snapshot): string | undefined =>
  (snapshot.customer_id === null) === (snapshot.external_customer_id === null)
    ? undefined
    : customerKey({
        customer_id: snapshot.customer_id ?? undefined,
        external_customer_id: snapshot.external_customer_id ?? undefined,
      });

/** One per customer: its buckets, its reads and its writes. Named `organization:customer`. */
export class CustomerDO extends DurableObject<OutpostEnv> {
  private readonly organizationId: string;
  private readonly customer: string;
  private readonly polar: ClientBase;
  private reducers?: Reducer[];
  private matchers: ReducerMatchers = [];
  private readonly states = new Map<string, ReducerState>();
  private registeredAt = 0;
  // The last news of Polar's changes: a pull that applied here, or one the organization reported.
  private newsAt = 0;
  private interval = PULL_INTERVAL;
  private missingUntil = 0;

  constructor(ctx: DurableObjectState, env: OutpostEnv) {
    super(ctx, env);
    const name = ctx.id.name!;
    const separator = name.indexOf(":");
    this.organizationId = name.slice(0, separator);
    this.customer = name.slice(separator + 1);
    this.polar = polarClient(env, this.organizationId);
  }

  async track(event: EventInput): Promise<void> {
    await this.prepare();
    const parsed = parseEvent(event);
    for (const update of reduce(this.matchers, [parsed], getBucketStart(parsed.timestamp))) {
      const state = await this.state(update.reducer);
      if (writeBucket(state, update.bucketStart, update.statistics, event.external_id!))
        await this.save(update.reducer, state);
    }
  }

  async meter(meterId: string): Promise<CustomerMeter | null> {
    await this.prepare();
    const reducer = this.findReducer("usage", meterId);
    if (!reducer) throw new UnknownMeterError(`Outpost reduces no meter ${meterId}`);
    const creditReducer = this.findReducer("credit", meterId);
    await this.refresh();
    const state = await this.warm(reducer);
    const creditState = creditReducer && (await this.warm(creditReducer));
    if (!state || creditState === undefined) return null;
    const consumed = consumedUnits(state, reducer.aggregation.func);
    const credited = creditState ? consumedUnits(creditState, creditReducer.aggregation.func) : 0;
    return {
      ...customerArguments(this.customer),
      meter_id: meterId,
      consumed_units: consumed,
      credited_units: credited,
      balance: credited - consumed,
    };
  }

  async actor(): Promise<void> {
    await this.prepare();
    await this.refresh();
    for (const reducer of this.reducers!) await this.warm(reducer);
  }

  /** Polar's snapshots from a pull: each applies once, whatever the pull that carries it. */
  async apply(snapshots: Snapshot[], pulled: Pulled): Promise<void> {
    let sealed = false;
    for (const snapshot of snapshots) {
      if (!snapshot.customer_exists) continue;
      const state = await this.state(snapshot.reducer_id);
      if (!applySnapshot(state, snapshot)) continue;
      await this.save(snapshot.reducer_id, state);
      sealed ||= sealedPending(state).length > 0;
    }
    this.learn(pulled);
    if (sealed) await this.ctx.storage.setAlarm(Date.now());
  }

  /** Polar's changes were missed: every snapshot may be stale, the next read fetches it again. */
  async forgetSnapshots(): Promise<void> {
    for (const [key, stored] of await this.ctx.storage.list<ReducerState>({ prefix: "reducer:" })) {
      const reducerId = key.slice("reducer:".length);
      const state = this.states.get(reducerId) ?? stored;
      this.states.set(reducerId, state);
      state.coldUntil = undefined;
      state.snapshotVersion = undefined;
      await this.save(reducerId, state);
    }
  }

  // Asks Polar which pending events of the sealed buckets it counts. The rest stay pending
  // until a later snapshot counts them and arms the alarm again, an hour at most.
  async alarm(): Promise<void> {
    for (const [key, stored] of await this.ctx.storage.list<ReducerState>({ prefix: "reducer:" })) {
      const reducerId = key.slice("reducer:".length);
      const state = this.states.get(reducerId) ?? stored;
      this.states.set(reducerId, state);
      for (const [bucketStart, ids] of sealedPending(state)) {
        for (let offset = 0; offset < ids.length; offset += CONFIRM_BATCH) {
          const answer = await request<Confirmed>(this.polar, "POST", "/v1/outpost/confirm", {
            body: {
              ...customerArguments(this.customer),
              reducer_id: reducerId,
              bucket_start: bucketStart,
              ids: ids.slice(offset, offset + CONFIRM_BATCH),
            },
          });
          const confirmed = confirm(state, bucketStart, answer.ids);
          if (applySnapshot(state, answer.snapshot) || confirmed) await this.save(reducerId, state);
        }
      }
    }
  }

  private get sync(): DurableObjectStub<SyncDO> {
    const namespace = this.env.OUTPOST_SYNC;
    return namespace.get(namespace.idFromName(this.organizationId));
  }

  // Takes the organization's reducers, and tells it this customer is awake every few minutes.
  private async prepare(): Promise<void> {
    if (!this.reducers) {
      const { reducers } = await this.sync.configuration();
      this.reducers = reducers;
      this.matchers = withMatchers(reducers);
    }
    if (Date.now() - this.registeredAt < REGISTER_INTERVAL) return;
    this.registeredAt = Date.now();
    this.learn(await this.sync.register(this.customer));
  }

  private learn({ pulledAt, interval }: Pulled): void {
    this.newsAt = Math.max(this.newsAt, pulledAt);
    this.interval = interval;
  }

  // A read without news for two intervals asks the organization, which pulls first when its
  // own pull is that old. A customer that does not change gets no apply: this is how it knows.
  private async refresh(): Promise<void> {
    if (Date.now() - this.newsAt > 2 * this.interval) this.learn(await this.sync.lastPull());
  }

  private findReducer(kind: Reducer["kind"], meterId: string): Reducer | undefined {
    return this.reducers!.find(
      (reducer) => reducer.kind === kind && reducer.meter_ids?.includes(meterId),
    );
  }

  private async state(reducerId: string): Promise<ReducerState> {
    let state = this.states.get(reducerId);
    if (!state) {
      state = (await this.ctx.storage.get<ReducerState>(`reducer:${reducerId}`)) ?? emptyState();
      this.states.set(reducerId, state);
    }
    return state;
  }

  private async save(reducerId: string, state: ReducerState): Promise<void> {
    await this.ctx.storage.put(`reducer:${reducerId}`, state);
  }

  // Polar's snapshot of a reducer still cold, or undefined when Polar does not know the customer.
  private async warm(reducer: Reducer): Promise<ReducerState | undefined> {
    const state = await this.state(reducer.id);
    if (state.coldUntil !== undefined) return state;
    if (Date.now() < this.missingUntil) return undefined;
    const snapshots = await request<Snapshot[]>(this.polar, "POST", "/v1/outpost/meter-usage", {
      body: { ...customerArguments(this.customer), reducer_id: reducer.id },
    });
    const snapshot = snapshots.find((item) => snapshotCustomer(item) === this.customer);
    if (!snapshot?.customer_exists) {
      this.missingUntil = Date.now() + MISSING_RETRY;
      return undefined;
    }
    if (applySnapshot(state, snapshot)) await this.save(reducer.id, state);
    return state;
  }
}

/** One per organization: pulls Polar's changes and hands them to the customers awake. */
export class SyncDO extends DurableObject<OutpostEnv> {
  private readonly polar: ClientBase;
  private pulling?: Promise<void>;

  constructor(ctx: DurableObjectState, env: OutpostEnv) {
    super(ctx, env);
    this.polar = polarClient(env, ctx.id.name!);
  }

  async configuration(): Promise<Configuration> {
    return (await this.ctx.storage.get<Configuration>("configuration")) ?? this.configure();
  }

  /** A customer is awake: it gets the changes of the next pulls. */
  async register(customer: string): Promise<Pulled> {
    await this.ctx.storage.put(`registered:${customer}`, Date.now());
    // The cursor must predate the customer's first fetch: changes in between would be missed.
    if ((await this.ctx.storage.get("cursor")) === undefined) await this.pull();
    else if ((await this.ctx.storage.getAlarm()) === null)
      await this.ctx.storage.setAlarm(Date.now() + (await this.pulled()).interval);
    return this.pulled();
  }

  /** When Polar's changes were last pulled, after a pull when one is due. */
  async lastPull(): Promise<Pulled> {
    const { pulledAt, interval } = await this.pulled();
    // A failed pull leaves the reads to what they have; the alarm tries again.
    if (Date.now() - pulledAt >= interval) await this.pull().catch(() => {});
    return this.pulled();
  }

  async alarm(): Promise<void> {
    await this.pull();
  }

  private async configure(): Promise<Configuration> {
    const configuration = await request<Configuration>(
      this.polar,
      "GET",
      "/v1/outpost/configuration",
    );
    await this.ctx.storage.put("configuration", configuration);
    return configuration;
  }

  private async pulled(): Promise<Pulled> {
    return {
      pulledAt: (await this.ctx.storage.get<number>("pulled_at")) ?? 0,
      interval: (await this.ctx.storage.get<number>("interval")) ?? PULL_INTERVAL,
    };
  }

  // The customers awake, one key each so that registering is one small write, less those silent
  // for the retention of Polar's changes.
  private async registered(): Promise<Map<string, number>> {
    const registered = new Map<string, number>();
    const cutoff = Date.now() - REGISTRATION_TTL;
    const silent: string[] = [];
    for (const [key, seen] of await this.ctx.storage.list<number>({ prefix: "registered:" })) {
      if (seen < cutoff) silent.push(key);
      else registered.set(key.slice("registered:".length), seen);
    }
    for (let offset = 0; offset < silent.length; offset += 128)
      await this.ctx.storage.delete(silent.slice(offset, offset + 128));
    return registered;
  }

  private customer(key: string): DurableObjectStub<CustomerDO> {
    const namespace = this.env.OUTPOST_CUSTOMER;
    return namespace.get(namespace.idFromName(`${this.ctx.id.name}:${key}`));
  }

  private pull(): Promise<void> {
    this.pulling ??= this.pullChanges().finally(() => {
      this.pulling = undefined;
    });
    return this.pulling;
  }

  // The cursor moves once every customer took its changes: a pull that fails replays them.
  private async pullChanges(): Promise<void> {
    let registered: Map<string, number>;
    for (;;) {
      const cursor = await this.ctx.storage.get<string>("cursor");
      const changes = await request<Changes>(this.polar, "GET", "/v1/outpost/changes", {
        query: cursor === undefined ? { limit: PULL_LIMIT } : { cursor, limit: PULL_LIMIT },
      });
      registered = await this.registered();
      if (changes.configuration_changed) await this.configure();
      const pulled = { pulledAt: Date.now(), interval: changes.next_poll_in * 1000 };
      if (changes.reset)
        await Promise.all(
          [...registered.keys()].map((customer) => this.customer(customer).forgetSnapshots()),
        );
      const pages = new Map<string, Snapshot[]>();
      for (const snapshot of changes.changes) {
        const customer = snapshotCustomer(snapshot);
        if (customer === undefined || !registered.has(customer)) continue;
        let page = pages.get(customer);
        if (!page) pages.set(customer, (page = []));
        page.push(snapshot);
      }
      await Promise.all(
        [...pages].map(([customer, snapshots]) => this.customer(customer).apply(snapshots, pulled)),
      );
      await this.ctx.storage.put({
        cursor: changes.cursor,
        pulled_at: pulled.pulledAt,
        interval: pulled.interval,
      });
      if (!changes.has_more) break;
    }
    if (registered.size)
      await this.ctx.storage.setAlarm(Date.now() + (await this.pulled()).interval);
  }
}

export interface CloudflareOutpostOptions {
  /** The organization the access token belongs to: it names the Durable Objects. */
  organizationId: string;
}

/**
 * Outpost from a Worker: the customers' Durable Objects count the events and answer the reads.
 * Delivering the events to Polar is the buffered strategy's job, as with the Redis Outpost.
 */
export class CloudflareOutpost {
  constructor(
    private readonly env: OutpostEnv,
    private readonly options: CloudflareOutpostOptions,
  ) {}

  /**
   * Reject an event Outpost cannot reconcile with Polar.
   *
   * @throws MissingExternalIdError when the event has no external_id.
   */
  validate(event: EventInput): void {
    if (!event.external_id) throw new MissingExternalIdError();
  }

  /** Count the event in its customer's Durable Object. */
  async track(event: EventInput): Promise<void> {
    this.validate(event);
    await this.customer(customerKey(event)).track(event);
  }

  async meter(input: Customer & { meter_id: string }): Promise<CustomerMeter | null> {
    return this.customer(customerKey(input)).meter(input.meter_id);
  }

  async actor(input: Customer): Promise<void> {
    await this.customer(customerKey(input)).actor();
  }

  private customer(key: string): DurableObjectStub<CustomerDO> {
    const namespace = this.env.OUTPOST_CUSTOMER;
    return namespace.get(namespace.idFromName(`${this.options.organizationId}:${key}`));
  }
}
