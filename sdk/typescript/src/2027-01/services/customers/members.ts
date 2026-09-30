import type { ClientBase, RequestOptions } from "../../../base";
import type {
  ListResourceMember,
  Member,
  MemberCreateFromCustomer,
  MemberRole,
  MemberSortProperty,
  MemberUpdate,
} from "../../models";

import {
  AmbiguousExternalCustomerID,
  HTTPValidationError,
  NotPermitted,
  ResourceNotFound,
} from "../../errors";

export const listMembers = (client: ClientBase) => {
  /**
   * List the members of a customer.
   *
   * **Scopes**: `members:read` `members:write`
   *
   * @param id - The customer ID.
   * @param query - Query parameters
   * @param requestOptions - Request options
   * @returns {ListResourceMember}
   * @throws {PolarNetworkError} When a network error occurs
   * @throws {PolarRateLimitError} When the rate limit is exceeded
   * @throws {PolarServerError} When the server returns a 5xx error
   * @throws {ResourceNotFound} Customer not found.
   * @throws {HTTPValidationError} Validation Error
   */
  return async (
    id: string,
    query?: {
      role?: MemberRole | null;
      page?: number;
      limit?: number;
      sorting?: MemberSortProperty[] | null;
    },
    requestOptions?: RequestOptions,
  ): Promise<ListResourceMember> => {
    const pathParams = {
      id: id,
    };
    const queryParams = {
      role: query?.role,
      page: query?.page ?? 1,
      limit: query?.limit ?? 10,
      sorting: query?.sorting ?? ["-created_at"],
    };
    const request = client.buildRequest(
      "GET",
      "/v1/customers/{id}/members",
      pathParams,
      queryParams,
      undefined,
    );
    const response = await client.sendRequest(request, requestOptions);
    return client.parseResponse<ListResourceMember>(response, "json", {
      404: ResourceNotFound,
      422: HTTPValidationError,
    });
  };
};
/**
 * List the members of a customer.
 *
 * **Scopes**: `members:read` `members:write`
 *
 * @param id - The customer ID.
 * @param query - Query parameters
 * @param requestOptions - Request options
 * @returns {AsyncGenerator<Member>} A generator that yields items of type Member.
 * @throws {PolarNetworkError} When a network error occurs
 * @throws {PolarRateLimitError} When the rate limit is exceeded
 * @throws {PolarServerError} When the server returns a 5xx error
 * @throws {ResourceNotFound} Customer not found.
 * @throws {HTTPValidationError} Validation Error
 */
