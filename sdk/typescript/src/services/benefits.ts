import { ClientBase } from "../base";
import type {
  BenefitCreate,
  BenefitCustomUpdate,
  BenefitDiscordUpdate,
  BenefitDownloadablesUpdate,
  BenefitFeatureFlagUpdate,
  BenefitGitHubRepositoryUpdate,
  BenefitLicenseKeysUpdate,
  BenefitMeterCreditUpdate,
  BenefitSlackSharedChannelUpdate,
  MetadataQuery,
} from "../models/inputs";
import type { Benefit, ListResourceBenefit, ListResourceBenefitGrant } from "../models/outputs";
import type { BenefitSortProperty, BenefitType } from "../models/literals";
import { HTTPValidationError, NotPermitted, ResourceNotFound } from "../errors";

export const listBenefits = (client: ClientBase) => {
  /**
   * List benefits.
   *
   * **Scopes**: `benefits:read` `benefits:write`
   *
   * @param query - Query parameters
   * @returns {ListResourceBenefit}
   * @throws {PolarNetworkError} When a network error occurs
   * @throws {PolarServerError} When the server returns a 5xx error
   * @throws {HTTPValidationError} Validation Error
   */
  return async (query?: {
    organization_id?: string | string[] | null;
    type?: BenefitType | BenefitType[] | null;
    id?: string | string[] | null;
    exclude_id?: string | string[] | null;
    query?: string | null;
    page?: number;
    limit?: number;
    sorting?: BenefitSortProperty[] | null;
    metadata?: MetadataQuery;
  }): Promise<ListResourceBenefit> => {
    const pathParams = {};
    const queryParams = {
      organization_id: query?.organization_id,
      type: query?.type,
      id: query?.id,
      exclude_id: query?.exclude_id,
      query: query?.query,
      page: query?.page || 1,
      limit: query?.limit || 10,
      sorting: query?.sorting || ["-created_at"],
      metadata: query?.metadata,
    };
    const request = client.buildRequest("GET", "/v1/benefits/", pathParams, queryParams, undefined);
    const response = await client.sendRequest(request);
    return client.parseResponse<ListResourceBenefit>(response, "json", {
      422: HTTPValidationError,
    });
  };
};
export const createBenefits = (client: ClientBase) => {
  /**
   * Create a benefit.
   *
   * **Scopes**: `benefits:write`
   *
   * @param body - Request body* @returns {Benefit}
   * @throws {PolarNetworkError} When a network error occurs
   * @throws {PolarServerError} When the server returns a 5xx error
   * @throws {HTTPValidationError} Validation Error
   */
  return async (body?: BenefitCreate): Promise<Benefit> => {
    const pathParams = {};
    const queryParams = {};
    const request = client.buildRequest("POST", "/v1/benefits/", pathParams, queryParams, body);
    const response = await client.sendRequest(request);
    return client.parseResponse<Benefit>(response, "json", {
      422: HTTPValidationError,
    });
  };
};
export const getBenefits = (client: ClientBase) => {
  /**
   * Get a benefit by ID.
   *
   * **Scopes**: `benefits:read` `benefits:write`
   *
   * @param id - id
   * @returns {Benefit}
   * @throws {PolarNetworkError} When a network error occurs
   * @throws {PolarServerError} When the server returns a 5xx error
   * @throws {ResourceNotFound} Benefit not found.
   * @throws {HTTPValidationError} Validation Error
   */
  return async (id: string): Promise<Benefit> => {
    const pathParams = {
      id: id,
    };
    const queryParams = {};
    const request = client.buildRequest(
      "GET",
      "/v1/benefits/{id}",
      pathParams,
      queryParams,
      undefined,
    );
    const response = await client.sendRequest(request);
    return client.parseResponse<Benefit>(response, "json", {
      404: ResourceNotFound,
      422: HTTPValidationError,
    });
  };
};
export const deleteBenefits = (client: ClientBase) => {
  /**
   * Delete a benefit.
   *
   * > [!WARNING]
   * > Every grants associated with the benefit will be revoked.
   * > Users will lose access to the benefit.
   *
   * **Scopes**: `benefits:write`
   *
   * @param id - id
   * @returns {void}
   * @throws {PolarNetworkError} When a network error occurs
   * @throws {PolarServerError} When the server returns a 5xx error
   * @throws {NotPermitted} This benefit is not deletable.
   * @throws {ResourceNotFound} Benefit not found.
   * @throws {HTTPValidationError} Validation Error
   */
  return async (id: string): Promise<void> => {
    const pathParams = {
      id: id,
    };
    const queryParams = {};
    const request = client.buildRequest(
      "DELETE",
      "/v1/benefits/{id}",
      pathParams,
      queryParams,
      undefined,
    );
    const response = await client.sendRequest(request);
    return client.parseResponse<void>(response, "none", {
      403: NotPermitted,
      404: ResourceNotFound,
      422: HTTPValidationError,
    });
  };
};
export const updateBenefits = (client: ClientBase) => {
  /**
   * Update a benefit.
   *
   * **Scopes**: `benefits:write`
   *
   * @param id - id
   * @param body - Request body* @returns {Benefit}
   * @throws {PolarNetworkError} When a network error occurs
   * @throws {PolarServerError} When the server returns a 5xx error
   * @throws {ResourceNotFound} Benefit not found.
   * @throws {HTTPValidationError} Validation Error
   */
  return async (
    id: string,
    body?:
      | BenefitCustomUpdate
      | BenefitDiscordUpdate
      | BenefitGitHubRepositoryUpdate
      | BenefitDownloadablesUpdate
      | BenefitLicenseKeysUpdate
      | BenefitMeterCreditUpdate
      | BenefitFeatureFlagUpdate
      | BenefitSlackSharedChannelUpdate,
  ): Promise<Benefit> => {
    const pathParams = {
      id: id,
    };
    const queryParams = {};
    const request = client.buildRequest(
      "PATCH",
      "/v1/benefits/{id}",
      pathParams,
      queryParams,
      body,
    );
    const response = await client.sendRequest(request);
    return client.parseResponse<Benefit>(response, "json", {
      404: ResourceNotFound,
      422: HTTPValidationError,
    });
  };
};
export const grantsBenefits = (client: ClientBase) => {
  /**
   * List the individual grants for a benefit.
   *
   * It's especially useful to check if a user has been granted a benefit.
   *
   * **Scopes**: `benefits:read` `benefits:write`
   *
   * @param id - id
   * @param query - Query parameters
   * @returns {ListResourceBenefitGrant}
   * @throws {PolarNetworkError} When a network error occurs
   * @throws {PolarServerError} When the server returns a 5xx error
   * @throws {ResourceNotFound} Benefit not found.
   * @throws {HTTPValidationError} Validation Error
   */
  return async (
    id: string,
    query?: {
      is_granted?: boolean | null;
      customer_id?: string | string[] | null;
      member_id?: string | string[] | null;
      page?: number;
      limit?: number;
    },
  ): Promise<ListResourceBenefitGrant> => {
    const pathParams = {
      id: id,
    };
    const queryParams = {
      is_granted: query?.is_granted,
      customer_id: query?.customer_id,
      member_id: query?.member_id,
      page: query?.page || 1,
      limit: query?.limit || 10,
    };
    const request = client.buildRequest(
      "GET",
      "/v1/benefits/{id}/grants",
      pathParams,
      queryParams,
      undefined,
    );
    const response = await client.sendRequest(request);
    return client.parseResponse<ListResourceBenefitGrant>(response, "json", {
      404: ResourceNotFound,
      422: HTTPValidationError,
    });
  };
};

export function createBenefitsService(client: ClientBase) {
  return {
    list: listBenefits(client),
    create: createBenefits(client),
    get: getBenefits(client),
    delete: deleteBenefits(client),
    update: updateBenefits(client),
    grants: grantsBenefits(client),
  };
}

export type Benefits = ReturnType<typeof createBenefitsService>;
