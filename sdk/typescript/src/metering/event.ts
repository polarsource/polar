import type { Ingest } from "./queue/index";

import { PolarClientError, PolarNetworkError, PolarServerError, type ClientBase } from "../base";
import { IngestRejectedError, IngestRetryableError, retryAfterMs } from "./errors";

export interface CostMetadataInput {
  amount: number | string;
  currency: string;
}

export interface LLMMetadata {
  vendor: string;
  model: string;
  prompt?: string | null;
  response?: string | null;
  input_tokens: number;
  cached_input_tokens?: number;
  output_tokens: number;
  total_tokens: number;
}

export interface EventMetadataInput {
  _cost?: CostMetadataInput;
  _llm?: LLMMetadata;
  [key: string]: string | number | boolean | CostMetadataInput | LLMMetadata | undefined;
}

export interface ContextualEventInput {
  name: string;
  timestamp?: string;
  organization_id?: string | null;
  external_id?: string | null;
  parent_id?: string | null;
  metadata?: EventMetadataInput;
}

export interface EventCustomerInput extends ContextualEventInput {
  customer_id: string;
  member_id?: string | null;
}

export interface EventExternalCustomerInput extends ContextualEventInput {
  external_customer_id: string;
  external_member_id?: string | null;
}

export type EventInput = EventCustomerInput | EventExternalCustomerInput;

// The indexes of the events Polar's validation refuses, when each of its errors names one.
const refusedIndexes = (error: PolarClientError, batchSize: number): Set<number> | undefined => {
  if (error.statusCode !== 422) return undefined;
  let detail: unknown;
  try {
    // The client keeps the body of an error it has no class for as text.
    detail = (JSON.parse(String(error.error)) as { detail?: unknown } | null)?.detail;
  } catch {
    return undefined;
  }
  if (!Array.isArray(detail)) return undefined;
  const indexes = new Set<number>();
  for (const error of detail as ({ loc?: unknown } | null)[]) {
    const loc = error?.loc;
    if (
      !Array.isArray(loc) ||
      loc[0] !== "body" ||
      loc[1] !== "events" ||
      !Number.isInteger(loc[2])
    )
      return undefined;
    const index = loc[2] as number;
    if (index < 0 || index >= batchSize) return undefined;
    indexes.add(index);
  }
  return indexes.size ? indexes : undefined;
};

export const createIngest =
  (client: ClientBase): Ingest =>
  async (events, options) => {
    try {
      const response = await client.sendRequest(
        client.buildRequest("POST", "/v1/events/ingest", undefined, undefined, { events }),
        options,
      );
      try {
        if (!response.ok) {
          if (response.status < 400)
            throw new IngestRetryableError({
              cause: new Error(`Polar answered ${response.status}`),
            });
          await client.parseResponse(response, "none");
        }
      } finally {
        if (!response.bodyUsed) await response.body?.cancel().catch(() => {});
      }
    } catch (error) {
      if (error instanceof PolarClientError && ![401, 403, 408, 429].includes(error.statusCode)) {
        throw new IngestRejectedError({
          rejectedIndexes: refusedIndexes(error, events.length),
          cause: error,
        });
      }
      if (
        error instanceof PolarClientError ||
        error instanceof PolarNetworkError ||
        error instanceof PolarServerError
      ) {
        throw new IngestRetryableError({
          retryAfterMs: retryAfterMs(error) ?? undefined,
          cause: error,
        });
      }
      throw error;
    }
  };
