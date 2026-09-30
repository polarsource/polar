import type { ClientBase, RequestOptions } from "../../../base";
import type {
  CustomerWallet,
  CustomerWalletSortProperty,
  ListResourceCustomerWallet,
} from "../../models";

import { HTTPValidationError, ResourceNotFound } from "../../errors";

export const listWallets = (client: ClientBase) => {
  /**
   * List wallets of the authenticated customer.
   *
   * @param query - Query parameters
   * @param requestOptions - Request options
   * @returns {ListResourceCustomerWallet}
   * @throws {PolarNetworkError} When a network error occurs
   * @throws {PolarRateLimitError} When the rate limit is exceeded
   * @throws {PolarServerError} When the server returns a 5xx error
   * @throws {HTTPValidationError} Validation Error
   */
  return async (
    query?: {
      page?: number;
      limit?: number;
      sorting?: CustomerWalletSortProperty[] | null;
    },
    requestOptions?: RequestOptions,
  ): Promise<ListResourceCustomerWallet> => {
    const pathParams = {};
    const queryParams = {
      page: query?.page ?? 1,
      limit: query?.limit ?? 10,
      sorting: query?.sorting ?? ["-created_at"],
    };
    const request = client.buildRequest(
      "GET",
      "/v1/customer-portal/wallets/",
      pathParams,
      queryParams,
      undefined,
    );
    const response = await client.sendRequest(request, requestOptions);
    return client.parseResponse<ListResourceCustomerWallet>(response, "json", {
      422: HTTPValidationError,
    });
  };
};
/**
 * List wallets of the authenticated customer.
 *
 * @param query - Query parameters
 * @param requestOptions - Request options
 * @returns {AsyncGenerator<CustomerWallet>} A generator that yields items of type CustomerWallet.
 * @throws {PolarNetworkError} When a network error occurs
 * @throws {PolarRateLimitError} When the rate limit is exceeded
 * @throws {PolarServerError} When the server returns a 5xx error
 * @throws {HTTPValidationError} Validation Error
 */
export const iterListWallets = (client: ClientBase) => {
  return async function* (
    query?: {
      page?: number;
      limit?: number;
      sorting?: CustomerWalletSortProperty[] | null;
    },
    requestOptions?: RequestOptions,
  ): AsyncGenerator<CustomerWallet> {
    let page: number;
    page = query?.page ?? 1;
    let limit: number | undefined;
    limit = query?.limit;

    while (true) {
      const response = await listWallets(client)({ ...query, page, limit }, requestOptions);
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
export const getWallets = (client: ClientBase) => {
  /**
   * Get a wallet by ID for the authenticated customer.
   *
   * @param id - The wallet ID.
   * @param requestOptions - Request options
   * @returns {CustomerWallet}
   * @throws {PolarNetworkError} When a network error occurs
   * @throws {PolarRateLimitError} When the rate limit is exceeded
   * @throws {PolarServerError} When the server returns a 5xx error
   * @throws {ResourceNotFound} Wallet not found.
   * @throws {HTTPValidationError} Validation Error
   */
  return async (id: string, requestOptions?: RequestOptions): Promise<CustomerWallet> => {
    const pathParams = {
      id: id,
    };
    const queryParams = {};
    const request = client.buildRequest(
      "GET",
      "/v1/customer-portal/wallets/{id}",
      pathParams,
      queryParams,
      undefined,
    );
    const response = await client.sendRequest(request, requestOptions);
    return client.parseResponse<CustomerWallet>(response, "json", {
      404: ResourceNotFound,
      422: HTTPValidationError,
    });
  };
};

export function createWalletsService(client: ClientBase) {
  return {
    list: listWallets(client),
    get: getWallets(client),
    iterList: iterListWallets(client),
  };
}

export type Wallets = ReturnType<typeof createWalletsService>;
