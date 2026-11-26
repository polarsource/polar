import type { DeliveryOptions, DropReason } from "../errors";
import type { EventInput } from "../event";

export type Ingest = (events: EventInput[], options?: { signal?: AbortSignal }) => Promise<void>;

export interface EventQueueHooks {
  onAck?: (events: EventInput[]) => void | Promise<void>;
  onRejected?: (events: EventInput[], reason: DropReason) => void | Promise<void>;
}

export interface EventQueueStartOptions extends EventQueueHooks {
  ingest: Ingest;
}

export interface EventQueue {
  start(options: EventQueueStartOptions): Promise<unknown>;
  close(options?: DeliveryOptions): Promise<void>;
  enqueue(event: EventInput): Promise<void>;
  flush(options?: DeliveryOptions): Promise<void>;
}
