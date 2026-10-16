import type {
  EventCreateCustomer as EventCreateCustomer2026_04,
  EventCreateExternalCustomer as EventCreateExternalCustomer2026_04,
} from "../2026-04/models";
import type {
  EventCreateCustomer as EventCreateCustomer2026_10,
  EventCreateExternalCustomer as EventCreateExternalCustomer2026_10,
} from "../2026-10/models";
import type {
  EventCreateCustomer as EventCreateCustomer2027_01,
  EventCreateExternalCustomer as EventCreateExternalCustomer2027_01,
} from "../2027-01/models";

export type EventInput =
  | EventCreateCustomer2026_04
  | EventCreateExternalCustomer2026_04
  | EventCreateCustomer2026_10
  | EventCreateExternalCustomer2026_10
  | EventCreateCustomer2027_01
  | EventCreateExternalCustomer2027_01;
