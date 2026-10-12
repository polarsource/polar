export interface EventInput {
  name: string;
  timestamp?: string;
  customer_id?: string;
  external_customer_id?: string;
  metadata?: Record<string, unknown>;
}

export interface Event {
  name: string;
  customer: string;
  timestamp: number;
  metadata: Record<string, unknown>;
}

export const customerKey = (
  input: Pick<EventInput, "customer_id" | "external_customer_id">,
): string => {
  if ((input.customer_id === undefined) === (input.external_customer_id === undefined)) {
    throw new TypeError("Provide exactly one customer_id or external_customer_id");
  }
  const identifier = input.customer_id ?? input.external_customer_id;
  if (typeof identifier !== "string") throw new TypeError("Customer identifier must be a string");
  return `${input.customer_id !== undefined ? "customer" : "external"}:${identifier}`;
};

export const parseEvent = (input: EventInput): Event => {
  if (typeof input.name !== "string") throw new TypeError("Event name must be a string");
  if (
    input.timestamp !== undefined &&
    (typeof input.timestamp !== "string" || !/(Z|[+-]\d{2}:?\d{2})$/i.test(input.timestamp))
  ) {
    throw new TypeError("Event timestamps must include a timezone");
  }
  const timestamp = input.timestamp === undefined ? Date.now() : Date.parse(input.timestamp);
  if (!Number.isFinite(timestamp)) throw new TypeError("Invalid event timestamp");
  if (
    input.metadata !== undefined &&
    (input.metadata === null || typeof input.metadata !== "object" || Array.isArray(input.metadata))
  ) {
    throw new TypeError("Event metadata must be an object");
  }
  return {
    name: input.name,
    customer: customerKey(input),
    timestamp: timestamp / 1000,
    metadata: input.metadata ?? {},
  };
};

export const getProperty = (event: Event, property: string): unknown => {
  if (property === "name") return event.name;
  if (property === "source") return "user";
  if (property === "timestamp") return Math.trunc(event.timestamp);
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
