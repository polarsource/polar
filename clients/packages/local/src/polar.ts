/**
 * Polar Ingestion API wire types — a faithful TypeScript mirror of the
 * `/v1/events/ingest` OpenAPI schema (components: EventCreateCustomer,
 * EventCreateExternalCustomer, EventMetadataInput, CostMetadata, LLMMetadata).
 *
 * Kept separate from sink.ts so the schema is the single source of truth for
 * "what Polar accepts", independent of how we map our events onto it.
 */

/** Documented limits from EventMetadataInput / EventCreate*. */
export const POLAR_LIMITS = {
  nameMaxLength: 128,
  metadataKeyMaxLength: 40,
  metadataStringMaxLength: 500,
  metadataMaxPairs: 50,
} as const;

/** `_cost` structured metadata. `amount` is in cents; only `usd` is supported. */
export interface PolarCostMetadata {
  readonly amount: number | string;
  readonly currency: "usd";
}

/** `_llm` structured metadata for LLM usage events. */
export interface PolarLLMMetadata {
  readonly vendor: string;
  readonly model: string;
  readonly prompt?: string | null;
  readonly response?: string | null;
  readonly input_tokens: number;
  readonly cached_input_tokens?: number;
  readonly output_tokens: number;
  readonly total_tokens: number;
}

export type PolarMetadataValue = string | number | boolean | PolarCostMetadata | PolarLLMMetadata;

export type PolarMetadata = Record<string, PolarMetadataValue>;

interface PolarEventBase {
  readonly name: string;
  readonly timestamp?: string;
  readonly organization_id?: string | null;
  /** Your unique id for the event — used by Polar for deduplication. */
  readonly external_id?: string | null;
  readonly parent_id?: string | null;
  readonly metadata?: PolarMetadata;
}

/** Event keyed by a Polar customer UUID. */
export interface EventCreateCustomer extends PolarEventBase {
  readonly customer_id: string;
  readonly member_id?: string | null;
}

/** Event keyed by your own customer id. */
export interface EventCreateExternalCustomer extends PolarEventBase {
  readonly external_customer_id: string;
  readonly external_member_id?: string | null;
}

export type PolarEvent = EventCreateCustomer | EventCreateExternalCustomer;

// ── Meters (POST/GET /v1/meters) ─────────────────────────────────────────────
// Mirror of the meters create/list OpenAPI schema. A meter selects events with
// a filter and reduces them with an aggregation — the same model local's local
// meters use, which is what lets a Plan compile straight into Polar config.

/** Polar meter names must be at least this long. */
export const METER_NAME_MIN_LENGTH = 3;

export type MeterFilterOperator = "eq" | "ne" | "gt" | "gte" | "lt" | "lte" | "like" | "not_like";

export interface MeterFilterClause {
  /** Event attribute to match — e.g. "name" for the event name, or "metadata.x". */
  readonly property: string;
  readonly operator: MeterFilterOperator;
  readonly value: string | number | boolean;
}

export interface MeterFilter {
  readonly conjunction: "and" | "or";
  readonly clauses: ReadonlyArray<MeterFilterClause>;
}

/** Discriminated by `func`. `count` takes no property; the rest aggregate one. */
export type MeterAggregation =
  | { readonly func: "count" }
  | { readonly func: "sum" | "max" | "min" | "avg" | "unique"; readonly property: string };

export interface MeterCreate {
  readonly name: string;
  readonly filter: MeterFilter;
  readonly aggregation: MeterAggregation;
  readonly organization_id?: string;
  readonly unit?: "scalar" | "token" | "custom";
}

/** A meter as returned by GET /v1/meters. */
export interface Meter {
  readonly id: string;
  readonly name: string;
  readonly filter: MeterFilter;
  readonly aggregation: MeterAggregation;
  readonly organization_id?: string;
}

export interface EventsIngest {
  readonly events: ReadonlyArray<PolarEvent>;
}

const isStructured = (v: PolarMetadataValue): boolean =>
  typeof v === "object" && v !== null;

/**
 * local-specific rule (stricter than Polar, which allows floats): every numeric
 * metadata value must be an integer. This keeps the metered quantity × price
 * math in exact bigint micro-cents. Fractional units should be sent pre-scaled
 * (e.g. micro-units). Returns a reason on the first violation, else null.
 */
export const validateIntegerMetadata = (event: PolarEvent): string | null => {
  const metadata = event.metadata ?? {};
  for (const key of Object.keys(metadata)) {
    const value = metadata[key]!;
    if (typeof value === "number" && !Number.isInteger(value)) {
      return `metadata "${key}" must be an integer (got ${value}); send fractional units pre-scaled`;
    }
  }
  return null;
};

/**
 * Validate one event against Polar's documented constraints. Returns a
 * human-readable reason on the first violation, or null if it's well-formed.
 * Catching these locally turns a remote 422 into an immediate, precise error.
 */
export const validatePolarEvent = (event: PolarEvent): string | null => {
  if (event.name.length > POLAR_LIMITS.nameMaxLength) {
    return `name exceeds ${POLAR_LIMITS.nameMaxLength} characters`;
  }
  const metadata = event.metadata ?? {};
  const keys = Object.keys(metadata);
  if (keys.length > POLAR_LIMITS.metadataMaxPairs) {
    return `metadata has ${keys.length} keys (max ${POLAR_LIMITS.metadataMaxPairs})`;
  }
  for (const key of keys) {
    if (key.length > POLAR_LIMITS.metadataKeyMaxLength) {
      return `metadata key "${key}" exceeds ${POLAR_LIMITS.metadataKeyMaxLength} characters`;
    }
    const value = metadata[key]!;
    if (typeof value === "string" && value.length > POLAR_LIMITS.metadataStringMaxLength) {
      return `metadata "${key}" string exceeds ${POLAR_LIMITS.metadataStringMaxLength} characters`;
    }
    if (typeof value === "number" && !Number.isFinite(value)) {
      return `metadata "${key}" is not a finite number`;
    }
    if (typeof value === "boolean" || typeof value === "string" || typeof value === "number" || isStructured(value)) {
      continue;
    }
    return `metadata "${key}" has an unsupported value type`;
  }
  return null;
};
