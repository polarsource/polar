import type { ClientBase } from "../../base";
import type { ListResourceRefund, Refund, RefundCreate, RefundSortProperty } from "../models";

import { HTTPValidationError, RefundedAlready } from "../errors";

export const listRefunds = (client: ClientBase) => {
  /**
   * List refunds.
   *
   * **Scopes**: `refunds:read` `refunds:write`
   *
   * @param query - Query parameters
   * @returns {ListResourceRefund}
   * @throws {PolarNetworkError} When a network error occurs
   * @throws {PolarRateLimitError} When the rate limit is exceeded
   * @throws {PolarServerError} When the server returns a 5xx error
   * @throws {HTTPValidationError} Validation Error
   */
  return async (query?: {
    id?: string | string[] | null;
    organization_id?: string | string[] | null;
    order_id?: string | string[] | null;
    subscription_id?: string | string[] | null;
    customer_id?: string | string[] | null;
    external_customer_id?: string | string[] | null;
    succeeded?: boolean | null;
    page?: number;
    limit?: number;
    sorting?: RefundSortProperty[] | null;
  }): Promise<ListResourceRefund> => {
    const pathParams = {};
    const queryParams = {
      id: query?.id,
      organization_id: query?.organization_id,
      order_id: query?.order_id,
      subscription_id: query?.subscription_id,
      customer_id: query?.customer_id,
      external_customer_id: query?.external_customer_id,
      succeeded: query?.succeeded,
      page: query?.page ?? 1,
      limit: query?.limit ?? 10,
      sorting: query?.sorting ?? ["-created_at"],
    };
    const request = client.buildRequest("GET", "/v1/refunds/", pathParams, queryParams, undefined);
    const response = await client.sendRequest(request);
    return client.parseResponse<ListResourceRefund>(response, "json", {
      422: HTTPValidationError,
    });
  };
};
/**
 * List refunds.
 *
 * **Scopes**: `refunds:read` `refunds:write`
 *
 * @param query - Query parameters
 * @returns {AsyncGenerator<Refund>} A generator that yields items of type Refund.
 * @throws {PolarNetworkError} When a network error occurs
 * @throws {PolarRateLimitError} When the rate limit is exceeded
 * @throws {PolarServerError} When the server returns a 5xx error
 * @throws {HTTPValidationError} Validation Error
 */
export const iterListRefunds = (client: ClientBase) => {
  return async function* (query?: {
    id?: string | string[] | null;
    organization_id?: string | string[] | null;
    order_id?: string | string[] | null;
    subscription_id?: string | string[] | null;
    customer_id?: string | string[] | null;
    external_customer_id?: string | string[] | null;
    succeeded?: boolean | null;
    page?: number;
    limit?: number;
    sorting?: RefundSortProperty[] | null;
  }): AsyncGenerator<Refund> {
    let page: number;
    page = query?.page ?? 1;
    let limit: number | undefined;
    limit = query?.limit;

    while (true) {
      const response = await listRefunds(client)({ ...query, page, limit });
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
export const createRefunds = (client: ClientBase) => {
  /**
   * Create a refund.
   *
   * **Scopes**: `refunds:write`
   *
   * @param body - Request body
   * @returns {Refund}
   * @throws {PolarNetworkError} When a network error occurs
   * @throws {PolarRateLimitError} When the rate limit is exceeded
   * @throws {PolarServerError} When the server returns a 5xx error
   * @throws {RefundedAlready} Order is already fully refunded.
   * @throws {HTTPValidationError} Validation Error
   */
  return async (body: RefundCreate): Promise<Refund> => {
    const pathParams = {};
    const queryParams = {};
    const request = client.buildRequest("POST", "/v1/refunds/", pathParams, queryParams, body);
    const response = await client.sendRequest(request);
    return client.parseResponse<Refund>(response, "json", {
      403: RefundedAlready,
      422: HTTPValidationError,
    });
  };
};

export function createRefundsService(client: ClientBase) {
  return {
    list: listRefunds(client),
    create: createRefunds(client),
    iterList: iterListRefunds(client),
  };
}

export type Refunds = ReturnType<typeof createRefundsService>;
