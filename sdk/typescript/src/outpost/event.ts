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
export interface Event {
  name: string;
  customer: string;
  timestamp: number;
  metadata: Record<string, unknown>;
}

export const customerKey = (input: {
  customer_id?: string;
  external_customer_id?: string;
}): string => {
  if ((input.customer_id === undefined) === (input.external_customer_id === undefined)) {
    throw new TypeError("Provide exactly one customer_id or external_customer_id");
  }
  const identifier = input.customer_id ?? input.external_customer_id;
  return `${input.customer_id !== undefined ? "customer" : "external"}:${identifier}`;
};

export const parseEvent = (input: EventInput): Event => {
  if (input.timestamp !== undefined && !/(Z|[+-]\d{2}:?\d{2})$/i.test(input.timestamp)) {
    throw new TypeError("Event timestamps must include a timezone");
  }
  const timestamp = input.timestamp === undefined ? Date.now() : Date.parse(input.timestamp);
  const fraction = input.timestamp?.match(/\.(\d+)/)?.[1] ?? "";
  const microseconds = timestamp * 1000 + Number(fraction.padEnd(6, "0").slice(3, 6));
  if (!Number.isSafeInteger(microseconds)) throw new TypeError("Invalid event timestamp");
  return {
    name: input.name,
    customer: customerKey(input),
    timestamp: microseconds,
    metadata: input.metadata ?? {},
  };
};

export const getProperty = (event: Event, property: string): unknown => {
  if (property === "name") return event.name;
  if (property === "source") return "user";
  if (property === "timestamp") return Math.trunc(event.timestamp / 1_000_000);
  let value: unknown = event.metadata;
  for (const part of property.replace(/^metadata\./, "").split(".")) {
    if (
      value === null ||
      typeof value !== "object" ||
      Array.isArray(value) ||
      !Object.hasOwn(value, part)
    )
      return undefined;
    value = (value as Record<string, unknown>)[part];
  }
  return value;
};
