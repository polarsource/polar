import type { ClientBase } from "../../base";
import type { Dispute, DisputeSortProperty, DisputeStatus, ListResourceDispute } from "../models";

import { DisputeNotOpenError, HTTPValidationError, ResourceNotFound } from "../errors";

export const listDisputes = (client: ClientBase) => {
  /**
   * List disputes.
   *
   * **Scopes**: `disputes:read` `disputes:write`
   *
   * @param query - Query parameters
   * @returns {ListResourceDispute}
   * @throws {PolarNetworkError} When a network error occurs
   * @throws {PolarRateLimitError} When the rate limit is exceeded
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
      page: query?.page ?? 1,
      limit: query?.limit ?? 10,
      sorting: query?.sorting ?? ["-created_at"],
    };
    const request = client.buildRequest("GET", "/v1/disputes/", pathParams, queryParams, undefined);
    const response = await client.sendRequest(request);
    return client.parseResponse<ListResourceDispute>(response, "json", {
      422: HTTPValidationError,
    });
  };
};
/**
 * List disputes.
 *
 * **Scopes**: `disputes:read` `disputes:write`
 *
 * @param query - Query parameters
 * @returns {AsyncGenerator<Dispute>} A generator that yields items of type Dispute.
 * @throws {PolarNetworkError} When a network error occurs
 * @throws {PolarRateLimitError} When the rate limit is exceeded
 * @throws {PolarServerError} When the server returns a 5xx error
 * @throws {HTTPValidationError} Validation Error
 */
export const iterListDisputes = (client: ClientBase) => {
  return async function* (query?: {
    organization_id?: string | string[] | null;
    order_id?: string | string[] | null;
    status?: DisputeStatus | DisputeStatus[] | null;
    page?: number;
    limit?: number;
    sorting?: DisputeSortProperty[] | null;
  }): AsyncGenerator<Dispute> {
    let page: number;
    page = query?.page ?? 1;
    let limit: number | undefined;
    limit = query?.limit;

    while (true) {
      const response = await listDisputes(client)({ ...query, page, limit });
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
export const getDisputes = (client: ClientBase) => {
  /**
   * Get a dispute by ID.
   *
   * **Scopes**: `disputes:read` `disputes:write`
   *
   * @param id - The dispute ID.
   * @returns {Dispute}
   * @throws {PolarNetworkError} When a network error occurs
   * @throws {PolarRateLimitError} When the rate limit is exceeded
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
export const acceptDisputes = (client: ClientBase) => {
  /**
   * Accept a dispute, conceding the chargeback.
   *
   * Closes the dispute with the processor (settling it as `lost`) and records
   * the merchant's decision on the dispute's support case.
   *
   * **Scopes**: `disputes:write`
   *
   * @param id - The dispute ID.
   * @returns {Dispute}
   * @throws {PolarNetworkError} When a network error occurs
   * @throws {PolarRateLimitError} When the rate limit is exceeded
   * @throws {PolarServerError} When the server returns a 5xx error
   * @throws {ResourceNotFound} Dispute not found.
   * @throws {DisputeNotOpenError} Conflict
   * @throws {HTTPValidationError} Validation Error
   */
  return async (id: string): Promise<Dispute> => {
    const pathParams = {
      id: id,
    };
    const queryParams = {};
    const request = client.buildRequest(
      "POST",
      "/v1/disputes/{id}/accept",
      pathParams,
      queryParams,
      undefined,
    );
    const response = await client.sendRequest(request);
    return client.parseResponse<Dispute>(response, "json", {
      404: ResourceNotFound,
      409: DisputeNotOpenError,
      422: HTTPValidationError,
    });
  };
};

export function createDisputesService(client: ClientBase) {
  return {
    list: listDisputes(client),
    get: getDisputes(client),
    accept: acceptDisputes(client),
    iterList: iterListDisputes(client),
  };
}

export type Disputes = ReturnType<typeof createDisputesService>;
