import type { DeliveryOptions, DropReason } from "../errors";
import type { EventInput } from "../event";

export interface EventQueueHooks {
  onAck?: (events: EventInput[]) => void | Promise<void>;
  onRejected?: (events: EventInput[], reason: DropReason) => void | Promise<void>;
}

export interface EventQueue {
  start(hooks?: EventQueueHooks): Promise<unknown>;
  close(options?: DeliveryOptions): Promise<void>;
  enqueue(event: EventInput): Promise<void>;
  flush(options?: DeliveryOptions): Promise<void>;
}
