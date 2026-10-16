import type { EventInput } from "./event";

import { PolarError, type ClientBase } from "../base";
import { BufferedIngestionStrategy, type IngestionClient } from "./buffered";

export interface IngestionStrategy {
  start(): Promise<IngestionStrategy | void>;
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
  private activeIngests = 0;
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
    this.activeIngests++;
    try {
      for (const strategy of this.strategies) await strategy.ingest(event);
    } finally {
      if (--this.activeIngests === 0) this.onDrained?.();
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
    if (this.activeIngests > 0) {
      await new Promise<void>((resolve) => {
        this.onDrained = resolve;
      });
    }
    await this.stack?.disposeAsync();
  }
}

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
      async close() {
        await outpost?.close();
      },
    });
  }
  return new Ingestion({ strategies });
};
