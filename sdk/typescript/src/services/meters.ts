import { ClientBase } from "../base";
import type { MetadataQuery, MeterCreate, MeterUpdate } from "../models/inputs";
import type { ListResourceMeter, Meter, MeterQuantities } from "../models/outputs";
import type {
  AggregationFunction,
  MeterSortProperty,
  TimeInterval,
  Timezone,
} from "../models/literals";
import { HTTPValidationError, ResourceNotFound } from "../errors";

export const listMeters = (client: ClientBase) => {
  /**
   * List meters.
   *
   * **Scopes**: `meters:read` `meters:write`
   *
   * @param query - Query parameters
   * @returns {ListResourceMeter}
   * @throws {PolarNetworkError} When a network error occurs
   * @throws {PolarServerError} When the server returns a 5xx error
   * @throws {HTTPValidationError} Validation Error
   */
  return async (query?: {
    organization_id?: string | string[] | null;
    query?: string | null;
    is_archived?: boolean | null;
    page?: number;
    limit?: number;
    sorting?: MeterSortProperty[] | null;
    metadata?: MetadataQuery;
  }): Promise<ListResourceMeter> => {
    const pathParams = {};
    const queryParams = {
      organization_id: query?.organization_id,
      query: query?.query,
      is_archived: query?.is_archived,
      page: query?.page ?? 1,
      limit: query?.limit ?? 10,
      sorting: query?.sorting ?? ["name"],
      metadata: query?.metadata,
    };
    const request = client.buildRequest("GET", "/v1/meters/", pathParams, queryParams, undefined);
    const response = await client.sendRequest(request);
    return client.parseResponse<ListResourceMeter>(response, "json", {
      422: HTTPValidationError,
    });
  };
};
/**
 * List meters.
 *
 * **Scopes**: `meters:read` `meters:write`
 *
 * @param query - Query parameters
 * @returns {AsyncGenerator<Meter>} A generator that yields items of type Meter.
 * @throws {PolarNetworkError} When a network error occurs
 * @throws {PolarServerError} When the server returns a 5xx error
 * @throws {HTTPValidationError} Validation Error
 */
export const iterlistMeters = (client: ClientBase) => {
  return async function* (query?: {
    organization_id?: string | string[] | null;
    query?: string | null;
    is_archived?: boolean | null;
    page?: number;
    limit?: number;
    sorting?: MeterSortProperty[] | null;
    metadata?: MetadataQuery;
  }): AsyncGenerator<Meter> {
    let page: number;
    page = query?.page ?? 1;
    let limit: number | undefined;
    limit = query?.limit;

    while (true) {
      const response = await listMeters(client)({ ...query, page, limit });
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
export const createMeters = (client: ClientBase) => {
  /**
   * Create a meter.
   *
   * **Scopes**: `meters:write`
   *
   * @param body - Request body
   * @returns {Meter}
   * @throws {PolarNetworkError} When a network error occurs
   * @throws {PolarServerError} When the server returns a 5xx error
   * @throws {HTTPValidationError} Validation Error
   */
  return async (body: MeterCreate): Promise<Meter> => {
    const pathParams = {};
    const queryParams = {};
    const request = client.buildRequest("POST", "/v1/meters/", pathParams, queryParams, body);
    const response = await client.sendRequest(request);
    return client.parseResponse<Meter>(response, "json", {
      422: HTTPValidationError,
    });
  };
};
export const getMeters = (client: ClientBase) => {
  /**
   * Get a meter by ID.
   *
   * **Scopes**: `meters:read` `meters:write`
   *
   * @param id - The meter ID.
   * @returns {Meter}
   * @throws {PolarNetworkError} When a network error occurs
   * @throws {PolarServerError} When the server returns a 5xx error
   * @throws {ResourceNotFound} Meter not found.
   * @throws {HTTPValidationError} Validation Error
   */
  return async (id: string): Promise<Meter> => {
    const pathParams = {
      id: id,
    };
    const queryParams = {};
    const request = client.buildRequest(
      "GET",
      "/v1/meters/{id}",
      pathParams,
      queryParams,
      undefined,
    );
    const response = await client.sendRequest(request);
    return client.parseResponse<Meter>(response, "json", {
      404: ResourceNotFound,
      422: HTTPValidationError,
    });
  };
};
export const updateMeters = (client: ClientBase) => {
  /**
   * Update a meter.
   *
   * **Scopes**: `meters:write`
   *
   * @param id - The meter ID.
   * @param body - Request body
   * @returns {Meter}
   * @throws {PolarNetworkError} When a network error occurs
   * @throws {PolarServerError} When the server returns a 5xx error
   * @throws {ResourceNotFound} Meter not found.
   * @throws {HTTPValidationError} Validation Error
   */
  return async (id: string, body: MeterUpdate): Promise<Meter> => {
    const pathParams = {
      id: id,
    };
    const queryParams = {};
    const request = client.buildRequest("PATCH", "/v1/meters/{id}", pathParams, queryParams, body);
    const response = await client.sendRequest(request);
    return client.parseResponse<Meter>(response, "json", {
      404: ResourceNotFound,
      422: HTTPValidationError,
    });
  };
};
export const quantitiesMeters = (client: ClientBase) => {
  /**
   * Get quantities of a meter over a time period.
   *
   * **Scopes**: `meters:read` `meters:write`
   *
   * @param id - The meter ID.
   * @param query - Query parameters
   * @returns {MeterQuantities}
   * @throws {PolarNetworkError} When a network error occurs
   * @throws {PolarServerError} When the server returns a 5xx error
   * @throws {ResourceNotFound} Meter not found.
   * @throws {HTTPValidationError} Validation Error
   */
  return async (
    id: string,
    query: {
      start_timestamp: string;
      end_timestamp: string;
      interval: TimeInterval;
      timezone?: Timezone;
      customer_id?: string | string[] | null;
      external_customer_id?: string | string[] | null;
      customer_aggregation_function?: AggregationFunction | null;
      metadata?: MetadataQuery;
    },
  ): Promise<MeterQuantities> => {
    const pathParams = {
      id: id,
    };
    const queryParams = {
      start_timestamp: query.start_timestamp,
      end_timestamp: query.end_timestamp,
      interval: query.interval,
      timezone: query?.timezone ?? "UTC",
      customer_id: query?.customer_id,
      external_customer_id: query?.external_customer_id,
      customer_aggregation_function: query?.customer_aggregation_function,
      metadata: query?.metadata,
    };
    const request = client.buildRequest(
      "GET",
      "/v1/meters/{id}/quantities",
      pathParams,
      queryParams,
      undefined,
    );
    const response = await client.sendRequest(request);
    return client.parseResponse<MeterQuantities>(response, "json", {
      404: ResourceNotFound,
      422: HTTPValidationError,
    });
  };
};

export function createMetersService(client: ClientBase) {
  return {
    list: listMeters(client),
    create: createMeters(client),
    get: getMeters(client),
    update: updateMeters(client),
    quantities: quantitiesMeters(client),
    iterlist: iterlistMeters(client),
  };
}

export type Meters = ReturnType<typeof createMetersService>;
