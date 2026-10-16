export type MeterInput = { meter_id: string } & (
  | { customer_id: string; external_customer_id?: never }
  | { external_customer_id: string; customer_id?: never }
);

export interface CustomerMeter {
  meter_id: string;
  customer_id?: string;
  external_customer_id?: string;
  consumed_units: number;
  credited_units: number;
  balance: number;
}
