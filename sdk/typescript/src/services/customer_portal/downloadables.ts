import { ClientBase } from "../../base";
import type { ListResourceDownloadableRead } from "../../models/outputs";
import { HTTPValidationError } from "../../errors";

export const listDownloadables = (client: ClientBase) => {
  /**
   * **Scopes**: `customer_portal:read` `customer_portal:write`
   *
   * @param query - Query parameters
   * @returns {ListResourceDownloadableRead}
   * @throws {PolarNetworkError} When a network error occurs
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

export function createDownloadablesService(client: ClientBase) {
  return {
    list: listDownloadables(client),
  };
}

export type Downloadables = ReturnType<typeof createDownloadablesService>;
