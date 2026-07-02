import { ClientBase } from "../../base";
import type { CustomerBenefitGrantUpdate } from "../../models/inputs";
import type { CustomerBenefitGrant, ListResourceCustomerBenefitGrant } from "../../models/outputs";
import type { BenefitType, CustomerBenefitGrantSortProperty } from "../../models/literals";
import { HTTPValidationError, NotPermitted, ResourceNotFound } from "../../errors";

export const listBenefitGrants = (client: ClientBase) => {
  /**
   * List benefits grants of the authenticated customer.
   *
   * **Scopes**: `customer_portal:read` `customer_portal:write`
   *
   * @param query - Query parameters
   * @returns {ListResourceCustomerBenefitGrant}
   * @throws {PolarNetworkError} When a network error occurs
   * @throws {PolarServerError} When the server returns a 5xx error
   * @throws {HTTPValidationError} Validation Error
   */
  return async (query?: {
    query?: string | null;
    type?: BenefitType | BenefitType[] | null;
    benefit_id?: string | string[] | null;
    checkout_id?: string | string[] | null;
    order_id?: string | string[] | null;
    subscription_id?: string | string[] | null;
    member_id?: string | string[] | null;
    page?: number;
    limit?: number;
    sorting?: CustomerBenefitGrantSortProperty[] | null;
  }): Promise<ListResourceCustomerBenefitGrant> => {
    const pathParams = {};
    const queryParams = {
      query: query?.query,
      type: query?.type,
      benefit_id: query?.benefit_id,
      checkout_id: query?.checkout_id,
      order_id: query?.order_id,
      subscription_id: query?.subscription_id,
      member_id: query?.member_id,
      page: query?.page ?? 1,
      limit: query?.limit ?? 10,
      sorting: query?.sorting ?? ["product_benefit", "-granted_at"],
    };
    const request = client.buildRequest(
      "GET",
      "/v1/customer-portal/benefit-grants/",
      pathParams,
      queryParams,
      undefined,
    );
    const response = await client.sendRequest(request);
    return client.parseResponse<ListResourceCustomerBenefitGrant>(response, "json", {
      422: HTTPValidationError,
    });
  };
};
export const getBenefitGrants = (client: ClientBase) => {
  /**
   * Get a benefit grant by ID for the authenticated customer.
   *
   * **Scopes**: `customer_portal:read` `customer_portal:write`
   *
   * @param id - The benefit grant ID.
   * @returns {CustomerBenefitGrant}
   * @throws {PolarNetworkError} When a network error occurs
   * @throws {PolarServerError} When the server returns a 5xx error
   * @throws {ResourceNotFound} Benefit grant not found.
   * @throws {HTTPValidationError} Validation Error
   */
  return async (id: string): Promise<CustomerBenefitGrant> => {
    const pathParams = {
      id: id,
    };
    const queryParams = {};
    const request = client.buildRequest(
      "GET",
      "/v1/customer-portal/benefit-grants/{id}",
      pathParams,
      queryParams,
      undefined,
    );
    const response = await client.sendRequest(request);
    return client.parseResponse<CustomerBenefitGrant>(response, "json", {
      404: ResourceNotFound,
      422: HTTPValidationError,
    });
  };
};
export const updateBenefitGrants = (client: ClientBase) => {
  /**
   * Update a benefit grant for the authenticated customer.
   *
   * **Scopes**: `customer_portal:write`
   *
   * @param id - The benefit grant ID.
   * @param body - Request body
   * @returns {CustomerBenefitGrant}
   * @throws {PolarNetworkError} When a network error occurs
   * @throws {PolarServerError} When the server returns a 5xx error
   * @throws {NotPermitted} The benefit grant is revoked and cannot be updated.
   * @throws {ResourceNotFound} Benefit grant not found.
   * @throws {HTTPValidationError} Validation Error
   */
  return async (id: string, body: CustomerBenefitGrantUpdate): Promise<CustomerBenefitGrant> => {
    const pathParams = {
      id: id,
    };
    const queryParams = {};
    const request = client.buildRequest(
      "PATCH",
      "/v1/customer-portal/benefit-grants/{id}",
      pathParams,
      queryParams,
      body,
    );
    const response = await client.sendRequest(request);
    return client.parseResponse<CustomerBenefitGrant>(response, "json", {
      403: NotPermitted,
      404: ResourceNotFound,
      422: HTTPValidationError,
    });
  };
};

export function createBenefitGrantsService(client: ClientBase) {
  return {
    list: listBenefitGrants(client),
    get: getBenefitGrants(client),
    update: updateBenefitGrants(client),
  };
}

export type BenefitGrants = ReturnType<typeof createBenefitGrantsService>;
