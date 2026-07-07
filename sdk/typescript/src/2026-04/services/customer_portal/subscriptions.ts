import type { ClientBase } from "../../../base";
import type {
  CustomerSubscription,
  CustomerSubscriptionSortProperty,
  CustomerSubscriptionUpdate,
  ListResourceCustomerSubscription,
} from "../../models";

import {
  AlreadyCanceledSubscription,
  HTTPValidationError,
  PaymentFailed,
  ResourceNotFound,
} from "../../errors";

export const listSubscriptions = (client: ClientBase) => {
  /**
   * List subscriptions of the authenticated customer.
   *
   * **Scopes**: `customer_portal:read` `customer_portal:write`
   *
   * @param query - Query parameters
   * @returns {ListResourceCustomerSubscription}
   * @throws {PolarNetworkError} When a network error occurs
   * @throws {PolarRateLimitError} When the rate limit is exceeded
   * @throws {PolarServerError} When the server returns a 5xx error
   * @throws {HTTPValidationError} Validation Error
   */
  return async (query?: {
    product_id?: string | string[] | null;
    active?: boolean | null;
    query?: string | null;
    page?: number;
    limit?: number;
    sorting?: CustomerSubscriptionSortProperty[] | null;
  }): Promise<ListResourceCustomerSubscription> => {
    const pathParams = {};
    const queryParams = {
      product_id: query?.product_id,
      active: query?.active,
      query: query?.query,
      page: query?.page ?? 1,
      limit: query?.limit ?? 10,
      sorting: query?.sorting ?? ["-started_at"],
    };
    const request = client.buildRequest(
      "GET",
      "/v1/customer-portal/subscriptions/",
      pathParams,
      queryParams,
      undefined,
    );
    const response = await client.sendRequest(request);
    return client.parseResponse<ListResourceCustomerSubscription>(response, "json", {
      422: HTTPValidationError,
    });
  };
};
/**
 * List subscriptions of the authenticated customer.
 *
 * **Scopes**: `customer_portal:read` `customer_portal:write`
 *
 * @param query - Query parameters
 * @returns {AsyncGenerator<CustomerSubscription>} A generator that yields items of type CustomerSubscription.
 * @throws {PolarNetworkError} When a network error occurs
 * @throws {PolarRateLimitError} When the rate limit is exceeded
 * @throws {PolarServerError} When the server returns a 5xx error
 * @throws {HTTPValidationError} Validation Error
 */
export const iterlistSubscriptions = (client: ClientBase) => {
  return async function* (query?: {
    product_id?: string | string[] | null;
    active?: boolean | null;
    query?: string | null;
    page?: number;
    limit?: number;
    sorting?: CustomerSubscriptionSortProperty[] | null;
  }): AsyncGenerator<CustomerSubscription> {
    let page: number;
    page = query?.page ?? 1;
    let limit: number | undefined;
    limit = query?.limit;

    while (true) {
      const response = await listSubscriptions(client)({ ...query, page, limit });
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
export const getSubscriptions = (client: ClientBase) => {
  /**
   * Get a subscription for the authenticated customer.
   *
   * **Scopes**: `customer_portal:read` `customer_portal:write`
   *
   * @param id - The subscription ID.
   * @returns {CustomerSubscription}
   * @throws {PolarNetworkError} When a network error occurs
   * @throws {PolarRateLimitError} When the rate limit is exceeded
   * @throws {PolarServerError} When the server returns a 5xx error
   * @throws {ResourceNotFound} Customer subscription was not found.
   * @throws {HTTPValidationError} Validation Error
   */
  return async (id: string): Promise<CustomerSubscription> => {
    const pathParams = {
      id: id,
    };
    const queryParams = {};
    const request = client.buildRequest(
      "GET",
      "/v1/customer-portal/subscriptions/{id}",
      pathParams,
      queryParams,
      undefined,
    );
    const response = await client.sendRequest(request);
    return client.parseResponse<CustomerSubscription>(response, "json", {
      404: ResourceNotFound,
      422: HTTPValidationError,
    });
  };
};
export const cancelSubscriptions = (client: ClientBase) => {
  /**
   * Cancel a subscription of the authenticated customer.
   *
   * @param id - The subscription ID.
   * @returns {CustomerSubscription}
   * @throws {PolarNetworkError} When a network error occurs
   * @throws {PolarRateLimitError} When the rate limit is exceeded
   * @throws {PolarServerError} When the server returns a 5xx error
   * @throws {AlreadyCanceledSubscription} Customer subscription is already canceled or will be at the end of the period, or the user lacks billing permissions.
   * @throws {ResourceNotFound} Customer subscription was not found.
   * @throws {HTTPValidationError} Validation Error
   */
  return async (id: string): Promise<CustomerSubscription> => {
    const pathParams = {
      id: id,
    };
    const queryParams = {};
    const request = client.buildRequest(
      "DELETE",
      "/v1/customer-portal/subscriptions/{id}",
      pathParams,
      queryParams,
      undefined,
    );
    const response = await client.sendRequest(request);
    return client.parseResponse<CustomerSubscription>(response, "json", {
      403: AlreadyCanceledSubscription,
      404: ResourceNotFound,
      422: HTTPValidationError,
    });
  };
};
export const updateSubscriptions = (client: ClientBase) => {
  /**
   * Update a subscription of the authenticated customer.
   *
   * @param id - The subscription ID.
   * @param body - Request body
   * @returns {CustomerSubscription}
   * @throws {PolarNetworkError} When a network error occurs
   * @throws {PolarRateLimitError} When the rate limit is exceeded
   * @throws {PolarServerError} When the server returns a 5xx error
   * @throws {PaymentFailed} Payment required to apply the subscription update.
   * @throws {AlreadyCanceledSubscription} Customer subscription is already canceled or will be at the end of the period, or the user lacks billing permissions.
   * @throws {ResourceNotFound} Customer subscription was not found.
   * @throws {HTTPValidationError} Validation Error
   */
  return async (id: string, body: CustomerSubscriptionUpdate): Promise<CustomerSubscription> => {
    const pathParams = {
      id: id,
    };
    const queryParams = {};
    const request = client.buildRequest(
      "PATCH",
      "/v1/customer-portal/subscriptions/{id}",
      pathParams,
      queryParams,
      body,
    );
    const response = await client.sendRequest(request);
    return client.parseResponse<CustomerSubscription>(response, "json", {
      402: PaymentFailed,
      403: AlreadyCanceledSubscription,
      404: ResourceNotFound,
      422: HTTPValidationError,
    });
  };
};

export function createSubscriptionsService(client: ClientBase) {
  return {
    list: listSubscriptions(client),
    get: getSubscriptions(client),
    cancel: cancelSubscriptions(client),
    update: updateSubscriptions(client),
    iterlist: iterlistSubscriptions(client),
  };
}

export type Subscriptions = ReturnType<typeof createSubscriptionsService>;
