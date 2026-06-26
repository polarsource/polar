import { ClientBase } from "../base";
import type {
  CheckoutConfirmStripe,
  CheckoutCreate,
  CheckoutUpdate,
  CheckoutUpdatePublic,
} from "../models/inputs";
import type {
  Checkout,
  CheckoutPublic,
  CheckoutPublicConfirmed,
  ListResourceCheckout,
} from "../models/outputs";
import type { CheckoutSortProperty, CheckoutStatus } from "../models/literals";
import {
  ClientConfirm403Error,
  ClientUpdate403Error,
  ExpiredCheckoutError,
  HTTPValidationError,
  PaymentError,
  ResourceNotFound,
  Update403Error,
} from "../errors";

export const listCheckouts = (client: ClientBase) => {
  /**
   * List checkout sessions.
   *
   * **Scopes**: `checkouts:read` `checkouts:write`
   *
   * @param query - Query parameters
   * @returns {ListResourceCheckout}
   * @throws {PolarNetworkError} When a network error occurs
   * @throws {PolarServerError} When the server returns a 5xx error
   * @throws {HTTPValidationError} Validation Error
   */
  return async (query?: {
    organization_id?: string | string[] | null;
    product_id?: string | string[] | null;
    customer_id?: string | string[] | null;
    external_customer_id?: string | string[] | null;
    status?: CheckoutStatus | CheckoutStatus[] | null;
    query?: string | null;
    page?: number;
    limit?: number;
    sorting?: CheckoutSortProperty[] | null;
  }): Promise<ListResourceCheckout> => {
    const pathParams = {};
    const queryParams = {
      organization_id: query?.organization_id,
      product_id: query?.product_id,
      customer_id: query?.customer_id,
      external_customer_id: query?.external_customer_id,
      status: query?.status,
      query: query?.query,
      page: query?.page || 1,
      limit: query?.limit || 10,
      sorting: query?.sorting || ["-created_at"],
    };
    const request = client.buildRequest(
      "GET",
      "/v1/checkouts/",
      pathParams,
      queryParams,
      undefined,
    );
    const response = await client.sendRequest(request);
    return client.parseResponse<ListResourceCheckout>(response, "json", {
      422: HTTPValidationError,
    });
  };
};
export const createCheckouts = (client: ClientBase) => {
  /**
   * Create a checkout session.
   *
   * **Scopes**: `checkouts:write`
   *
   * @param body - Request body* @returns {Checkout}
   * @throws {PolarNetworkError} When a network error occurs
   * @throws {PolarServerError} When the server returns a 5xx error
   * @throws {HTTPValidationError} Validation Error
   */
  return async (body?: CheckoutCreate): Promise<Checkout> => {
    const pathParams = {};
    const queryParams = {};
    const request = client.buildRequest("POST", "/v1/checkouts/", pathParams, queryParams, body);
    const response = await client.sendRequest(request);
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
   * @returns {Checkout}
   * @throws {PolarNetworkError} When a network error occurs
   * @throws {PolarServerError} When the server returns a 5xx error
   * @throws {ResourceNotFound} Checkout session not found.
   * @throws {HTTPValidationError} Validation Error
   */
  return async (id: string): Promise<Checkout> => {
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
    const response = await client.sendRequest(request);
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
   * @param body - Request body* @returns {Checkout}
   * @throws {PolarNetworkError} When a network error occurs
   * @throws {PolarServerError} When the server returns a 5xx error
   * @throws {Update403Error} The checkout is expired, the customer already has an active subscription, or the organization is not ready to accept payments.
   * @throws {ResourceNotFound} Checkout session not found.
   * @throws {HTTPValidationError} Validation Error
   */
  return async (id: string, body?: CheckoutUpdate): Promise<Checkout> => {
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
    const response = await client.sendRequest(request);
    return client.parseResponse<Checkout>(response, "json", {
      403: Update403Error,
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
   * @returns {CheckoutPublic}
   * @throws {PolarNetworkError} When a network error occurs
   * @throws {PolarServerError} When the server returns a 5xx error
   * @throws {ResourceNotFound} Checkout session not found.
   * @throws {ExpiredCheckoutError} The checkout session is expired.
   * @throws {HTTPValidationError} Validation Error
   */
  return async (client_secret: string): Promise<CheckoutPublic> => {
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
    const response = await client.sendRequest(request);
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
   * @param body - Request body* @returns {CheckoutPublic}
   * @throws {PolarNetworkError} When a network error occurs
   * @throws {PolarServerError} When the server returns a 5xx error
   * @throws {ClientUpdate403Error} The checkout is expired, the customer already has an active subscription, or the organization is not ready to accept payments.
   * @throws {ResourceNotFound} Checkout session not found.
   * @throws {ExpiredCheckoutError} The checkout session is expired.
   * @throws {HTTPValidationError} Validation Error
   */
  return async (client_secret: string, body?: CheckoutUpdatePublic): Promise<CheckoutPublic> => {
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
    const response = await client.sendRequest(request);
    return client.parseResponse<CheckoutPublic>(response, "json", {
      403: ClientUpdate403Error,
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
   * @param body - Request body* @returns {CheckoutPublicConfirmed}
   * @throws {PolarNetworkError} When a network error occurs
   * @throws {PolarServerError} When the server returns a 5xx error
   * @throws {PaymentError} The payment failed.
   * @throws {ClientConfirm403Error} The checkout is expired, the customer already has an active subscription, or the organization is not ready to accept payments.
   * @throws {ResourceNotFound} Checkout session not found.
   * @throws {ExpiredCheckoutError} The checkout session is expired.
   * @throws {HTTPValidationError} Validation Error
   */
  return async (
    client_secret: string,
    body?: CheckoutConfirmStripe,
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
    const response = await client.sendRequest(request);
    return client.parseResponse<CheckoutPublicConfirmed>(response, "json", {
      400: PaymentError,
      403: ClientConfirm403Error,
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
  };
}

export type Checkouts = ReturnType<typeof createCheckoutsService>;
