import type { ClientBase } from "../base";
import type { CheckoutLinkCreate, CheckoutLinkUpdate } from "../models/inputs";
import type { CheckoutLinkSortProperty } from "../models/literals";
import type { CheckoutLink, ListResourceCheckoutLink } from "../models/outputs";

import { HTTPValidationError, ResourceNotFound } from "../errors";

export const listCheckoutLinks = (client: ClientBase) => {
  /**
   * List checkout links.
   *
   * **Scopes**: `checkout_links:read` `checkout_links:write`
   *
   * @param query - Query parameters
   * @returns {ListResourceCheckoutLink}
   * @throws {PolarNetworkError} When a network error occurs
   * @throws {PolarRateLimitError} When the rate limit is exceeded
   * @throws {PolarServerError} When the server returns a 5xx error
   * @throws {HTTPValidationError} Validation Error
   */
  return async (query?: {
    organization_id?: string | string[] | null;
    product_id?: string | string[] | null;
    page?: number;
    limit?: number;
    sorting?: CheckoutLinkSortProperty[] | null;
  }): Promise<ListResourceCheckoutLink> => {
    const pathParams = {};
    const queryParams = {
      organization_id: query?.organization_id,
      product_id: query?.product_id,
      page: query?.page ?? 1,
      limit: query?.limit ?? 10,
      sorting: query?.sorting ?? ["created_at"],
    };
    const request = client.buildRequest(
      "GET",
      "/v1/checkout-links/",
      pathParams,
      queryParams,
      undefined,
    );
    const response = await client.sendRequest(request);
    return client.parseResponse<ListResourceCheckoutLink>(response, "json", {
      422: HTTPValidationError,
    });
  };
};
/**
 * List checkout links.
 *
 * **Scopes**: `checkout_links:read` `checkout_links:write`
 *
 * @param query - Query parameters
 * @returns {AsyncGenerator<CheckoutLink>} A generator that yields items of type CheckoutLink.
 * @throws {PolarNetworkError} When a network error occurs
 * @throws {PolarRateLimitError} When the rate limit is exceeded
 * @throws {PolarServerError} When the server returns a 5xx error
 * @throws {HTTPValidationError} Validation Error
 */
export const iterlistCheckoutLinks = (client: ClientBase) => {
  return async function* (query?: {
    organization_id?: string | string[] | null;
    product_id?: string | string[] | null;
    page?: number;
    limit?: number;
    sorting?: CheckoutLinkSortProperty[] | null;
  }): AsyncGenerator<CheckoutLink> {
    let page: number;
    page = query?.page ?? 1;
    let limit: number | undefined;
    limit = query?.limit;

    while (true) {
      const response = await listCheckoutLinks(client)({ ...query, page, limit });
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
export const createCheckoutLinks = (client: ClientBase) => {
  /**
   * Create a checkout link.
   *
   * **Scopes**: `checkout_links:write`
   *
   * @param body - Request body
   * @returns {CheckoutLink}
   * @throws {PolarNetworkError} When a network error occurs
   * @throws {PolarRateLimitError} When the rate limit is exceeded
   * @throws {PolarServerError} When the server returns a 5xx error
   * @throws {HTTPValidationError} Validation Error
   */
  return async (body: CheckoutLinkCreate): Promise<CheckoutLink> => {
    const pathParams = {};
    const queryParams = {};
    const request = client.buildRequest(
      "POST",
      "/v1/checkout-links/",
      pathParams,
      queryParams,
      body,
    );
    const response = await client.sendRequest(request);
    return client.parseResponse<CheckoutLink>(response, "json", {
      422: HTTPValidationError,
    });
  };
};
export const getCheckoutLinks = (client: ClientBase) => {
  /**
   * Get a checkout link by ID.
   *
   * **Scopes**: `checkout_links:read` `checkout_links:write`
   *
   * @param id - The checkout link ID.
   * @returns {CheckoutLink}
   * @throws {PolarNetworkError} When a network error occurs
   * @throws {PolarRateLimitError} When the rate limit is exceeded
   * @throws {PolarServerError} When the server returns a 5xx error
   * @throws {ResourceNotFound} Checkout link not found.
   * @throws {HTTPValidationError} Validation Error
   */
  return async (id: string): Promise<CheckoutLink> => {
    const pathParams = {
      id: id,
    };
    const queryParams = {};
    const request = client.buildRequest(
      "GET",
      "/v1/checkout-links/{id}",
      pathParams,
      queryParams,
      undefined,
    );
    const response = await client.sendRequest(request);
    return client.parseResponse<CheckoutLink>(response, "json", {
      404: ResourceNotFound,
      422: HTTPValidationError,
    });
  };
};
export const deleteCheckoutLinks = (client: ClientBase) => {
  /**
   * Delete a checkout link.
   *
   * **Scopes**: `checkout_links:write`
   *
   * @param id - The checkout link ID.
   * @returns {void}
   * @throws {PolarNetworkError} When a network error occurs
   * @throws {PolarRateLimitError} When the rate limit is exceeded
   * @throws {PolarServerError} When the server returns a 5xx error
   * @throws {ResourceNotFound} Checkout link not found.
   * @throws {HTTPValidationError} Validation Error
   */
  return async (id: string): Promise<void> => {
    const pathParams = {
      id: id,
    };
    const queryParams = {};
    const request = client.buildRequest(
      "DELETE",
      "/v1/checkout-links/{id}",
      pathParams,
      queryParams,
      undefined,
    );
    const response = await client.sendRequest(request);
    return client.parseResponse<void>(response, "none", {
      404: ResourceNotFound,
      422: HTTPValidationError,
    });
  };
};
export const updateCheckoutLinks = (client: ClientBase) => {
  /**
   * Update a checkout link.
   *
   * **Scopes**: `checkout_links:write`
   *
   * @param id - The checkout link ID.
   * @param body - Request body
   * @returns {CheckoutLink}
   * @throws {PolarNetworkError} When a network error occurs
   * @throws {PolarRateLimitError} When the rate limit is exceeded
   * @throws {PolarServerError} When the server returns a 5xx error
   * @throws {ResourceNotFound} Checkout link not found.
   * @throws {HTTPValidationError} Validation Error
   */
  return async (id: string, body: CheckoutLinkUpdate): Promise<CheckoutLink> => {
    const pathParams = {
      id: id,
    };
    const queryParams = {};
    const request = client.buildRequest(
      "PATCH",
      "/v1/checkout-links/{id}",
      pathParams,
      queryParams,
      body,
    );
    const response = await client.sendRequest(request);
    return client.parseResponse<CheckoutLink>(response, "json", {
      404: ResourceNotFound,
      422: HTTPValidationError,
    });
  };
};

export function createCheckoutLinksService(client: ClientBase) {
  return {
    list: listCheckoutLinks(client),
    create: createCheckoutLinks(client),
    get: getCheckoutLinks(client),
    delete: deleteCheckoutLinks(client),
    update: updateCheckoutLinks(client),
    iterlist: iterlistCheckoutLinks(client),
  };
}

export type CheckoutLinks = ReturnType<typeof createCheckoutLinksService>;
