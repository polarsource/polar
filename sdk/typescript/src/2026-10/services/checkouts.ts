import type { ClientBase, RequestOptions } from "../../base";
import type {
  Checkout,
  CheckoutConfirmStripe,
  CheckoutCreate,
  CheckoutPublic,
  CheckoutPublicConfirmed,
  CheckoutSortProperty,
  CheckoutStatus,
  CheckoutUpdate,
  CheckoutUpdatePublic,
  ListResourceCheckout,
} from "../models";

import {
  CheckoutsClientConfirm403Error,
  CheckoutsClientUpdate403Error,
  CheckoutsUpdate403Error,
  ExpiredCheckoutError,
  HTTPValidationError,
  PaymentError,
  ResourceNotFound,
} from "../errors";

export const listCheckouts = (client: ClientBase) => {
  /**
   * List checkout sessions.
   *
   * **Scopes**: `checkouts:read` `checkouts:write`
   *
   * @param query - Query parameters
   * @param requestOptions - Request options
   * @returns {ListResourceCheckout}
   * @throws {PolarNetworkError} When a network error occurs
   * @throws {PolarRateLimitError} When the rate limit is exceeded
   * @throws {PolarServerError} When the server returns a 5xx error
   * @throws {HTTPValidationError} Validation Error
   */
  return async (
    query?: {
      organization_id?: string | string[] | null;
      product_id?: string | string[] | null;
      customer_id?: string | string[] | null;
      external_customer_id?: string | string[] | null;
      status?: CheckoutStatus | CheckoutStatus[] | null;
      query?: string | null;
      page?: number;
      limit?: number;
      sorting?: CheckoutSortProperty[] | null;
    },
    requestOptions?: RequestOptions,
  ): Promise<ListResourceCheckout> => {
    const pathParams = {};
    const queryParams = {
      organization_id: query?.organization_id,
      product_id: query?.product_id,
      customer_id: query?.customer_id,
      external_customer_id: query?.external_customer_id,
      status: query?.status,
      query: query?.query,
      page: query?.page ?? 1,
      limit: query?.limit ?? 10,
      sorting: query?.sorting ?? ["-created_at"],
    };
    const request = client.buildRequest(
      "GET",
      "/v1/checkouts/",
      pathParams,
      queryParams,
      undefined,
    );
    const response = await client.sendRequest(request, requestOptions);
    return client.parseResponse<ListResourceCheckout>(response, "json", {
      422: HTTPValidationError,
    });
  };
};
/**
 * List checkout sessions.
 *
 * **Scopes**: `checkouts:read` `checkouts:write`
 *
 * @param query - Query parameters
 * @param requestOptions - Request options
 * @returns {AsyncGenerator<Checkout>} A generator that yields items of type Checkout.
 * @throws {PolarNetworkError} When a network error occurs
 * @throws {PolarRateLimitError} When the rate limit is exceeded
 * @throws {PolarServerError} When the server returns a 5xx error
 * @throws {HTTPValidationError} Validation Error
 */
