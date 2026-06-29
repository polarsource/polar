import { ClientBase } from "../base";
import type { OrganizationCreate, OrganizationUpdate } from "../models/inputs";
import type { ListResourceOrganization, Organization } from "../models/outputs";
import type { OrganizationSortProperty } from "../models/literals";
import { HTTPValidationError, NotPermitted, ResourceNotFound } from "../errors";

export const listOrganizations = (client: ClientBase) => {
  /**
   * List organizations.
   *
   * **Scopes**: `organizations:read` `organizations:write`
   *
   * @param query - Query parameters
   * @returns {ListResourceOrganization}
   * @throws {PolarNetworkError} When a network error occurs
   * @throws {PolarServerError} When the server returns a 5xx error
   * @throws {HTTPValidationError} Validation Error
   */
  return async (query?: {
    slug?: string | null;
    page?: number;
    limit?: number;
    sorting?: OrganizationSortProperty[] | null;
  }): Promise<ListResourceOrganization> => {
    const pathParams = {};
    const queryParams = {
      slug: query?.slug,
      page: query?.page ?? 1,
      limit: query?.limit ?? 10,
      sorting: query?.sorting ?? ["created_at"],
    };
    const request = client.buildRequest(
      "GET",
      "/v1/organizations/",
      pathParams,
      queryParams,
      undefined,
    );
    const response = await client.sendRequest(request);
    return client.parseResponse<ListResourceOrganization>(response, "json", {
      422: HTTPValidationError,
    });
  };
};
export const createOrganizations = (client: ClientBase) => {
  /**
   * Create an organization.
   *
   * **Scopes**: `organizations:write`
   *
   * @param body - Request body
   * @returns {Organization}
   * @throws {PolarNetworkError} When a network error occurs
   * @throws {PolarServerError} When the server returns a 5xx error
   * @throws {HTTPValidationError} Validation Error
   */
  return async (body: OrganizationCreate): Promise<Organization> => {
    const pathParams = {};
    const queryParams = {};
    const request = client.buildRequest(
      "POST",
      "/v1/organizations/",
      pathParams,
      queryParams,
      body,
    );
    const response = await client.sendRequest(request);
    return client.parseResponse<Organization>(response, "json", {
      422: HTTPValidationError,
    });
  };
};
export const getOrganizations = (client: ClientBase) => {
  /**
   * Get an organization by ID.
   *
   * **Scopes**: `organizations:read` `organizations:write`
   *
   * @param id
   * @returns {Organization}
   * @throws {PolarNetworkError} When a network error occurs
   * @throws {PolarServerError} When the server returns a 5xx error
   * @throws {ResourceNotFound} Organization not found.
   * @throws {HTTPValidationError} Validation Error
   */
  return async (id: string): Promise<Organization> => {
    const pathParams = {
      id: id,
    };
    const queryParams = {};
    const request = client.buildRequest(
      "GET",
      "/v1/organizations/{id}",
      pathParams,
      queryParams,
      undefined,
    );
    const response = await client.sendRequest(request);
    return client.parseResponse<Organization>(response, "json", {
      404: ResourceNotFound,
      422: HTTPValidationError,
    });
  };
};
export const updateOrganizations = (client: ClientBase) => {
  /**
   * Update an organization.
   *
   * **Scopes**: `organizations:write`
   *
   * @param id
   * @param body - Request body
   * @returns {Organization}
   * @throws {PolarNetworkError} When a network error occurs
   * @throws {PolarServerError} When the server returns a 5xx error
   * @throws {NotPermitted} You don't have the permission to update this organization.
   * @throws {ResourceNotFound} Organization not found.
   * @throws {HTTPValidationError} Validation Error
   */
  return async (id: string, body: OrganizationUpdate): Promise<Organization> => {
    const pathParams = {
      id: id,
    };
    const queryParams = {};
    const request = client.buildRequest(
      "PATCH",
      "/v1/organizations/{id}",
      pathParams,
      queryParams,
      body,
    );
    const response = await client.sendRequest(request);
    return client.parseResponse<Organization>(response, "json", {
      403: NotPermitted,
      404: ResourceNotFound,
      422: HTTPValidationError,
    });
  };
};

export function createOrganizationsService(client: ClientBase) {
  return {
    list: listOrganizations(client),
    create: createOrganizations(client),
    get: getOrganizations(client),
    update: updateOrganizations(client),
  };
}

export type Organizations = ReturnType<typeof createOrganizationsService>;
