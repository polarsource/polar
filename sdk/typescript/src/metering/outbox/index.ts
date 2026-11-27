import type { DeliveryOptions, DropReason } from "../errors";
import type { EventInput } from "../event";

export interface Outbox {
  onAck: ((events: EventInput[]) => void | Promise<void>) | undefined;
  onRejected: ((events: EventInput[], reason: DropReason) => void | Promise<void>) | undefined;

  start(): Promise<unknown>;
  close(): Promise<void>;
  enqueue(event: EventInput): Promise<void>;
  flush(options?: DeliveryOptions): Promise<void>;
}