export const iterListCheckouts = (client: ClientBase) => {
  return async function* (
    query?: {
      organization_id?: string | string[] | null;
      product_id?: string | string[] | null;
      customer_id?: string | string[] | null;
      external_customer_id?: string | string[] | null;
      status?: CheckoutStatus | CheckoutStatus[] | null;
      query?: string | null;
      page?: number;
      limit?: number;
      sorting?: CheckoutSortProperty[] | null;
    },
    requestOptions?: RequestOptions,
  ): AsyncGenerator<Checkout> {
    let page: number;
    page = query?.page ?? 1;
    let limit: number | undefined;
    limit = query?.limit;

    while (true) {
      const response = await listCheckouts(client)({ ...query, page, limit }, requestOptions);
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
export const createCheckouts = (client: ClientBase) => {
  /**
   * Create a checkout session.
   *
   * **Scopes**: `checkouts:write`
   *
   * @param body - Request body
   * @param requestOptions - Request options
   * @returns {Checkout}
   * @throws {PolarNetworkError} When a network error occurs
   * @throws {PolarRateLimitError} When the rate limit is exceeded
   * @throws {PolarServerError} When the server returns a 5xx error
   * @throws {HTTPValidationError} Validation Error
   */
  return async (body: CheckoutCreate, requestOptions?: RequestOptions): Promise<Checkout> => {
    const pathParams = {};
    const queryParams = {};
    const request = client.buildRequest("POST", "/v1/checkouts/", pathParams, queryParams, body);
    const response = await client.sendRequest(request, requestOptions);
    return client.parseResponse<Checkout>(response, "json", {
      422: HTTPValidationError,
    });
  };
};
export const getCheckouts = (client: ClientBase) => {
  /**
   * Get a checkout session by ID.
   *
   * **Scopes**: `checkouts:read` `checkouts:write`
   *
   * @param id - The checkout session ID.
   * @param requestOptions - Request options
   * @returns {Checkout}
   * @throws {PolarNetworkError} When a network error occurs
   * @throws {PolarRateLimitError} When the rate limit is exceeded
   * @throws {PolarServerError} When the server returns a 5xx error
   * @throws {ResourceNotFound} Checkout session not found.
   * @throws {HTTPValidationError} Validation Error
   */
  return async (id: string, requestOptions?: RequestOptions): Promise<Checkout> => {
    const pathParams = {
      id: id,
    };
    const queryParams = {};
    const request = client.buildRequest(
      "GET",
      "/v1/checkouts/{id}",
      pathParams,
      queryParams,
      undefined,
    );
    const response = await client.sendRequest(request, requestOptions);
    return client.parseResponse<Checkout>(response, "json", {
      404: ResourceNotFound,
      422: HTTPValidationError,
    });
  };
};
export const updateCheckouts = (client: ClientBase) => {
  /**
   * Update a checkout session.
   *
   * **Scopes**: `checkouts:write`
   *
   * @param id - The checkout session ID.
   * @param body - Request body
   * @param requestOptions - Request options
   * @returns {Checkout}
   * @throws {PolarNetworkError} When a network error occurs
   * @throws {PolarRateLimitError} When the rate limit is exceeded
   * @throws {PolarServerError} When the server returns a 5xx error
   * @throws {CheckoutsUpdate403Error} The checkout is expired, the customer already has an active subscription, or the organization is not ready to accept payments.
   * @throws {ResourceNotFound} Checkout session not found.
   * @throws {HTTPValidationError} Validation Error
   */
  return async (
    id: string,
    body: CheckoutUpdate,
    requestOptions?: RequestOptions,
  ): Promise<Checkout> => {
    const pathParams = {
      id: id,
    };
    const queryParams = {};
    const request = client.buildRequest(
      "PATCH",
      "/v1/checkouts/{id}",
      pathParams,
      queryParams,
      body,
    );
    const response = await client.sendRequest(request, requestOptions);
    return client.parseResponse<Checkout>(response, "json", {
      403: CheckoutsUpdate403Error,
      404: ResourceNotFound,
      422: HTTPValidationError,
    });
  };
};
export const clientGetCheckouts = (client: ClientBase) => {
  /**
   * Get a checkout session by client secret.
   *
   * @param client_secret - The checkout session client secret.
   * @param requestOptions - Request options
   * @returns {CheckoutPublic}
   * @throws {PolarNetworkError} When a network error occurs
   * @throws {PolarRateLimitError} When the rate limit is exceeded
   * @throws {PolarServerError} When the server returns a 5xx error
   * @throws {ResourceNotFound} Checkout session not found.
   * @throws {ExpiredCheckoutError} The checkout session is expired.
   * @throws {HTTPValidationError} Validation Error
   */
  return async (
    client_secret: string,
    requestOptions?: RequestOptions,
  ): Promise<CheckoutPublic> => {
    const pathParams = {
      client_secret: client_secret,
    };
    const queryParams = {};
    const request = client.buildRequest(
      "GET",
      "/v1/checkouts/client/{client_secret}",
      pathParams,
      queryParams,
      undefined,
    );
    const response = await client.sendRequest(request, requestOptions);
    return client.parseResponse<CheckoutPublic>(response, "json", {
      404: ResourceNotFound,
      410: ExpiredCheckoutError,
      422: HTTPValidationError,
    });
  };
};
export const clientUpdateCheckouts = (client: ClientBase) => {
  /**
   * Update a checkout session by client secret.
   *
   * @param client_secret - The checkout session client secret.
   * @param body - Request body
   * @param requestOptions - Request options
   * @returns {CheckoutPublic}
   * @throws {PolarNetworkError} When a network error occurs
   * @throws {PolarRateLimitError} When the rate limit is exceeded
   * @throws {PolarServerError} When the server returns a 5xx error
   * @throws {CheckoutsClientUpdate403Error} The checkout is expired, the customer already has an active subscription, or the organization is not ready to accept payments.
   * @throws {ResourceNotFound} Checkout session not found.
   * @throws {ExpiredCheckoutError} The checkout session is expired.
   * @throws {HTTPValidationError} Validation Error
   */
  return async (
    client_secret: string,
    body: CheckoutUpdatePublic,
    requestOptions?: RequestOptions,
  ): Promise<CheckoutPublic> => {
    const pathParams = {
      client_secret: client_secret,
    };
    const queryParams = {};
    const request = client.buildRequest(
      "PATCH",
      "/v1/checkouts/client/{client_secret}",
      pathParams,
      queryParams,
      body,
    );
    const response = await client.sendRequest(request, requestOptions);
    return client.parseResponse<CheckoutPublic>(response, "json", {
      403: CheckoutsClientUpdate403Error,
      404: ResourceNotFound,
      410: ExpiredCheckoutError,
      422: HTTPValidationError,
    });
  };
};
export const clientConfirmCheckouts = (client: ClientBase) => {
  /**
   * Confirm a checkout session by client secret.
   *
   * Orders and subscriptions will be processed.
   *
   * @param client_secret - The checkout session client secret.
   * @param body - Request body
   * @param requestOptions - Request options
   * @returns {CheckoutPublicConfirmed}
   * @throws {PolarNetworkError} When a network error occurs
   * @throws {PolarRateLimitError} When the rate limit is exceeded
   * @throws {PolarServerError} When the server returns a 5xx error
   * @throws {PaymentError} The payment failed.
   * @throws {CheckoutsClientConfirm403Error} The checkout is expired, the customer already has an active subscription, or the organization is not ready to accept payments.
   * @throws {ResourceNotFound} Checkout session not found.
   * @throws {ExpiredCheckoutError} The checkout session is expired.
   * @throws {HTTPValidationError} Validation Error
   */
  return async (
    client_secret: string,
    body: CheckoutConfirmStripe,
    requestOptions?: RequestOptions,
  ): Promise<CheckoutPublicConfirmed> => {
    const pathParams = {
      client_secret: client_secret,
    };
    const queryParams = {};
    const request = client.buildRequest(
      "POST",
      "/v1/checkouts/client/{client_secret}/confirm",
      pathParams,
      queryParams,
      body,
    );
    const response = await client.sendRequest(request, requestOptions);
    return client.parseResponse<CheckoutPublicConfirmed>(response, "json", {
      400: PaymentError,
      403: CheckoutsClientConfirm403Error,
      404: ResourceNotFound,
      410: ExpiredCheckoutError,
      422: HTTPValidationError,
    });
  };
};

export function createCheckoutsService(client: ClientBase) {
  return {
    list: listCheckouts(client),
    create: createCheckouts(client),
    get: getCheckouts(client),
    update: updateCheckouts(client),
    clientGet: clientGetCheckouts(client),
    clientUpdate: clientUpdateCheckouts(client),
    clientConfirm: clientConfirmCheckouts(client),
    iterList: iterListCheckouts(client),
  };
}

export type Checkouts = ReturnType<typeof createCheckoutsService>;
