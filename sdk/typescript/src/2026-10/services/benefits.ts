import type { ClientBase, RequestOptions } from "../../base";
import type {
  Benefit,
  BenefitCreate,
  BenefitCustomUpdate,
  BenefitDiscordUpdate,
  BenefitDownloadableFile,
  BenefitDownloadablesUpdate,
  BenefitFeatureFlagUpdate,
  BenefitGitHubRepositoryUpdate,
  BenefitGrant,
  BenefitLicenseKeysUpdate,
  BenefitMeterCreditUpdate,
  BenefitSlackSharedChannelUpdate,
  BenefitSortProperty,
  BenefitType,
  ListResourceBenefit,
  ListResourceBenefitDownloadableFile,
  ListResourceBenefitGrant,
  MetadataQuery,
} from "../models";

import { HTTPValidationError, NotPermitted, ResourceNotFound } from "../errors";

export const listBenefits = (client: ClientBase) => {
  /**
   * List benefits.
   *
   * **Scopes**: `benefits:read` `benefits:write`
   *
   * @param query - Query parameters
   * @param requestOptions - Request options
   * @returns {ListResourceBenefit}
   * @throws {PolarNetworkError} When a network error occurs
   * @throws {PolarRateLimitError} When the rate limit is exceeded
   * @throws {PolarServerError} When the server returns a 5xx error
   * @throws {HTTPValidationError} Validation Error
   */
  return async (
    query?: {
      organization_id?: string | string[] | null;
      type?: BenefitType | BenefitType[] | null;
      id?: string | string[] | null;
      exclude_id?: string | string[] | null;
      query?: string | null;
      page?: number;
      limit?: number;
      sorting?: BenefitSortProperty[] | null;
      metadata?: MetadataQuery;
    },
    requestOptions?: RequestOptions,
  ): Promise<ListResourceBenefit> => {
    const pathParams = {};
    const queryParams = {
      organization_id: query?.organization_id,
      type: query?.type,
      id: query?.id,
      exclude_id: query?.exclude_id,
      query: query?.query,
      page: query?.page ?? 1,
      limit: query?.limit ?? 10,
      sorting: query?.sorting ?? ["-created_at"],
      metadata: query?.metadata,
    };
    const request = client.buildRequest("GET", "/v1/benefits/", pathParams, queryParams, undefined);
    const response = await client.sendRequest(request, requestOptions);
    return client.parseResponse<ListResourceBenefit>(response, "json", {
      422: HTTPValidationError,
    });
  };
};
/**
 * List benefits.
 *
 * **Scopes**: `benefits:read` `benefits:write`
 *
 * @param query - Query parameters
 * @param requestOptions - Request options
 * @returns {AsyncGenerator<Benefit>} A generator that yields items of type Benefit.
 * @throws {PolarNetworkError} When a network error occurs
 * @throws {PolarRateLimitError} When the rate limit is exceeded
 * @throws {PolarServerError} When the server returns a 5xx error
 * @throws {HTTPValidationError} Validation Error
 */
