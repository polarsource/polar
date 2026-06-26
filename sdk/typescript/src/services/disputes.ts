import { ClientBase } from "../base";
import type { Dispute, ListResourceDispute } from "../models/outputs";
import type { DisputeSortProperty, DisputeStatus } from "../models/literals";
import { HTTPValidationError, ResourceNotFound } from "../errors";

export const listDisputes = (client: ClientBase) => {
  /**
   * List disputes.
   *
   * **Scopes**: `disputes:read`
   *
   * @param query - Query parameters
   * @returns {ListResourceDispute}
   * @throws {PolarNetworkError} When a network error occurs
   * @throws {PolarServerError} When the server returns a 5xx error
   * @throws {HTTPValidationError} Validation Error
   */
  return async (query?: {
    organization_id?: string | string[] | null;
    order_id?: string | string[] | null;
    status?: DisputeStatus | DisputeStatus[] | null;
    page?: number;
    limit?: number;
    sorting?: DisputeSortProperty[] | null;
  }): Promise<ListResourceDispute> => {
    const pathParams = {};
    const queryParams = {
      organization_id: query?.organization_id,
      order_id: query?.order_id,
      status: query?.status,
      page: query?.page || 1,
      limit: query?.limit || 10,
      sorting: query?.sorting || ["-created_at"],
    };
    const request = client.buildRequest("GET", "/v1/disputes/", pathParams, queryParams, undefined);
    const response = await client.sendRequest(request);
    return client.parseResponse<ListResourceDispute>(response, "json", {
      422: HTTPValidationError,
    });
  };
};
export const getDisputes = (client: ClientBase) => {
  /**
   * Get a dispute by ID.
   *
   * **Scopes**: `disputes:read`
   *
   * @param id - The dispute ID.
   * @returns {Dispute}
   * @throws {PolarNetworkError} When a network error occurs
   * @throws {PolarServerError} When the server returns a 5xx error
   * @throws {ResourceNotFound} Dispute not found.
   * @throws {HTTPValidationError} Validation Error
   */
  return async (id: string): Promise<Dispute> => {
    const pathParams = {
      id: id,
    };
    const queryParams = {};
    const request = client.buildRequest(
      "GET",
      "/v1/disputes/{id}",
      pathParams,
      queryParams,
      undefined,
    );
    const response = await client.sendRequest(request);
    return client.parseResponse<Dispute>(response, "json", {
      404: ResourceNotFound,
      422: HTTPValidationError,
    });
  };
};

export function createDisputesService(client: ClientBase) {
  return {
    list: listDisputes(client),
    get: getDisputes(client),
  };
}

export type Disputes = ReturnType<typeof createDisputesService>;
