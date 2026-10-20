import type { EventInput } from "../metering/event";

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

export type PropertyReader = (event: Event) => unknown;

export const getPropertyReader = (property: string): PropertyReader => {
  if (property === "name") return (event) => event.name;
  if (property === "source") return () => "user";
  if (property === "timestamp") return (event) => Math.trunc(event.timestamp / 1_000_000);
  const path = property.replace(/^metadata\./, "").split(".");
  return (event) => {
    let value: unknown = event.metadata;
    for (const part of path) {
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
};
