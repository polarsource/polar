import type { ClientBase, RequestOptions } from "../../base";
import type {
  BenefitGrant,
  BenefitGrantCreate,
  BenefitGrantCreateExternal,
  BenefitGrantSortProperty,
  ListResourceBenefitGrant,
} from "../models";

import { BenefitGrantAlreadyExists, HTTPValidationError, ResourceNotFound } from "../errors";

export const listBenefitGrants = (client: ClientBase) => {
  /**
   * List benefit grants across all benefits accessible to the authenticated subject.
   *
   * **Scopes**: `benefits:read` `benefits:write`
   *
   * @param query - Query parameters
   * @param requestOptions - Request options
   * @returns {ListResourceBenefitGrant}
   * @throws {PolarNetworkError} When a network error occurs
   * @throws {PolarRateLimitError} When the rate limit is exceeded
   * @throws {PolarServerError} When the server returns a 5xx error
   * @throws {HTTPValidationError} Validation Error
   */
  return async (
    query?: {
      organization_id?: string | string[] | null;
      customer_id?: string | string[] | null;
      external_customer_id?: string | string[] | null;
      external_benefit_id?: string | string[] | null;
      member_id?: string | string[] | null;
      external_member_id?: string | string[] | null;
      is_granted?: boolean | null;
      page?: number;
      limit?: number;
      sorting?: BenefitGrantSortProperty[] | null;
    },
    requestOptions?: RequestOptions,
  ): Promise<ListResourceBenefitGrant> => {
    const pathParams = {};
    const queryParams = {
      organization_id: query?.organization_id,
      customer_id: query?.customer_id,
      external_customer_id: query?.external_customer_id,
      external_benefit_id: query?.external_benefit_id,
      member_id: query?.member_id,
      external_member_id: query?.external_member_id,
      is_granted: query?.is_granted,
      page: query?.page ?? 1,
      limit: query?.limit ?? 10,
      sorting: query?.sorting ?? ["-created_at"],
    };
    const request = client.buildRequest(
      "GET",
      "/v1/benefit-grants/",
      pathParams,
      queryParams,
      undefined,
    );
    const response = await client.sendRequest(request, requestOptions);
    return client.parseResponse<ListResourceBenefitGrant>(response, "json", {
      422: HTTPValidationError,
    });
  };
};
/**
 * List benefit grants across all benefits accessible to the authenticated subject.
 *
 * **Scopes**: `benefits:read` `benefits:write`
 *
 * @param query - Query parameters
 * @param requestOptions - Request options
 * @returns {AsyncGenerator<BenefitGrant>} A generator that yields items of type BenefitGrant.
 * @throws {PolarNetworkError} When a network error occurs
 * @throws {PolarRateLimitError} When the rate limit is exceeded
 * @throws {PolarServerError} When the server returns a 5xx error
 * @throws {HTTPValidationError} Validation Error
 */
export const iterListBenefitGrants = (client: ClientBase) => {
  return async function* (
    query?: {
      organization_id?: string | string[] | null;
      customer_id?: string | string[] | null;
      external_customer_id?: string | string[] | null;
      external_benefit_id?: string | string[] | null;
      member_id?: string | string[] | null;
      external_member_id?: string | string[] | null;
      is_granted?: boolean | null;
      page?: number;
      limit?: number;
      sorting?: BenefitGrantSortProperty[] | null;
    },
    requestOptions?: RequestOptions,
  ): AsyncGenerator<BenefitGrant> {
    let page: number;
    page = query?.page ?? 1;
    let limit: number | undefined;
    limit = query?.limit;

    while (true) {
      const response = await listBenefitGrants(client)({ ...query, page, limit }, requestOptions);
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
export const createBenefitGrants = (client: ClientBase) => {
  /**
   * Manually grant a benefit to a customer or one of their members.
   *
   * Use either Polar IDs for every reference or external IDs for every reference.
   * Fulfillment is asynchronous: the returned grant may not yet be granted.
   * Meter-credit benefits cannot be granted manually.
   *
   * **Scopes**: `benefits:write`
   *
   * @param body - Request body
   * @param requestOptions - Request options
   * @returns {BenefitGrant}
   * @throws {PolarNetworkError} When a network error occurs
   * @throws {PolarRateLimitError} When the rate limit is exceeded
   * @throws {PolarServerError} When the server returns a 5xx error
   * @throws {BenefitGrantAlreadyExists} Conflict
   * @throws {HTTPValidationError} Validation Error
   */
  return async (
    body: BenefitGrantCreate | BenefitGrantCreateExternal,
    requestOptions?: RequestOptions,
  ): Promise<BenefitGrant> => {
    const pathParams = {};
    const queryParams = {};
    const request = client.buildRequest(
      "POST",
      "/v1/benefit-grants/",
      pathParams,
      queryParams,
      body,
    );
    const response = await client.sendRequest(request, requestOptions);
    return client.parseResponse<BenefitGrant>(response, "json", {
      409: BenefitGrantAlreadyExists,
      422: HTTPValidationError,
    });
  };
};
export const revokeBenefitGrants = (client: ClientBase) => {
  /**
   * Permanently revoke a benefit grant, including grants from purchases.
   *
   * Revocation is asynchronous. Once manually revoked, this grant cannot be
   * reactivated by renewal or fulfillment retries. Other grants may still
   * provide access to the benefit. Repeating this request is safe.
   *
   * **Scopes**: `benefits:write`
   *
   * @param id
   * @param requestOptions - Request options
   * @returns {BenefitGrant}
   * @throws {PolarNetworkError} When a network error occurs
   * @throws {PolarRateLimitError} When the rate limit is exceeded
   * @throws {PolarServerError} When the server returns a 5xx error
   * @throws {ResourceNotFound} Not Found
   * @throws {HTTPValidationError} Validation Error
   */
  return async (id: string, requestOptions?: RequestOptions): Promise<BenefitGrant> => {
    const pathParams = {
      id: id,
    };
    const queryParams = {};
    const request = client.buildRequest(
      "DELETE",
      "/v1/benefit-grants/{id}",
      pathParams,
      queryParams,
      undefined,
    );
    const response = await client.sendRequest(request, requestOptions);
    return client.parseResponse<BenefitGrant>(response, "json", {
      404: ResourceNotFound,
      422: HTTPValidationError,
    });
  };
};

export function createBenefitGrantsService(client: ClientBase) {
  return {
    list: listBenefitGrants(client),
    create: createBenefitGrants(client),
    revoke: revokeBenefitGrants(client),
    iterList: iterListBenefitGrants(client),
  };
}

export type BenefitGrants = ReturnType<typeof createBenefitGrantsService>;
