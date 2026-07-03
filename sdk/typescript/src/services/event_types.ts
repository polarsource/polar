import { ClientBase } from "../base";
import type { EventTypeUpdate } from "../models/inputs";
import type {
  EventType,
  EventTypeWithStats,
  ListResourceEventTypeWithStats,
} from "../models/outputs";
import type { EventSource, EventTypesSortProperty } from "../models/literals";
import { HTTPValidationError, Update404Error } from "../errors";

export const listEventTypes = (client: ClientBase) => {
  /**
   * List event types with aggregated statistics.
   *
   * **Scopes**: `events:read` `events:write`
   *
   * @param query - Query parameters
   * @returns {ListResourceEventTypeWithStats}
   * @throws {PolarNetworkError} When a network error occurs
   * @throws {PolarServerError} When the server returns a 5xx error
   * @throws {HTTPValidationError} Validation Error
   */
  return async (query?: {
    organization_id?: string | string[] | null;
    customer_id?: string | string[] | null;
    external_customer_id?: string | string[] | null;
    query?: string | null;
    root_events?: boolean;
    parent_id?: string | null;
    source?: EventSource | null;
    page?: number;
    limit?: number;
    sorting?: EventTypesSortProperty[] | null;
  }): Promise<ListResourceEventTypeWithStats> => {
    const pathParams = {};
    const queryParams = {
      organization_id: query?.organization_id,
      customer_id: query?.customer_id,
      external_customer_id: query?.external_customer_id,
      query: query?.query,
      root_events: query?.root_events,
      parent_id: query?.parent_id,
      source: query?.source,
      page: query?.page ?? 1,
      limit: query?.limit ?? 10,
      sorting: query?.sorting ?? ["-last_seen"],
    };
    const request = client.buildRequest(
      "GET",
      "/v1/event-types/",
      pathParams,
      queryParams,
      undefined,
    );
    const response = await client.sendRequest(request);
    return client.parseResponse<ListResourceEventTypeWithStats>(response, "json", {
      422: HTTPValidationError,
    });
  };
};
/**
 * List event types with aggregated statistics.
 *
 * **Scopes**: `events:read` `events:write`
 *
 * @param query - Query parameters
 * @returns {AsyncGenerator<EventTypeWithStats>} A generator that yields items of type EventTypeWithStats.
 * @throws {PolarNetworkError} When a network error occurs
 * @throws {PolarServerError} When the server returns a 5xx error
 * @throws {HTTPValidationError} Validation Error
 */
export const iterlistEventTypes = (client: ClientBase) => {
  return async function* (query?: {
    organization_id?: string | string[] | null;
    customer_id?: string | string[] | null;
    external_customer_id?: string | string[] | null;
    query?: string | null;
    root_events?: boolean;
    parent_id?: string | null;
    source?: EventSource | null;
    page?: number;
    limit?: number;
    sorting?: EventTypesSortProperty[] | null;
  }): AsyncGenerator<EventTypeWithStats> {
    let page: number;
    page = query?.page ?? 1;
    let limit: number | undefined;
    limit = query?.limit;

    while (true) {
      const response = await listEventTypes(client)({ ...query, page, limit });
      for (const item of response.items) {
        yield item;
      }
      if (page >= response.pagination.max_page) {
        break;
      }
      page++;
    }
  };
};
export const updateEventTypes = (client: ClientBase) => {
  /**
   * Update an event type's label.
   *
   * **Scopes**: `events:write`
   *
   * @param id - The event type ID.
   * @param body - Request body
   * @returns {EventType}
   * @throws {PolarNetworkError} When a network error occurs
   * @throws {PolarServerError} When the server returns a 5xx error
   * @throws {Update404Error} Not Found
   * @throws {HTTPValidationError} Validation Error
   */
  return async (id: string, body: EventTypeUpdate): Promise<EventType> => {
    const pathParams = {
      id: id,
    };
    const queryParams = {};
    const request = client.buildRequest(
      "PATCH",
      "/v1/event-types/{id}",
      pathParams,
      queryParams,
      body,
    );
    const response = await client.sendRequest(request);
    return client.parseResponse<EventType>(response, "json", {
      404: Update404Error,
      422: HTTPValidationError,
    });
  };
};

export function createEventTypesService(client: ClientBase) {
  return {
    list: listEventTypes(client),
    update: updateEventTypes(client),
    iterlist: iterlistEventTypes(client),
  };
}

export type EventTypes = ReturnType<typeof createEventTypesService>;
