import type { ClientBase, RequestOptions } from "../../base";
import type {
  CustomerMeter,
  CustomerMeterCreditsExternalIDCreate,
  CustomerMeterCreditsIDCreate,
  CustomerMeterSortProperty,
  ListResourceCustomerMeter,
  MeterCreditEvent,
} from "../models";

import {
  CustomerMeterCreditNotReversible,
  CustomerMetersCredits409Error,
  HTTPValidationError,
  NotPermitted,
  ResourceNotFound,
} from "../errors";

export const listCustomerMeters = (client: ClientBase) => {
  /**
   * List customer meters.
   *
   * **Scopes**: `customer_meters:read`
   *
   * @param query - Query parameters
   * @param requestOptions - Request options
   * @returns {ListResourceCustomerMeter}
   * @throws {PolarNetworkError} When a network error occurs
   * @throws {PolarRateLimitError} When the rate limit is exceeded
   * @throws {PolarServerError} When the server returns a 5xx error
   * @throws {HTTPValidationError} Validation Error
   */
  return async (
    query?: {
      organization_id?: string | string[] | null;
      customer_id?: string | string[] | null;
      external_customer_id?: string | string[] | null;
      meter_id?: string | string[] | null;
      external_meter_id?: string | string[] | null;
      page?: number;
      limit?: number;
      sorting?: CustomerMeterSortProperty[] | null;
    },
    requestOptions?: RequestOptions,
  ): Promise<ListResourceCustomerMeter> => {
    const pathParams = {};
    const queryParams = {
      organization_id: query?.organization_id,
      customer_id: query?.customer_id,
      external_customer_id: query?.external_customer_id,
      meter_id: query?.meter_id,
      external_meter_id: query?.external_meter_id,
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
    const response = await client.sendRequest(request, requestOptions);
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
 * @param requestOptions - Request options
 * @returns {AsyncGenerator<CustomerMeter>} A generator that yields items of type CustomerMeter.
 * @throws {PolarNetworkError} When a network error occurs
 * @throws {PolarRateLimitError} When the rate limit is exceeded
 * @throws {PolarServerError} When the server returns a 5xx error
 * @throws {HTTPValidationError} Validation Error
 */
export const iterListCustomerMeters = (client: ClientBase) => {
  return async function* (
    query?: {
      organization_id?: string | string[] | null;
      customer_id?: string | string[] | null;
      external_customer_id?: string | string[] | null;
      meter_id?: string | string[] | null;
      external_meter_id?: string | string[] | null;
      page?: number;
      limit?: number;
      sorting?: CustomerMeterSortProperty[] | null;
    },
    requestOptions?: RequestOptions,
  ): AsyncGenerator<CustomerMeter> {
    let page: number;
    page = query?.page ?? 1;
    let limit: number | undefined;
    limit = query?.limit;

    while (true) {
      const response = await listCustomerMeters(client)({ ...query, page, limit }, requestOptions);
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
   * @param requestOptions - Request options
   * @returns {CustomerMeter}
   * @throws {PolarNetworkError} When a network error occurs
   * @throws {PolarRateLimitError} When the rate limit is exceeded
   * @throws {PolarServerError} When the server returns a 5xx error
   * @throws {ResourceNotFound} Customer meter not found.
   * @throws {HTTPValidationError} Validation Error
   */
  return async (id: string, requestOptions?: RequestOptions): Promise<CustomerMeter> => {
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
    const response = await client.sendRequest(request, requestOptions);
    return client.parseResponse<CustomerMeter>(response, "json", {
      404: ResourceNotFound,
      422: HTTPValidationError,
    });
  };
};
export const creditsCustomerMeters = (client: ClientBase) => {
  /**
   * Manually grant credits on a customer meter.
   *
   * Returns the `meter.credited` event. The customer meter balance is updated
   * before the response is returned, unless the meter is being updated
   * concurrently, in which case it catches up shortly after.
   *
   * **Scopes**: `customers:write`
   *
   * @param body - Request body
   * @param requestOptions - Request options
   * @returns {MeterCreditEvent}
   * @throws {PolarNetworkError} When a network error occurs
   * @throws {PolarRateLimitError} When the rate limit is exceeded
   * @throws {PolarServerError} When the server returns a 5xx error
   * @throws {NotPermitted} You don't have permission to manage customers.
   * @throws {CustomerMetersCredits409Error} The external_id is already used by a different event, or the external customer ID matches customers in several accessible organizations.
   * @throws {HTTPValidationError} Validation Error
   */
  return async (
    body: CustomerMeterCreditsIDCreate | CustomerMeterCreditsExternalIDCreate,
    requestOptions?: RequestOptions,
  ): Promise<MeterCreditEvent> => {
    const pathParams = {};
    const queryParams = {};
    const request = client.buildRequest(
      "POST",
      "/v1/customer-meters/credits",
      pathParams,
      queryParams,
      body,
    );
    const response = await client.sendRequest(request, requestOptions);
    return client.parseResponse<MeterCreditEvent>(response, "json", {
      403: NotPermitted,
      409: CustomerMetersCredits409Error,
      422: HTTPValidationError,
    });
  };
};
export const reverseCreditCustomerMeters = (client: ClientBase) => {
  /**
   * Reverse a manual credit, removing the units the customer hasn't used yet.
   *
   * Works once per credit, within 7 days and in the current billing period.
   * Returns a `meter.credited` event with negative units and
   * `parent_id` set to the reversed credit.
   *
   * **Scopes**: `customers:write`
   *
   * @param id - The ID of the `meter.credited` event returned when the credit was granted.
   * @param requestOptions - Request options
   * @returns {MeterCreditEvent}
   * @throws {PolarNetworkError} When a network error occurs
   * @throws {PolarRateLimitError} When the rate limit is exceeded
   * @throws {PolarServerError} When the server returns a 5xx error
   * @throws {NotPermitted} You don't have permission to manage customers.
   * @throws {ResourceNotFound} Manual credit not found.
   * @throws {CustomerMeterCreditNotReversible} The credit can't be reversed, or the customer meter is being updated: retry shortly.
   * @throws {HTTPValidationError} Validation Error
   */
  return async (id: string, requestOptions?: RequestOptions): Promise<MeterCreditEvent> => {
    const pathParams = {
      id: id,
    };
    const queryParams = {};
    const request = client.buildRequest(
      "POST",
      "/v1/customer-meters/credits/{id}/reverse",
      pathParams,
      queryParams,
      undefined,
    );
    const response = await client.sendRequest(request, requestOptions);
    return client.parseResponse<MeterCreditEvent>(response, "json", {
      403: NotPermitted,
      404: ResourceNotFound,
      409: CustomerMeterCreditNotReversible,
      422: HTTPValidationError,
    });
  };
};

export function createCustomerMetersService(client: ClientBase) {
  return {
    list: listCustomerMeters(client),
    get: getCustomerMeters(client),
    credits: creditsCustomerMeters(client),
    reverseCredit: reverseCreditCustomerMeters(client),
    iterList: iterListCustomerMeters(client),
  };
}

export type CustomerMeters = ReturnType<typeof createCustomerMetersService>;