export const iterListMembers = (client: ClientBase) => {
  return async function* (
    id: string,
    query?: {
      role?: MemberRole | null;
      page?: number;
      limit?: number;
      sorting?: MemberSortProperty[] | null;
    },
    requestOptions?: RequestOptions,
  ): AsyncGenerator<Member> {
    let page: number;
    page = query?.page ?? 1;
    let limit: number | undefined;
    limit = query?.limit;

    while (true) {
      const response = await listMembers(client)(id, { ...query, page, limit }, requestOptions);
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
export const createMembers = (client: ClientBase) => {
  /**
   * Create a new member for a customer.
   *
   * Only B2B customers with the member management feature enabled can add members.
   * The authenticated user or organization must have access to the customer's organization.
   *
   * **Scopes**: `members:write`
   *
   * @param id - The customer ID.
   * @param body - Request body
   * @param requestOptions - Request options
   * @returns {Member}
   * @throws {PolarNetworkError} When a network error occurs
   * @throws {PolarRateLimitError} When the rate limit is exceeded
   * @throws {PolarServerError} When the server returns a 5xx error
   * @throws {NotPermitted} Not permitted to add members.
   * @throws {ResourceNotFound} Customer not found.
   * @throws {HTTPValidationError} Validation Error
   */
  return async (
    id: string,
    body: MemberCreateFromCustomer,
    requestOptions?: RequestOptions,
  ): Promise<Member> => {
    const pathParams = {
      id: id,
    };
    const queryParams = {};
    const request = client.buildRequest(
      "POST",
      "/v1/customers/{id}/members",
      pathParams,
      queryParams,
      body,
    );
    const response = await client.sendRequest(request, requestOptions);
    return client.parseResponse<Member>(response, "json", {
      403: NotPermitted,
      404: ResourceNotFound,
      422: HTTPValidationError,
    });
  };
};
export const listExternalMembers = (client: ClientBase) => {
  /**
   * List the members of a customer identified by its external ID.
   *
   * **Scopes**: `members:read` `members:write`
   *
   * @param external_id - The customer external ID.
   * @param query - Query parameters
   * @param requestOptions - Request options
   * @returns {ListResourceMember}
   * @throws {PolarNetworkError} When a network error occurs
   * @throws {PolarRateLimitError} When the rate limit is exceeded
   * @throws {PolarServerError} When the server returns a 5xx error
   * @throws {ResourceNotFound} Customer not found.
   * @throws {AmbiguousExternalCustomerID} The external customer ID matches customers in several accessible organizations.
   * @throws {HTTPValidationError} Validation Error
   */
  return async (
    external_id: string,
    query?: {
      role?: MemberRole | null;
      page?: number;
      limit?: number;
      sorting?: MemberSortProperty[] | null;
    },
    requestOptions?: RequestOptions,
  ): Promise<ListResourceMember> => {
    const pathParams = {
      external_id: external_id,
    };
    const queryParams = {
      role: query?.role,
      page: query?.page ?? 1,
      limit: query?.limit ?? 10,
      sorting: query?.sorting ?? ["-created_at"],
    };
    const request = client.buildRequest(
      "GET",
      "/v1/customers/external/{external_id}/members",
      pathParams,
      queryParams,
      undefined,
    );
    const response = await client.sendRequest(request, requestOptions);
    return client.parseResponse<ListResourceMember>(response, "json", {
      404: ResourceNotFound,
      409: AmbiguousExternalCustomerID,
      422: HTTPValidationError,
    });
  };
};
/**
 * List the members of a customer identified by its external ID.
 *
 * **Scopes**: `members:read` `members:write`
 *
 * @param external_id - The customer external ID.
 * @param query - Query parameters
 * @param requestOptions - Request options
 * @returns {AsyncGenerator<Member>} A generator that yields items of type Member.
 * @throws {PolarNetworkError} When a network error occurs
 * @throws {PolarRateLimitError} When the rate limit is exceeded
 * @throws {PolarServerError} When the server returns a 5xx error
 * @throws {ResourceNotFound} Customer not found.
 * @throws {AmbiguousExternalCustomerID} The external customer ID matches customers in several accessible organizations.
 * @throws {HTTPValidationError} Validation Error
 */
export const iterListExternalMembers = (client: ClientBase) => {
  return async function* (
    external_id: string,
    query?: {
      role?: MemberRole | null;
      page?: number;
      limit?: number;
      sorting?: MemberSortProperty[] | null;
    },
    requestOptions?: RequestOptions,
  ): AsyncGenerator<Member> {
    let page: number;
    page = query?.page ?? 1;
    let limit: number | undefined;
    limit = query?.limit;

    while (true) {
      const response = await listExternalMembers(client)(
        external_id,
        { ...query, page, limit },
        requestOptions,
      );
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
export const createExternalMembers = (client: ClientBase) => {
  /**
   * Create a new member for a customer identified by its external ID.
   *
   * **Scopes**: `members:write`
   *
   * @param external_id_path - The customer external ID.
   * @param body - Request body
   * @param requestOptions - Request options
   * @returns {Member}
   * @throws {PolarNetworkError} When a network error occurs
   * @throws {PolarRateLimitError} When the rate limit is exceeded
   * @throws {PolarServerError} When the server returns a 5xx error
   * @throws {NotPermitted} Not permitted to add members.
   * @throws {ResourceNotFound} Customer not found.
   * @throws {AmbiguousExternalCustomerID} The external customer ID matches customers in several accessible organizations.
   * @throws {HTTPValidationError} Validation Error
   */
  return async (
    external_id_path: string,
    body: MemberCreateFromCustomer,
    requestOptions?: RequestOptions,
  ): Promise<Member> => {
    const pathParams = {
      external_id: external_id_path,
    };
    const queryParams = {};
    const request = client.buildRequest(
      "POST",
      "/v1/customers/external/{external_id}/members",
      pathParams,
      queryParams,
      body,
    );
    const response = await client.sendRequest(request, requestOptions);
    return client.parseResponse<Member>(response, "json", {
      403: NotPermitted,
      404: ResourceNotFound,
      409: AmbiguousExternalCustomerID,
      422: HTTPValidationError,
    });
  };
};
export const getMembers = (client: ClientBase) => {
  /**
   * Get a member of a customer by its ID.
   *
   * **Scopes**: `members:read` `members:write`
   *
   * @param id - The customer ID.
   * @param member_id
   * @param requestOptions - Request options
   * @returns {Member}
   * @throws {PolarNetworkError} When a network error occurs
   * @throws {PolarRateLimitError} When the rate limit is exceeded
   * @throws {PolarServerError} When the server returns a 5xx error
   * @throws {ResourceNotFound} Member not found.
   * @throws {HTTPValidationError} Validation Error
   */
  return async (
    id: string,
    member_id: string,
    requestOptions?: RequestOptions,
  ): Promise<Member> => {
    const pathParams = {
      id: id,
      member_id: member_id,
    };
    const queryParams = {};
    const request = client.buildRequest(
      "GET",
      "/v1/customers/{id}/members/{member_id}",
      pathParams,
      queryParams,
      undefined,
    );
    const response = await client.sendRequest(request, requestOptions);
    return client.parseResponse<Member>(response, "json", {
      404: ResourceNotFound,
      422: HTTPValidationError,
    });
  };
};
export const deleteMembers = (client: ClientBase) => {
  /**
   * Delete a member of a customer.
   *
   * **Scopes**: `members:write`
   *
   * @param id - The customer ID.
   * @param member_id
   * @param requestOptions - Request options
   * @returns {void}
   * @throws {PolarNetworkError} When a network error occurs
   * @throws {PolarRateLimitError} When the rate limit is exceeded
   * @throws {PolarServerError} When the server returns a 5xx error
   * @throws {ResourceNotFound} Member not found.
   * @throws {HTTPValidationError} Validation Error
   */
  return async (id: string, member_id: string, requestOptions?: RequestOptions): Promise<void> => {
    const pathParams = {
      id: id,
      member_id: member_id,
    };
    const queryParams = {};
    const request = client.buildRequest(
      "DELETE",
      "/v1/customers/{id}/members/{member_id}",
      pathParams,
      queryParams,
      undefined,
    );
    const response = await client.sendRequest(request, requestOptions);
    return client.parseResponse<void>(response, "none", {
      404: ResourceNotFound,
      422: HTTPValidationError,
    });
  };
};
export const updateMembers = (client: ClientBase) => {
  /**
   * Update a member of a customer.
   *
   * Only name, email and role can be updated.
   *
   * **Scopes**: `members:write`
   *
   * @param id - The customer ID.
   * @param member_id
   * @param body - Request body
   * @param requestOptions - Request options
   * @returns {Member}
   * @throws {PolarNetworkError} When a network error occurs
   * @throws {PolarRateLimitError} When the rate limit is exceeded
   * @throws {PolarServerError} When the server returns a 5xx error
   * @throws {ResourceNotFound} Member not found.
   * @throws {HTTPValidationError} Validation Error
   */
  return async (
    id: string,
    member_id: string,
    body: MemberUpdate,
    requestOptions?: RequestOptions,
  ): Promise<Member> => {
    const pathParams = {
      id: id,
      member_id: member_id,
    };
    const queryParams = {};
    const request = client.buildRequest(
      "PATCH",
      "/v1/customers/{id}/members/{member_id}",
      pathParams,
      queryParams,
      body,
    );
    const response = await client.sendRequest(request, requestOptions);
    return client.parseResponse<Member>(response, "json", {
      404: ResourceNotFound,
      422: HTTPValidationError,
    });
  };
};
export const getExternalMembers = (client: ClientBase) => {
  /**
   * Get a member by external ID for a customer identified by its external ID.
   *
   * **Scopes**: `members:read` `members:write`
   *
   * @param external_id - The customer external ID.
   * @param member_external_id - The member external ID.
   * @param requestOptions - Request options
   * @returns {Member}
   * @throws {PolarNetworkError} When a network error occurs
   * @throws {PolarRateLimitError} When the rate limit is exceeded
   * @throws {PolarServerError} When the server returns a 5xx error
   * @throws {ResourceNotFound} Member not found.
   * @throws {AmbiguousExternalCustomerID} The external customer ID matches customers in several accessible organizations.
   * @throws {HTTPValidationError} Validation Error
   */
  return async (
    external_id: string,
    member_external_id: string,
    requestOptions?: RequestOptions,
  ): Promise<Member> => {
    const pathParams = {
      external_id: external_id,
      member_external_id: member_external_id,
    };
    const queryParams = {};
    const request = client.buildRequest(
      "GET",
      "/v1/customers/external/{external_id}/members/{member_external_id}",
      pathParams,
      queryParams,
      undefined,
    );
    const response = await client.sendRequest(request, requestOptions);
    return client.parseResponse<Member>(response, "json", {
      404: ResourceNotFound,
      409: AmbiguousExternalCustomerID,
      422: HTTPValidationError,
    });
  };
};
export const deleteExternalMembers = (client: ClientBase) => {
  /**
   * Delete a member by external ID for a customer identified by its external ID.
   *
   * **Scopes**: `members:write`
   *
   * @param external_id - The customer external ID.
   * @param member_external_id - The member external ID.
   * @param requestOptions - Request options
   * @returns {void}
   * @throws {PolarNetworkError} When a network error occurs
   * @throws {PolarRateLimitError} When the rate limit is exceeded
   * @throws {PolarServerError} When the server returns a 5xx error
   * @throws {ResourceNotFound} Member not found.
   * @throws {AmbiguousExternalCustomerID} The external customer ID matches customers in several accessible organizations.
   * @throws {HTTPValidationError} Validation Error
   */
  return async (
    external_id: string,
    member_external_id: string,
    requestOptions?: RequestOptions,
  ): Promise<void> => {
    const pathParams = {
      external_id: external_id,
      member_external_id: member_external_id,
    };
    const queryParams = {};
    const request = client.buildRequest(
      "DELETE",
      "/v1/customers/external/{external_id}/members/{member_external_id}",
      pathParams,
      queryParams,
      undefined,
    );
    const response = await client.sendRequest(request, requestOptions);
    return client.parseResponse<void>(response, "none", {
      404: ResourceNotFound,
      409: AmbiguousExternalCustomerID,
      422: HTTPValidationError,
    });
  };
};
export const updateExternalMembers = (client: ClientBase) => {
  /**
   * Update a member by external ID for a customer identified by its external ID.
   *
   * **Scopes**: `members:write`
   *
   * @param external_id - The customer external ID.
   * @param member_external_id - The member external ID.
   * @param body - Request body
   * @param requestOptions - Request options
   * @returns {Member}
   * @throws {PolarNetworkError} When a network error occurs
   * @throws {PolarRateLimitError} When the rate limit is exceeded
   * @throws {PolarServerError} When the server returns a 5xx error
   * @throws {ResourceNotFound} Member not found.
   * @throws {AmbiguousExternalCustomerID} The external customer ID matches customers in several accessible organizations.
   * @throws {HTTPValidationError} Validation Error
   */
  return async (
    external_id: string,
    member_external_id: string,
    body: MemberUpdate,
    requestOptions?: RequestOptions,
  ): Promise<Member> => {
    const pathParams = {
      external_id: external_id,
      member_external_id: member_external_id,
    };
    const queryParams = {};
    const request = client.buildRequest(
      "PATCH",
      "/v1/customers/external/{external_id}/members/{member_external_id}",
      pathParams,
      queryParams,
      body,
    );
    const response = await client.sendRequest(request, requestOptions);
    return client.parseResponse<Member>(response, "json", {
      404: ResourceNotFound,
      409: AmbiguousExternalCustomerID,
      422: HTTPValidationError,
    });
  };
};

export function createMembersService(client: ClientBase) {
  return {
    list: listMembers(client),
    create: createMembers(client),
    listExternal: listExternalMembers(client),
    createExternal: createExternalMembers(client),
    get: getMembers(client),
    delete: deleteMembers(client),
    update: updateMembers(client),
    getExternal: getExternalMembers(client),
    deleteExternal: deleteExternalMembers(client),
    updateExternal: updateExternalMembers(client),
    iterList: iterListMembers(client),
    iterListExternal: iterListExternalMembers(client),
  };
}

export type Members = ReturnType<typeof createMembersService>;