export const iterListBenefits = (client: ClientBase) => {
  return async function* (
    query?: {
      organization_id?: string | string[] | null;
      type?: BenefitType | BenefitType[] | null;
      id?: string | string[] | null;
      exclude_id?: string | string[] | null;
      query?: string | null;
      page?: number;
      limit?: number;
      sorting?: BenefitSortProperty[] | null;
      metadata?: MetadataQuery;
    },
    requestOptions?: RequestOptions,
  ): AsyncGenerator<Benefit> {
    let page: number;
    page = query?.page ?? 1;
    let limit: number | undefined;
    limit = query?.limit;

    while (true) {
      const response = await listBenefits(client)({ ...query, page, limit }, requestOptions);
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
export const createBenefits = (client: ClientBase) => {
  /**
   * Create a benefit.
   *
   * **Scopes**: `benefits:write`
   *
   * @param body - Request body
   * @param requestOptions - Request options
   * @returns {Benefit}
   * @throws {PolarNetworkError} When a network error occurs
   * @throws {PolarRateLimitError} When the rate limit is exceeded
   * @throws {PolarServerError} When the server returns a 5xx error
   * @throws {HTTPValidationError} Validation Error
   */
  return async (body: BenefitCreate, requestOptions?: RequestOptions): Promise<Benefit> => {
    const pathParams = {};
    const queryParams = {};
    const request = client.buildRequest("POST", "/v1/benefits/", pathParams, queryParams, body);
    const response = await client.sendRequest(request, requestOptions);
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
   * @param id
   * @param requestOptions - Request options
   * @returns {Benefit}
   * @throws {PolarNetworkError} When a network error occurs
   * @throws {PolarRateLimitError} When the rate limit is exceeded
   * @throws {PolarServerError} When the server returns a 5xx error
   * @throws {ResourceNotFound} Benefit not found.
   * @throws {HTTPValidationError} Validation Error
   */
  return async (id: string, requestOptions?: RequestOptions): Promise<Benefit> => {
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
    const response = await client.sendRequest(request, requestOptions);
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
   * @param id
   * @param requestOptions - Request options
   * @returns {void}
   * @throws {PolarNetworkError} When a network error occurs
   * @throws {PolarRateLimitError} When the rate limit is exceeded
   * @throws {PolarServerError} When the server returns a 5xx error
   * @throws {NotPermitted} This benefit is not deletable.
   * @throws {ResourceNotFound} Benefit not found.
   * @throws {HTTPValidationError} Validation Error
   */
  return async (id: string, requestOptions?: RequestOptions): Promise<void> => {
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
    const response = await client.sendRequest(request, requestOptions);
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
   * @param id
   * @param body - Request body
   * @param requestOptions - Request options
   * @returns {Benefit}
   * @throws {PolarNetworkError} When a network error occurs
   * @throws {PolarRateLimitError} When the rate limit is exceeded
   * @throws {PolarServerError} When the server returns a 5xx error
   * @throws {ResourceNotFound} Benefit not found.
   * @throws {HTTPValidationError} Validation Error
   */
  return async (
    id: string,
    body:
      | BenefitCustomUpdate
      | BenefitDiscordUpdate
      | BenefitGitHubRepositoryUpdate
      | BenefitDownloadablesUpdate
      | BenefitLicenseKeysUpdate
      | BenefitMeterCreditUpdate
      | BenefitFeatureFlagUpdate
      | BenefitSlackSharedChannelUpdate,
    requestOptions?: RequestOptions,
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
    const response = await client.sendRequest(request, requestOptions);
    return client.parseResponse<Benefit>(response, "json", {
      404: ResourceNotFound,
      422: HTTPValidationError,
    });
  };
};
export const filesBenefits = (client: ClientBase) => {
  /**
   * List the downloadable files for a benefit with their download statistics.
   *
   * **Scopes**: `benefits:read` `benefits:write`
   *
   * @param id
   * @param query - Query parameters
   * @param requestOptions - Request options
   * @returns {ListResourceBenefitDownloadableFile}
   * @throws {PolarNetworkError} When a network error occurs
   * @throws {PolarRateLimitError} When the rate limit is exceeded
   * @throws {PolarServerError} When the server returns a 5xx error
   * @throws {ResourceNotFound} Benefit not found.
   * @throws {HTTPValidationError} Validation Error
   */
  return async (
    id: string,
    query?: {
      page?: number;
      limit?: number;
    },
    requestOptions?: RequestOptions,
  ): Promise<ListResourceBenefitDownloadableFile> => {
    const pathParams = {
      id: id,
    };
    const queryParams = {
      page: query?.page ?? 1,
      limit: query?.limit ?? 10,
    };
    const request = client.buildRequest(
      "GET",
      "/v1/benefits/{id}/files",
      pathParams,
      queryParams,
      undefined,
    );
    const response = await client.sendRequest(request, requestOptions);
    return client.parseResponse<ListResourceBenefitDownloadableFile>(response, "json", {
      404: ResourceNotFound,
      422: HTTPValidationError,
    });
  };
};
/**
 * List the downloadable files for a benefit with their download statistics.
 *
 * **Scopes**: `benefits:read` `benefits:write`
 *
 * @param id
 * @param query - Query parameters
 * @param requestOptions - Request options
 * @returns {AsyncGenerator<BenefitDownloadableFile>} A generator that yields items of type BenefitDownloadableFile.
 * @throws {PolarNetworkError} When a network error occurs
 * @throws {PolarRateLimitError} When the rate limit is exceeded
 * @throws {PolarServerError} When the server returns a 5xx error
 * @throws {ResourceNotFound} Benefit not found.
 * @throws {HTTPValidationError} Validation Error
 */
export const iterFilesBenefits = (client: ClientBase) => {
  return async function* (
    id: string,
    query?: {
      page?: number;
      limit?: number;
    },
    requestOptions?: RequestOptions,
  ): AsyncGenerator<BenefitDownloadableFile> {
    let page: number;
    page = query?.page ?? 1;
    let limit: number | undefined;
    limit = query?.limit;

    while (true) {
      const response = await filesBenefits(client)(id, { ...query, page, limit }, requestOptions);
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
export const grantsBenefits = (client: ClientBase) => {
  /**
   * List the individual grants for a benefit.
   *
   * It's especially useful to check if a user has been granted a benefit.
   *
   * **Scopes**: `benefits:read` `benefits:write`
   *
   * @param id
   * @param query - Query parameters
   * @param requestOptions - Request options
   * @returns {ListResourceBenefitGrant}
   * @throws {PolarNetworkError} When a network error occurs
   * @throws {PolarRateLimitError} When the rate limit is exceeded
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
    requestOptions?: RequestOptions,
  ): Promise<ListResourceBenefitGrant> => {
    const pathParams = {
      id: id,
    };
    const queryParams = {
      is_granted: query?.is_granted,
      customer_id: query?.customer_id,
      member_id: query?.member_id,
      page: query?.page ?? 1,
      limit: query?.limit ?? 10,
    };
    const request = client.buildRequest(
      "GET",
      "/v1/benefits/{id}/grants",
      pathParams,
      queryParams,
      undefined,
    );
    const response = await client.sendRequest(request, requestOptions);
    return client.parseResponse<ListResourceBenefitGrant>(response, "json", {
      404: ResourceNotFound,
      422: HTTPValidationError,
    });
  };
};
/**
 * List the individual grants for a benefit.
 *
 * It's especially useful to check if a user has been granted a benefit.
 *
 * **Scopes**: `benefits:read` `benefits:write`
 *
 * @param id
 * @param query - Query parameters
 * @param requestOptions - Request options
 * @returns {AsyncGenerator<BenefitGrant>} A generator that yields items of type BenefitGrant.
 * @throws {PolarNetworkError} When a network error occurs
 * @throws {PolarRateLimitError} When the rate limit is exceeded
 * @throws {PolarServerError} When the server returns a 5xx error
 * @throws {ResourceNotFound} Benefit not found.
 * @throws {HTTPValidationError} Validation Error
 */
export const iterGrantsBenefits = (client: ClientBase) => {
  return async function* (
    id: string,
    query?: {
      is_granted?: boolean | null;
      customer_id?: string | string[] | null;
      member_id?: string | string[] | null;
      page?: number;
      limit?: number;
    },
    requestOptions?: RequestOptions,
  ): AsyncGenerator<BenefitGrant> {
    let page: number;
    page = query?.page ?? 1;
    let limit: number | undefined;
    limit = query?.limit;

    while (true) {
      const response = await grantsBenefits(client)(id, { ...query, page, limit }, requestOptions);
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

export function createBenefitsService(client: ClientBase) {
  return {
    list: listBenefits(client),
    create: createBenefits(client),
    get: getBenefits(client),
    delete: deleteBenefits(client),
    update: updateBenefits(client),
    files: filesBenefits(client),
    grants: grantsBenefits(client),
    iterList: iterListBenefits(client),
    iterFiles: iterFilesBenefits(client),
    iterGrants: iterGrantsBenefits(client),
  };
}

export type Benefits = ReturnType<typeof createBenefitsService>;
