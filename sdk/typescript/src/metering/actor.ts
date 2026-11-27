import type { ContextualEventInput, EventCustomerInput, EventExternalCustomerInput } from "./event";
import type { CustomerMeter } from "./meter";

/** Exactly one customer identity, with an optional member of the same identifier kind. */
export type ActorInput =
  | (Pick<EventCustomerInput, "customer_id" | "member_id"> & {
      external_customer_id?: never;
      external_member_id?: never;
    })
  | (Pick<EventExternalCustomerInput, "external_customer_id" | "external_member_id"> & {
      customer_id?: never;
      member_id?: never;
    });

/**
 * Customer-bound helper returned by polar.actor().
 *
 * Member identifiers apply to events; meter reads remain customer-wide.
 * The helper shares its parent's lifecycle and owns no resources.
 */
export interface Actor {
  /** Ask Outpost to load this customer's state when Outpost is enabled. */
  warmup(): Promise<void>;

  /**
   * Track an event with this actor's identifiers attached.
   *
   * @param event Event name and optional metadata, timestamp, or external ID.
   */
  track(event: ContextualEventInput): Promise<void>;
  /**
   * Read this customer's meter.
   *
   * @param meterId Polar meter ID.
   * @returns Consumption, credits, and balance, or null if no meter is found.
   */
  meter(meterId: string): Promise<CustomerMeter | null>;
}

export const validateActor = (input: {
  customer_id?: string;
  member_id?: string | null;
  external_customer_id?: string;
  external_member_id?: string | null;
}): void => {
  if ((input.customer_id == null) === (input.external_customer_id == null)) {
    throw new TypeError("Provide exactly one customer_id or external_customer_id");
  }
  if (input.member_id != null && input.customer_id == null) {
    throw new TypeError("member_id requires customer_id");
  }
  if (input.external_member_id != null && input.external_customer_id == null) {
    throw new TypeError("external_member_id requires external_customer_id");
  }
};
