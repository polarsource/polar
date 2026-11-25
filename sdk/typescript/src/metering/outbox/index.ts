import type { DeliveryOptions } from "../errors";
import type { EventInput } from "../event";

export interface Outbox {
  start(): Promise<unknown>;
  close(): Promise<void>;
  enqueue(event: EventInput): Promise<void>;
  flush(options?: DeliveryOptions): Promise<void>;
}
