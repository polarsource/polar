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
      await this.close();
      throw error;
    }
  }

  async ingest(event: EventInput): Promise<void> {
    if (!this.started) throw new PolarError("Ingestion is not running");
    for (const strategy of this.strategies) await strategy.ingest(event);
  }

  async close(): Promise<void> {
    this.started = false;
    this.closing ??= this.stack?.disposeAsync() ?? Promise.resolve();
    await this.closing;
  }

  async [Symbol.asyncDispose](): Promise<void> {
    await this.close();
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
