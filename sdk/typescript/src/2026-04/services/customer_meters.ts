import type { ClientBase } from "../../base";
import type { CustomerMeterSortProperty } from "../models/literals";
import type { CustomerMeter, ListResourceCustomerMeter } from "../models/outputs";

import { HTTPValidationError, ResourceNotFound } from "../errors";

export const listCustomerMeters = (client: ClientBase) => {
  /**
   * List customer meters.
   *
   * **Scopes**: `customer_meters:read`
   *
   * @param query - Query parameters
   * @returns {ListResourceCustomerMeter}
   * @throws {PolarNetworkError} When a network error occurs
   * @throws {PolarRateLimitError} When the rate limit is exceeded
   * @throws {PolarServerError} When the server returns a 5xx error
   * @throws {HTTPValidationError} Validation Error
   */
  return async (query?: {
    organization_id?: string | string[] | null;
    customer_id?: string | string[] | null;
    external_customer_id?: string | string[] | null;
    meter_id?: string | string[] | null;
    page?: number;
    limit?: number;
    sorting?: CustomerMeterSortProperty[] | null;
  }): Promise<ListResourceCustomerMeter> => {
    const pathParams = {};
    const queryParams = {
      organization_id: query?.organization_id,
      customer_id: query?.customer_id,
      external_customer_id: query?.external_customer_id,
      meter_id: query?.meter_id,
      page: query?.page ?? 1,
      limit: query?.limit ?? 10,
      sorting: query?.sorting ?? ["-modified_at"],
    };
    const request = client.buildRequest(
      "GET",
      "/v1/customer-meters/",
      pathParams,
      queryParams,
      undefined,
    );
    const response = await client.sendRequest(request);
    return client.parseResponse<ListResourceCustomerMeter>(response, "json", {
      422: HTTPValidationError,
    });
  };
};
/**
 * List customer meters.
 *
 * **Scopes**: `customer_meters:read`
 *
 * @param query - Query parameters
 * @returns {AsyncGenerator<CustomerMeter>} A generator that yields items of type CustomerMeter.
 * @throws {PolarNetworkError} When a network error occurs
 * @throws {PolarRateLimitError} When the rate limit is exceeded
 * @throws {PolarServerError} When the server returns a 5xx error
 * @throws {HTTPValidationError} Validation Error
 */
export const iterlistCustomerMeters = (client: ClientBase) => {
  return async function* (query?: {
    organization_id?: string | string[] | null;
    customer_id?: string | string[] | null;
    external_customer_id?: string | string[] | null;
    meter_id?: string | string[] | null;
    page?: number;
    limit?: number;
    sorting?: CustomerMeterSortProperty[] | null;
  }): AsyncGenerator<CustomerMeter> {
    let page: number;
    page = query?.page ?? 1;
    let limit: number | undefined;
    limit = query?.limit;

    while (true) {
      const response = await listCustomerMeters(client)({ ...query, page, limit });
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
export const getCustomerMeters = (client: ClientBase) => {
  /**
   * Get a customer meter by ID.
   *
   * **Scopes**: `customer_meters:read`
   *
   * @param id - The customer meter ID.
   * @returns {CustomerMeter}
   * @throws {PolarNetworkError} When a network error occurs
   * @throws {PolarRateLimitError} When the rate limit is exceeded
   * @throws {PolarServerError} When the server returns a 5xx error
   * @throws {ResourceNotFound} Customer meter not found.
   * @throws {HTTPValidationError} Validation Error
   */
  return async (id: string): Promise<CustomerMeter> => {
    const pathParams = {
      id: id,
    };
    const queryParams = {};
    const request = client.buildRequest(
      "GET",
      "/v1/customer-meters/{id}",
      pathParams,
      queryParams,
      undefined,
    );
    const response = await client.sendRequest(request);
    return client.parseResponse<CustomerMeter>(response, "json", {
      404: ResourceNotFound,
      422: HTTPValidationError,
    });
  };
};

export function createCustomerMetersService(client: ClientBase) {
  return {
    list: listCustomerMeters(client),
    get: getCustomerMeters(client),
    iterlist: iterlistCustomerMeters(client),
  };
}

export type CustomerMeters = ReturnType<typeof createCustomerMetersService>;
