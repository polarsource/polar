import type { ClientBase } from "../../../base";
import type { DownloadableRead, ListResourceDownloadableRead } from "../../models";

import { HTTPValidationError } from "../../errors";

export const listDownloadables = (client: ClientBase) => {
  /**
   * **Scopes**: `customer_portal:read` `customer_portal:write`
   *
   * @param query - Query parameters
   * @returns {ListResourceDownloadableRead}
   * @throws {PolarNetworkError} When a network error occurs
   * @throws {PolarRateLimitError} When the rate limit is exceeded
   * @throws {PolarServerError} When the server returns a 5xx error
   * @throws {HTTPValidationError} Validation Error
   */
  return async (query?: {
    benefit_id?: string | string[] | null;
    page?: number;
    limit?: number;
  }): Promise<ListResourceDownloadableRead> => {
    const pathParams = {};
    const queryParams = {
      benefit_id: query?.benefit_id,
      page: query?.page ?? 1,
      limit: query?.limit ?? 10,
    };
    const request = client.buildRequest(
      "GET",
      "/v1/customer-portal/downloadables/",
      pathParams,
      queryParams,
      undefined,
    );
    const response = await client.sendRequest(request);
    return client.parseResponse<ListResourceDownloadableRead>(response, "json", {
      422: HTTPValidationError,
    });
  };
};
/**
 * **Scopes**: `customer_portal:read` `customer_portal:write`
 *
 * @param query - Query parameters
 * @returns {AsyncGenerator<DownloadableRead>} A generator that yields items of type DownloadableRead.
 * @throws {PolarNetworkError} When a network error occurs
 * @throws {PolarRateLimitError} When the rate limit is exceeded
 * @throws {PolarServerError} When the server returns a 5xx error
 * @throws {HTTPValidationError} Validation Error
 */
export const iterlistDownloadables = (client: ClientBase) => {
  return async function* (query?: {
    benefit_id?: string | string[] | null;
    page?: number;
    limit?: number;
  }): AsyncGenerator<DownloadableRead> {
    let page: number;
    page = query?.page ?? 1;
    let limit: number | undefined;
    limit = query?.limit;

    while (true) {
      const response = await listDownloadables(client)({ ...query, page, limit });
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

export function createDownloadablesService(client: ClientBase) {
  return {
    list: listDownloadables(client),
    iterlist: iterlistDownloadables(client),
  };
}

export type Downloadables = ReturnType<typeof createDownloadablesService>;
