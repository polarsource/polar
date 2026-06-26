import { ClientBase } from "../../base";
import type {
  CustomerCustomerMeter,
  ListResourceCustomerCustomerMeter,
} from "../../models/outputs";
import type { CustomerCustomerMeterSortProperty } from "../../models/literals";
import { HTTPValidationError, ResourceNotFound } from "../../errors";

export const listCustomerMeters = (client: ClientBase) => {
  /**
   * List meters of the authenticated customer.
   *
   * **Scopes**: `customer_portal:read` `customer_portal:write`
   *
   * @param query - Query parameters
   * @returns {ListResourceCustomerCustomerMeter}
   * @throws {PolarNetworkError} When a network error occurs
   * @throws {PolarServerError} When the server returns a 5xx error
   * @throws {HTTPValidationError} Validation Error
   */
  return async (query?: {
    meter_id?: string | string[] | null;
    query?: string | null;
    page?: number;
    limit?: number;
    sorting?: CustomerCustomerMeterSortProperty[] | null;
  }): Promise<ListResourceCustomerCustomerMeter> => {
    const pathParams = {};
    const queryParams = {
      meter_id: query?.meter_id,
      query: query?.query,
      page: query?.page || 1,
      limit: query?.limit || 10,
      sorting: query?.sorting || ["-modified_at"],
    };
    const request = client.buildRequest(
      "GET",
      "/v1/customer-portal/meters/",
      pathParams,
      queryParams,
      undefined,
    );
    const response = await client.sendRequest(request);
    return client.parseResponse<ListResourceCustomerCustomerMeter>(response, "json", {
      422: HTTPValidationError,
    });
  };
};
export const getCustomerMeters = (client: ClientBase) => {
  /**
   * Get a meter by ID for the authenticated customer.
   *
   * **Scopes**: `customer_portal:read` `customer_portal:write`
   *
   * @param id - The customer meter ID.
   * @returns {CustomerCustomerMeter}
   * @throws {PolarNetworkError} When a network error occurs
   * @throws {PolarServerError} When the server returns a 5xx error
   * @throws {ResourceNotFound} Customer meter not found.
   * @throws {HTTPValidationError} Validation Error
   */
  return async (id: string): Promise<CustomerCustomerMeter> => {
    const pathParams = {
      id: id,
    };
    const queryParams = {};
    const request = client.buildRequest(
      "GET",
      "/v1/customer-portal/meters/{id}",
      pathParams,
      queryParams,
      undefined,
    );
    const response = await client.sendRequest(request);
    return client.parseResponse<CustomerCustomerMeter>(response, "json", {
      404: ResourceNotFound,
      422: HTTPValidationError,
    });
  };
};

export function createCustomerMetersService(client: ClientBase) {
  return {
    list: listCustomerMeters(client),
    get: getCustomerMeters(client),
  };
}

export type CustomerMeters = ReturnType<typeof createCustomerMetersService>;
