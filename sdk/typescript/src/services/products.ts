import { ClientBase } from "../base";
import type {
  MetadataQuery,
  ProductBenefitsUpdate,
  ProductCreate,
  ProductUpdate,
} from "../models/inputs";
import type { ListResourceProduct, Product } from "../models/outputs";
import type { ProductSortProperty, ProductVisibility } from "../models/literals";
import { HTTPValidationError, NotPermitted, ResourceNotFound } from "../errors";

export const listProducts = (client: ClientBase) => {
  /**
   * List products.
   *
   * **Scopes**: `products:read` `products:write`
   *
   * @param query - Query parameters
   * @returns {ListResourceProduct}
   * @throws {PolarNetworkError} When a network error occurs
   * @throws {PolarServerError} When the server returns a 5xx error
   * @throws {HTTPValidationError} Validation Error
   */
  return async (query?: {
    id?: string | string[] | null;
    organization_id?: string | string[] | null;
    query?: string | null;
    is_archived?: boolean | null;
    is_recurring?: boolean | null;
    benefit_id?: string | string[] | null;
    visibility?: ProductVisibility[] | null;
    page?: number;
    limit?: number;
    sorting?: ProductSortProperty[] | null;
    metadata?: MetadataQuery;
  }): Promise<ListResourceProduct> => {
    const pathParams = {};
    const queryParams = {
      id: query?.id,
      organization_id: query?.organization_id,
      query: query?.query,
      is_archived: query?.is_archived,
      is_recurring: query?.is_recurring,
      benefit_id: query?.benefit_id,
      visibility: query?.visibility,
      page: query?.page ?? 1,
      limit: query?.limit ?? 10,
      sorting: query?.sorting ?? ["-created_at"],
      metadata: query?.metadata,
    };
    const request = client.buildRequest("GET", "/v1/products/", pathParams, queryParams, undefined);
    const response = await client.sendRequest(request);
    return client.parseResponse<ListResourceProduct>(response, "json", {
      422: HTTPValidationError,
    });
  };
};
/**
 * List products.
 *
 * **Scopes**: `products:read` `products:write`
 *
 * @param query - Query parameters
 * @returns {AsyncGenerator<Product>} A generator that yields items of type Product.
 * @throws {PolarNetworkError} When a network error occurs
 * @throws {PolarServerError} When the server returns a 5xx error
 * @throws {HTTPValidationError} Validation Error
 */
export const iterlistProducts = (client: ClientBase) => {
  return async function* (query?: {
    id?: string | string[] | null;
    organization_id?: string | string[] | null;
    query?: string | null;
    is_archived?: boolean | null;
    is_recurring?: boolean | null;
    benefit_id?: string | string[] | null;
    visibility?: ProductVisibility[] | null;
    page?: number;
    limit?: number;
    sorting?: ProductSortProperty[] | null;
    metadata?: MetadataQuery;
  }): AsyncGenerator<Product> {
    let page: number;
    page = query?.page ?? 1;
    let limit: number | undefined;
    limit = query?.limit;

    while (true) {
      const response = await listProducts(client)({ ...query, page, limit });
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
export const createProducts = (client: ClientBase) => {
  /**
   * Create a product.
   *
   * **Scopes**: `products:write`
   *
   * @param body - Request body
   * @returns {Product}
   * @throws {PolarNetworkError} When a network error occurs
   * @throws {PolarServerError} When the server returns a 5xx error
   * @throws {HTTPValidationError} Validation Error
   */
  return async (body: ProductCreate): Promise<Product> => {
    const pathParams = {};
    const queryParams = {};
    const request = client.buildRequest("POST", "/v1/products/", pathParams, queryParams, body);
    const response = await client.sendRequest(request);
    return client.parseResponse<Product>(response, "json", {
      422: HTTPValidationError,
    });
  };
};
export const getProducts = (client: ClientBase) => {
  /**
   * Get a product by ID.
   *
   * **Scopes**: `products:read` `products:write`
   *
   * @param id
   * @returns {Product}
   * @throws {PolarNetworkError} When a network error occurs
   * @throws {PolarServerError} When the server returns a 5xx error
   * @throws {ResourceNotFound} Product not found.
   * @throws {HTTPValidationError} Validation Error
   */
  return async (id: string): Promise<Product> => {
    const pathParams = {
      id: id,
    };
    const queryParams = {};
    const request = client.buildRequest(
      "GET",
      "/v1/products/{id}",
      pathParams,
      queryParams,
      undefined,
    );
    const response = await client.sendRequest(request);
    return client.parseResponse<Product>(response, "json", {
      404: ResourceNotFound,
      422: HTTPValidationError,
    });
  };
};
export const updateProducts = (client: ClientBase) => {
  /**
   * Update a product.
   *
   * **Scopes**: `products:write`
   *
   * @param id
   * @param body - Request body
   * @returns {Product}
   * @throws {PolarNetworkError} When a network error occurs
   * @throws {PolarServerError} When the server returns a 5xx error
   * @throws {NotPermitted} You don't have the permission to update this product.
   * @throws {ResourceNotFound} Product not found.
   * @throws {HTTPValidationError} Validation Error
   */
  return async (id: string, body: ProductUpdate): Promise<Product> => {
    const pathParams = {
      id: id,
    };
    const queryParams = {};
    const request = client.buildRequest(
      "PATCH",
      "/v1/products/{id}",
      pathParams,
      queryParams,
      body,
    );
    const response = await client.sendRequest(request);
    return client.parseResponse<Product>(response, "json", {
      403: NotPermitted,
      404: ResourceNotFound,
      422: HTTPValidationError,
    });
  };
};
export const updateBenefitsProducts = (client: ClientBase) => {
  /**
   * Update benefits granted by a product.
   *
   * **Scopes**: `products:write`
   *
   * @param id
   * @param body - Request body
   * @returns {Product}
   * @throws {PolarNetworkError} When a network error occurs
   * @throws {PolarServerError} When the server returns a 5xx error
   * @throws {NotPermitted} You don't have the permission to update this product.
   * @throws {ResourceNotFound} Product not found.
   * @throws {HTTPValidationError} Validation Error
   */
  return async (id: string, body: ProductBenefitsUpdate): Promise<Product> => {
    const pathParams = {
      id: id,
    };
    const queryParams = {};
    const request = client.buildRequest(
      "POST",
      "/v1/products/{id}/benefits",
      pathParams,
      queryParams,
      body,
    );
    const response = await client.sendRequest(request);
    return client.parseResponse<Product>(response, "json", {
      403: NotPermitted,
      404: ResourceNotFound,
      422: HTTPValidationError,
    });
  };
};

export function createProductsService(client: ClientBase) {
  return {
    list: listProducts(client),
    create: createProducts(client),
    get: getProducts(client),
    update: updateProducts(client),
    updateBenefits: updateBenefitsProducts(client),
    iterlist: iterlistProducts(client),
  };
}

export type Products = ReturnType<typeof createProductsService>;
