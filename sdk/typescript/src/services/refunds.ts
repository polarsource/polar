import { ClientBase } from "../base";
import type { RefundCreate } from "../models/inputs";
import type { ListResourceRefund, Refund } from "../models/outputs";
import type { RefundSortProperty } from "../models/literals";
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
      page: query?.page || 1,
      limit: query?.limit || 10,
      sorting: query?.sorting || ["-created_at"],
    };
    const request = client.buildRequest("GET", "/v1/refunds/", pathParams, queryParams, undefined);
    const response = await client.sendRequest(request);
    return client.parseResponse<ListResourceRefund>(response, "json", {
      422: HTTPValidationError,
    });
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
  };
}

export type Refunds = ReturnType<typeof createRefundsService>;
