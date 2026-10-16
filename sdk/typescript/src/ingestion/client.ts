import type {
  ContextualEventInput,
  EventCustomerInput,
  EventExternalCustomerInput,
  EventInput,
} from "./event";

import { PolarError, type ClientBase } from "../base";
import { BufferedIngestionStrategy, type IngestionClient } from "./buffered";

export class IngestionError extends PolarError {}
export class InvalidActorError extends IngestionError {}

export type ActorInput =
  | (Pick<EventCustomerInput, "customer_id" | "member_id"> & {
      external_customer_id?: never;
      external_member_id?: never;
    })
  | (Pick<EventExternalCustomerInput, "external_customer_id" | "external_member_id"> & {
      customer_id?: never;
      member_id?: never;
    });

export interface ActorIngestion {
  ingest(event: ContextualEventInput): Promise<void>;
}

export interface IngestionStrategy {
  start(): Promise<IngestionStrategy | void>;
  actor?(input: ActorInput): Promise<void>;
  ingest(event: EventInput): Promise<void>;
  close(): Promise<void>;
}

export interface IngestionOptions {
  outpostRedisUrl?: string;
}

export class Ingestion {
  readonly strategies: readonly IngestionStrategy[];
  private stack?: AsyncDisposableStack;
  private started = false;
  private closing?: Promise<void>;
  private activeOperations = 0;
  private onDrained?: () => void;

  constructor({ strategies }: { strategies: readonly IngestionStrategy[] }) {
    this.strategies = strategies;
  }

  async start(): Promise<this> {
    if (this.stack || this.closing) throw new PolarError("Ingestion has already started");
    this.stack = new AsyncDisposableStack();
    try {
      for (const strategy of this.strategies) {
        await strategy.start();
        this.stack.defer(() => strategy.close());
      }
      this.started = true;
      return this;
    } catch (error) {
      try {
        await this.close();
      } catch (cleanupError) {
        throw new AggregateError([error, cleanupError], "Ingestion startup and cleanup failed");
      }
      throw error;
    }
  }

  async ingest(event: EventInput): Promise<void> {
    if (!this.started) throw new PolarError("Ingestion is not running");
    validateActor(event);
    this.activeOperations++;
    try {
      for (const strategy of this.strategies) await strategy.ingest(event);
    } finally {
      if (--this.activeOperations === 0) this.onDrained?.();
    }
  }

  async actor(input: ActorInput): Promise<ActorIngestion> {
    if (!this.started) throw new IngestionError("Ingestion is not running");
    validateActor(input);
    const identity: ActorInput =
      input.customer_id != null
        ? { customer_id: input.customer_id, member_id: input.member_id }
        : {
            external_customer_id: input.external_customer_id,
            external_member_id: input.external_member_id,
          };
    this.activeOperations++;
    try {
      for (const strategy of this.strategies) await strategy.actor?.(identity);
      return { ingest: (event) => this.ingest({ ...event, ...identity }) };
    } finally {
      if (--this.activeOperations === 0) this.onDrained?.();
    }
  }

  async close(): Promise<void> {
    this.started = false;
    this.closing ??= this.drain();
    await this.closing;
  }

  async [Symbol.asyncDispose](): Promise<void> {
    await this.close();
  }

  private async drain(): Promise<void> {
    if (this.activeOperations > 0) {
      await new Promise<void>((resolve) => {
        this.onDrained = resolve;
      });
    }
    await this.stack?.disposeAsync();
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

export const createIngestion = (
  polar: IngestionClient,
  client: Pick<ClientBase, "buildRequest">,
  options: IngestionOptions = {},
): Ingestion => {
  const strategies: IngestionStrategy[] = [new BufferedIngestionStrategy(polar)];
  const redisUrl = options.outpostRedisUrl;
  if (redisUrl !== undefined) {
    let outpost: import("../outpost/client").Outpost | undefined;
    strategies.push({
      async start() {
        const { Outpost } = await import("../outpost/client");
        outpost = new Outpost(redisUrl, { client });
        await outpost.start();
      },
      async ingest(event) {
        await outpost!.ingest(event);
      },
      async actor(input) {
        await outpost!.actor(input);
      },
      async close() {
        await outpost?.close();
      },
    });
  }
  return new Ingestion({ strategies });
};
