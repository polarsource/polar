import type { ClientBase } from "../../base";
import type { BenefitGrant, BenefitGrantSortProperty, ListResourceBenefitGrant } from "../models";

import { HTTPValidationError } from "../errors";

export const listBenefitGrants = (client: ClientBase) => {
  /**
   * List benefit grants across all benefits accessible to the authenticated subject.
   *
   * **Scopes**: `benefits:read` `benefits:write`
   *
   * @param query - Query parameters
   * @returns {ListResourceBenefitGrant}
   * @throws {PolarNetworkError} When a network error occurs
   * @throws {PolarRateLimitError} When the rate limit is exceeded
   * @throws {PolarServerError} When the server returns a 5xx error
   * @throws {HTTPValidationError} Validation Error
   */
  return async (query?: {
    organization_id?: string | string[] | null;
    customer_id?: string | string[] | null;
    external_customer_id?: string | string[] | null;
    is_granted?: boolean | null;
    page?: number;
    limit?: number;
    sorting?: BenefitGrantSortProperty[] | null;
  }): Promise<ListResourceBenefitGrant> => {
    const pathParams = {};
    const queryParams = {
      organization_id: query?.organization_id,
      customer_id: query?.customer_id,
      external_customer_id: query?.external_customer_id,
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
    const response = await client.sendRequest(request);
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
 * @returns {AsyncGenerator<BenefitGrant>} A generator that yields items of type BenefitGrant.
 * @throws {PolarNetworkError} When a network error occurs
 * @throws {PolarRateLimitError} When the rate limit is exceeded
 * @throws {PolarServerError} When the server returns a 5xx error
 * @throws {HTTPValidationError} Validation Error
 */
export const iterlistBenefitGrants = (client: ClientBase) => {
  return async function* (query?: {
    organization_id?: string | string[] | null;
    customer_id?: string | string[] | null;
    external_customer_id?: string | string[] | null;
    is_granted?: boolean | null;
    page?: number;
    limit?: number;
    sorting?: BenefitGrantSortProperty[] | null;
  }): AsyncGenerator<BenefitGrant> {
    let page: number;
    page = query?.page ?? 1;
    let limit: number | undefined;
    limit = query?.limit;

    while (true) {
      const response = await listBenefitGrants(client)({ ...query, page, limit });
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

export function createBenefitGrantsService(client: ClientBase) {
  return {
    list: listBenefitGrants(client),
    iterlist: iterlistBenefitGrants(client),
  };
}

export type BenefitGrants = ReturnType<typeof createBenefitGrantsService>;
