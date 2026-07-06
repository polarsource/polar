import type { ClientBase } from "../base";
import type { DiscountCreate, DiscountUpdate } from "../models/inputs";
import type { DiscountSortProperty } from "../models/literals";
import type { Discount, ListResourceDiscount } from "../models/outputs";

import { HTTPValidationError, ResourceNotFound } from "../errors";

export const listDiscounts = (client: ClientBase) => {
  /**
   * List discounts.
   *
   * **Scopes**: `discounts:read` `discounts:write`
   *
   * @param query - Query parameters
   * @returns {ListResourceDiscount}
   * @throws {PolarNetworkError} When a network error occurs
   * @throws {PolarServerError} When the server returns a 5xx error
   * @throws {HTTPValidationError} Validation Error
   */
  return async (query?: {
    organization_id?: string | string[] | null;
    query?: string | null;
    page?: number;
    limit?: number;
    sorting?: DiscountSortProperty[] | null;
  }): Promise<ListResourceDiscount> => {
    const pathParams = {};
    const queryParams = {
      organization_id: query?.organization_id,
      query: query?.query,
      page: query?.page ?? 1,
      limit: query?.limit ?? 10,
      sorting: query?.sorting ?? ["-created_at"],
    };
    const request = client.buildRequest(
      "GET",
      "/v1/discounts/",
      pathParams,
      queryParams,
      undefined,
    );
    const response = await client.sendRequest(request);
    return client.parseResponse<ListResourceDiscount>(response, "json", {
      422: HTTPValidationError,
    });
  };
};
/**
 * List discounts.
 *
 * **Scopes**: `discounts:read` `discounts:write`
 *
 * @param query - Query parameters
 * @returns {AsyncGenerator<Discount>} A generator that yields items of type Discount.
 * @throws {PolarNetworkError} When a network error occurs
 * @throws {PolarServerError} When the server returns a 5xx error
 * @throws {HTTPValidationError} Validation Error
 */
export const iterlistDiscounts = (client: ClientBase) => {
  return async function* (query?: {
    organization_id?: string | string[] | null;
    query?: string | null;
    page?: number;
    limit?: number;
    sorting?: DiscountSortProperty[] | null;
  }): AsyncGenerator<Discount> {
    let page: number;
    page = query?.page ?? 1;
    let limit: number | undefined;
    limit = query?.limit;

    while (true) {
      const response = await listDiscounts(client)({ ...query, page, limit });
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
export const createDiscounts = (client: ClientBase) => {
  /**
   * Create a discount.
   *
   * **Scopes**: `discounts:write`
   *
   * @param body - Request body
   * @returns {Discount}
   * @throws {PolarNetworkError} When a network error occurs
   * @throws {PolarServerError} When the server returns a 5xx error
   * @throws {HTTPValidationError} Validation Error
   */
  return async (body: DiscountCreate): Promise<Discount> => {
    const pathParams = {};
    const queryParams = {};
    const request = client.buildRequest("POST", "/v1/discounts/", pathParams, queryParams, body);
    const response = await client.sendRequest(request);
    return client.parseResponse<Discount>(response, "json", {
      422: HTTPValidationError,
    });
  };
};
export const getDiscounts = (client: ClientBase) => {
  /**
   * Get a discount by ID.
   *
   * **Scopes**: `discounts:read` `discounts:write`
   *
   * @param id - The discount ID.
   * @returns {Discount}
   * @throws {PolarNetworkError} When a network error occurs
   * @throws {PolarServerError} When the server returns a 5xx error
   * @throws {ResourceNotFound} Discount not found.
   * @throws {HTTPValidationError} Validation Error
   */
  return async (id: string): Promise<Discount> => {
    const pathParams = {
      id: id,
    };
    const queryParams = {};
    const request = client.buildRequest(
      "GET",
      "/v1/discounts/{id}",
      pathParams,
      queryParams,
      undefined,
    );
    const response = await client.sendRequest(request);
    return client.parseResponse<Discount>(response, "json", {
      404: ResourceNotFound,
      422: HTTPValidationError,
    });
  };
};
export const deleteDiscounts = (client: ClientBase) => {
  /**
   * Delete a discount.
   *
   * **Scopes**: `discounts:write`
   *
   * @param id - The discount ID.
   * @returns {void}
   * @throws {PolarNetworkError} When a network error occurs
   * @throws {PolarServerError} When the server returns a 5xx error
   * @throws {ResourceNotFound} Discount not found.
   * @throws {HTTPValidationError} Validation Error
   */
  return async (id: string): Promise<void> => {
    const pathParams = {
      id: id,
    };
    const queryParams = {};
    const request = client.buildRequest(
      "DELETE",
      "/v1/discounts/{id}",
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
export const updateDiscounts = (client: ClientBase) => {
  /**
   * Update a discount.
   *
   * **Scopes**: `discounts:write`
   *
   * @param id - The discount ID.
   * @param body - Request body
   * @returns {Discount}
   * @throws {PolarNetworkError} When a network error occurs
   * @throws {PolarServerError} When the server returns a 5xx error
   * @throws {ResourceNotFound} Discount not found.
   * @throws {HTTPValidationError} Validation Error
   */
  return async (id: string, body: DiscountUpdate): Promise<Discount> => {
    const pathParams = {
      id: id,
    };
    const queryParams = {};
    const request = client.buildRequest(
      "PATCH",
      "/v1/discounts/{id}",
      pathParams,
      queryParams,
      body,
    );
    const response = await client.sendRequest(request);
    return client.parseResponse<Discount>(response, "json", {
      404: ResourceNotFound,
      422: HTTPValidationError,
    });
  };
};

export function createDiscountsService(client: ClientBase) {
  return {
    list: listDiscounts(client),
    create: createDiscounts(client),
    get: getDiscounts(client),
    delete: deleteDiscounts(client),
    update: updateDiscounts(client),
    iterlist: iterlistDiscounts(client),
  };
}

export type Discounts = ReturnType<typeof createDiscountsService>;
