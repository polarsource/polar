import type { ClientBase } from "../../base";
import type {
  Event,
  EventName,
  EventNamesSortProperty,
  EventSortProperty,
  EventSource,
  EventsIngest,
  EventsIngestResponse,
  ListResourceEvent,
  ListResourceEventName,
  ListResourceWithCursorPaginationEvent,
  MetadataQuery,
} from "../models";

import { HTTPValidationError, ResourceNotFound } from "../errors";

export const listEvents = (client: ClientBase) => {
  /**
   * List events.
   *
   * **Scopes**: `events:read` `events:write`
   *
   * @param query - Query parameters
   * @returns {ListResourceEvent | ListResourceWithCursorPaginationEvent}
   * @throws {PolarNetworkError} When a network error occurs
   * @throws {PolarRateLimitError} When the rate limit is exceeded
   * @throws {PolarServerError} When the server returns a 5xx error
   * @throws {HTTPValidationError} Validation Error
   */
  return async (query?: {
    filter?: string | null;
    start_timestamp?: string | null;
    end_timestamp?: string | null;
    organization_id?: string | string[] | null;
    customer_id?: string | string[] | null;
    external_customer_id?: string | string[] | null;
    meter_id?: string | null;
    name?: string | string[] | null;
    source?: EventSource | EventSource[] | null;
    query?: string | null;
    parent_id?: string | null;
    depth?: number | null;
    page?: number;
    limit?: number;
    sorting?: EventSortProperty[] | null;
    metadata?: MetadataQuery;
  }): Promise<ListResourceEvent | ListResourceWithCursorPaginationEvent> => {
    const pathParams = {};
    const queryParams = {
      filter: query?.filter,
      start_timestamp: query?.start_timestamp,
      end_timestamp: query?.end_timestamp,
      organization_id: query?.organization_id,
      customer_id: query?.customer_id,
      external_customer_id: query?.external_customer_id,
      meter_id: query?.meter_id,
      name: query?.name,
      source: query?.source,
      query: query?.query,
      parent_id: query?.parent_id,
      depth: query?.depth,
      page: query?.page ?? 1,
      limit: query?.limit ?? 10,
      sorting: query?.sorting ?? ["-timestamp"],
      metadata: query?.metadata,
    };
    const request = client.buildRequest("GET", "/v1/events/", pathParams, queryParams, undefined);
    const response = await client.sendRequest(request);
    return client.parseResponse<ListResourceEvent | ListResourceWithCursorPaginationEvent>(
      response,
      "json",
      {
        422: HTTPValidationError,
      },
    );
  };
};
export const listNamesEvents = (client: ClientBase) => {
  /**
   * List event names.
   *
   * **Scopes**: `events:read` `events:write`
   *
   * @param query - Query parameters
   * @returns {ListResourceEventName}
   * @throws {PolarNetworkError} When a network error occurs
   * @throws {PolarRateLimitError} When the rate limit is exceeded
   * @throws {PolarServerError} When the server returns a 5xx error
   * @throws {HTTPValidationError} Validation Error
   */
  return async (query?: {
    organization_id?: string | string[] | null;
    customer_id?: string | string[] | null;
    external_customer_id?: string | string[] | null;
    source?: EventSource | EventSource[] | null;
    query?: string | null;
    page?: number;
    limit?: number;
    sorting?: EventNamesSortProperty[] | null;
  }): Promise<ListResourceEventName> => {
    const pathParams = {};
    const queryParams = {
      organization_id: query?.organization_id,
      customer_id: query?.customer_id,
      external_customer_id: query?.external_customer_id,
      source: query?.source,
      query: query?.query,
      page: query?.page ?? 1,
      limit: query?.limit ?? 10,
      sorting: query?.sorting ?? ["-last_seen"],
    };
    const request = client.buildRequest(
      "GET",
      "/v1/events/names",
      pathParams,
      queryParams,
      undefined,
    );
    const response = await client.sendRequest(request);
    return client.parseResponse<ListResourceEventName>(response, "json", {
      422: HTTPValidationError,
    });
  };
};
/**
 * List event names.
 *
 * **Scopes**: `events:read` `events:write`
 *
 * @param query - Query parameters
 * @returns {AsyncGenerator<EventName>} A generator that yields items of type EventName.
 * @throws {PolarNetworkError} When a network error occurs
 * @throws {PolarRateLimitError} When the rate limit is exceeded
 * @throws {PolarServerError} When the server returns a 5xx error
 * @throws {HTTPValidationError} Validation Error
 */
export const iterlistNamesEvents = (client: ClientBase) => {
  return async function* (query?: {
    organization_id?: string | string[] | null;
    customer_id?: string | string[] | null;
    external_customer_id?: string | string[] | null;
    source?: EventSource | EventSource[] | null;
    query?: string | null;
    page?: number;
    limit?: number;
    sorting?: EventNamesSortProperty[] | null;
  }): AsyncGenerator<EventName> {
    let page: number;
    page = query?.page ?? 1;
    let limit: number | undefined;
    limit = query?.limit;

    while (true) {
      const response = await listNamesEvents(client)({ ...query, page, limit });
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
export const getEvents = (client: ClientBase) => {
  /**
   * Get an event by ID.
   *
   * **Scopes**: `events:read` `events:write`
   *
   * @param id - The event ID.
   * @returns {Event}
   * @throws {PolarNetworkError} When a network error occurs
   * @throws {PolarRateLimitError} When the rate limit is exceeded
   * @throws {PolarServerError} When the server returns a 5xx error
   * @throws {ResourceNotFound} Event not found.
   * @throws {HTTPValidationError} Validation Error
   */
  return async (id: string): Promise<Event> => {
    const pathParams = {
      id: id,
    };
    const queryParams = {};
    const request = client.buildRequest(
      "GET",
      "/v1/events/{id}",
      pathParams,
      queryParams,
      undefined,
    );
    const response = await client.sendRequest(request);
    return client.parseResponse<Event>(response, "json", {
      404: ResourceNotFound,
      422: HTTPValidationError,
    });
  };
};
export const ingestEvents = (client: ClientBase) => {
  /**
   * Ingest batch of events.
   *
   * **Scopes**: `events:write`
   *
   * @param body - Request body
   * @returns {EventsIngestResponse}
   * @throws {PolarNetworkError} When a network error occurs
   * @throws {PolarRateLimitError} When the rate limit is exceeded
   * @throws {PolarServerError} When the server returns a 5xx error
   * @throws {HTTPValidationError} Validation Error
   */
  return async (body: EventsIngest): Promise<EventsIngestResponse> => {
    const pathParams = {};
    const queryParams = {};
    const request = client.buildRequest("POST", "/v1/events/ingest", pathParams, queryParams, body);
    const response = await client.sendRequest(request);
    return client.parseResponse<EventsIngestResponse>(response, "json", {
      422: HTTPValidationError,
    });
  };
};

export function createEventsService(client: ClientBase) {
  return {
    list: listEvents(client),
    listNames: listNamesEvents(client),
    get: getEvents(client),
    ingest: ingestEvents(client),
    iterlistNames: iterlistNamesEvents(client),
  };
}

export type Events = ReturnType<typeof createEventsService>;
