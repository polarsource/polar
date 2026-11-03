export type MeterInput =
  | { customer_id: string; external_customer_id?: never }
  | { external_customer_id: string; customer_id?: never };

/**
 * Customer-wide usage and credits for a meter.
 */
export interface CustomerMeter {
  /** Polar meter ID. */
  meter_id: string;
  /** Polar customer ID, when queried with it. */
  customer_id?: string;
  /** Application customer ID, when queried with it. */
  external_customer_id?: string;
  /** Aggregated usage. */
  consumed_units: number;
  /** Units credited to the customer. */
  credited_units: number;
  /** Credited units minus consumed units; may be negative. */
  balance: number;
}
