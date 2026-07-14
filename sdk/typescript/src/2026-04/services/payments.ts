import type { ClientBase } from "../../base";
import type { ListResourcePayment, Payment, PaymentSortProperty, PaymentStatus } from "../models";

import { HTTPValidationError, ResourceNotFound } from "../errors";

export const listPayments = (client: ClientBase) => {
  /**
   * List payments.
   *
   * **Scopes**: `payments:read`
   *
   * @param query - Query parameters
   * @returns {ListResourcePayment}
   * @throws {PolarNetworkError} When a network error occurs
   * @throws {PolarRateLimitError} When the rate limit is exceeded
   * @throws {PolarServerError} When the server returns a 5xx error
   * @throws {HTTPValidationError} Validation Error
   */
  return async (query?: {
    organization_id?: string | string[] | null;
    checkout_id?: string | string[] | null;
    order_id?: string | string[] | null;
    customer_id?: string | string[] | null;
    status?: PaymentStatus | PaymentStatus[] | null;
    method?: string | string[] | null;
    customer_email?: string | string[] | null;
    page?: number;
    limit?: number;
    sorting?: PaymentSortProperty[] | null;
  }): Promise<ListResourcePayment> => {
    const pathParams = {};
    const queryParams = {
      organization_id: query?.organization_id,
      checkout_id: query?.checkout_id,
      order_id: query?.order_id,
      customer_id: query?.customer_id,
      status: query?.status,
      method: query?.method,
      customer_email: query?.customer_email,
      page: query?.page ?? 1,
      limit: query?.limit ?? 10,
      sorting: query?.sorting ?? ["-created_at"],
    };
    const request = client.buildRequest("GET", "/v1/payments/", pathParams, queryParams, undefined);
    const response = await client.sendRequest(request);
    return client.parseResponse<ListResourcePayment>(response, "json", {
      422: HTTPValidationError,
    });
  };
};
/**
 * List payments.
 *
 * **Scopes**: `payments:read`
 *
 * @param query - Query parameters
 * @returns {AsyncGenerator<Payment>} A generator that yields items of type Payment.
 * @throws {PolarNetworkError} When a network error occurs
 * @throws {PolarRateLimitError} When the rate limit is exceeded
 * @throws {PolarServerError} When the server returns a 5xx error
 * @throws {HTTPValidationError} Validation Error
 */
export const iterlistPayments = (client: ClientBase) => {
  return async function* (query?: {
    organization_id?: string | string[] | null;
    checkout_id?: string | string[] | null;
    order_id?: string | string[] | null;
    customer_id?: string | string[] | null;
    status?: PaymentStatus | PaymentStatus[] | null;
    method?: string | string[] | null;
    customer_email?: string | string[] | null;
    page?: number;
    limit?: number;
    sorting?: PaymentSortProperty[] | null;
  }): AsyncGenerator<Payment> {
    let page: number;
    page = query?.page ?? 1;
    let limit: number | undefined;
    limit = query?.limit;

    while (true) {
      const response = await listPayments(client)({ ...query, page, limit });
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
export const getPayments = (client: ClientBase) => {
  /**
   * Get a payment by ID.
   *
   * **Scopes**: `payments:read`
   *
   * @param id - The payment ID.
   * @returns {Payment}
   * @throws {PolarNetworkError} When a network error occurs
   * @throws {PolarRateLimitError} When the rate limit is exceeded
   * @throws {PolarServerError} When the server returns a 5xx error
   * @throws {ResourceNotFound} Payment not found.
   * @throws {HTTPValidationError} Validation Error
   */
  return async (id: string): Promise<Payment> => {
    const pathParams = {
      id: id,
    };
    const queryParams = {};
    const request = client.buildRequest(
      "GET",
      "/v1/payments/{id}",
      pathParams,
      queryParams,
      undefined,
    );
    const response = await client.sendRequest(request);
    return client.parseResponse<Payment>(response, "json", {
      404: ResourceNotFound,
      422: HTTPValidationError,
    });
  };
};

export function createPaymentsService(client: ClientBase) {
  return {
    list: listPayments(client),
    get: getPayments(client),
    iterlist: iterlistPayments(client),
  };
}

export type Payments = ReturnType<typeof createPaymentsService>;
