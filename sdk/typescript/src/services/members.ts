import { ClientBase } from "../base";
import type { MemberCreate, MemberUpdate } from "../models/inputs";
import type { ListResourceMember, Member } from "../models/outputs";
import type { MemberRole, MemberSortProperty } from "../models/literals";
import { CreateMember403Error, HTTPValidationError, ResourceNotFound } from "../errors";

export const listMembersMembers = (client: ClientBase) => {
  /**
   * List members with optional customer ID filter.
   *
   * **Scopes**: `members:read` `members:write`
   *
   * @param query - Query parameters
   * @returns {ListResourceMember}
   * @throws {PolarNetworkError} When a network error occurs
   * @throws {PolarServerError} When the server returns a 5xx error
   * @throws {HTTPValidationError} Validation Error
   */
  return async (query?: {
    customer_id?: string | null;
    external_customer_id?: string | null;
    role?: MemberRole | null;
    page?: number;
    limit?: number;
    sorting?: MemberSortProperty[] | null;
  }): Promise<ListResourceMember> => {
    const pathParams = {};
    const queryParams = {
      customer_id: query?.customer_id,
      external_customer_id: query?.external_customer_id,
      role: query?.role,
      page: query?.page || 1,
      limit: query?.limit || 10,
      sorting: query?.sorting || ["-created_at"],
    };
    const request = client.buildRequest("GET", "/v1/members/", pathParams, queryParams, undefined);
    const response = await client.sendRequest(request);
    return client.parseResponse<ListResourceMember>(response, "json", {
      422: HTTPValidationError,
    });
  };
};
export const createMemberMembers = (client: ClientBase) => {
  /**
   * Create a new member for a customer.
   *
   * Only B2B customers with the member management feature enabled can add members.
   * The authenticated user or organization must have access to the customer's organization.
   *
   * **Scopes**: `members:write`
   *
   * @param body - Request body
   * @returns {Member}
   * @throws {PolarNetworkError} When a network error occurs
   * @throws {PolarServerError} When the server returns a 5xx error
   * @throws {CreateMember403Error} Not permitted to add members.
   * @throws {ResourceNotFound} Member not found.
   * @throws {HTTPValidationError} Validation Error
   */
  return async (body: MemberCreate): Promise<Member> => {
    const pathParams = {};
    const queryParams = {};
    const request = client.buildRequest("POST", "/v1/members/", pathParams, queryParams, body);
    const response = await client.sendRequest(request);
    return client.parseResponse<Member>(response, "json", {
      403: CreateMember403Error,
      404: ResourceNotFound,
      422: HTTPValidationError,
    });
  };
};
export const getMemberMembers = (client: ClientBase) => {
  /**
   * Get a member by ID.
   *
   * The authenticated user or organization must have access to the member's organization.
   *
   * **Scopes**: `members:read` `members:write`
   *
   * @param id
   * @returns {Member}
   * @throws {PolarNetworkError} When a network error occurs
   * @throws {PolarServerError} When the server returns a 5xx error
   * @throws {ResourceNotFound} Member not found.
   * @throws {HTTPValidationError} Validation Error
   */
  return async (id: string): Promise<Member> => {
    const pathParams = {
      id: id,
    };
    const queryParams = {};
    const request = client.buildRequest(
      "GET",
      "/v1/members/{id}",
      pathParams,
      queryParams,
      undefined,
    );
    const response = await client.sendRequest(request);
    return client.parseResponse<Member>(response, "json", {
      404: ResourceNotFound,
      422: HTTPValidationError,
    });
  };
};
export const deleteMemberMembers = (client: ClientBase) => {
  /**
   * Delete a member.
   *
   * The authenticated user or organization must have access to the member's organization.
   *
   * **Scopes**: `members:write`
   *
   * @param id
   * @returns {void}
   * @throws {PolarNetworkError} When a network error occurs
   * @throws {PolarServerError} When the server returns a 5xx error
   * @throws {ResourceNotFound} Member not found.
   * @throws {HTTPValidationError} Validation Error
   */
  return async (id: string): Promise<void> => {
    const pathParams = {
      id: id,
    };
    const queryParams = {};
    const request = client.buildRequest(
      "DELETE",
      "/v1/members/{id}",
      pathParams,
      queryParams,
      undefined,
    );
    const response = await client.sendRequest(request);
    return client.parseResponse<void>(response, "none", {
      404: ResourceNotFound,
      422: HTTPValidationError,
    });
  };
};
export const updateMemberMembers = (client: ClientBase) => {
  /**
   * Update a member.
   *
   * Only name, email and role can be updated.
   * The authenticated user or organization must have access to the member's organization.
   *
   * **Scopes**: `members:write`
   *
   * @param id
   * @param body - Request body
   * @returns {Member}
   * @throws {PolarNetworkError} When a network error occurs
   * @throws {PolarServerError} When the server returns a 5xx error
   * @throws {ResourceNotFound} Member not found.
   * @throws {HTTPValidationError} Validation Error
   */
  return async (id: string, body: MemberUpdate): Promise<Member> => {
    const pathParams = {
      id: id,
    };
    const queryParams = {};
    const request = client.buildRequest("PATCH", "/v1/members/{id}", pathParams, queryParams, body);
    const response = await client.sendRequest(request);
    return client.parseResponse<Member>(response, "json", {
      404: ResourceNotFound,
      422: HTTPValidationError,
    });
  };
};
export const getMemberByExternalIdMembers = (client: ClientBase) => {
  /**
   * Get a member by external ID. One of customer_id or external_customer_id must be specified.
   *
   * **Scopes**: `members:read` `members:write`
   *
   * @param external_id - The member external ID.
   * @param query - Query parameters
   * @returns {Member}
   * @throws {PolarNetworkError} When a network error occurs
   * @throws {PolarServerError} When the server returns a 5xx error
   * @throws {ResourceNotFound} Member not found.
   * @throws {HTTPValidationError} Validation Error
   */
  return async (
    external_id: string,
    query?: {
      customer_id?: string | null;
      external_customer_id?: string | null;
    },
  ): Promise<Member> => {
    const pathParams = {
      external_id: external_id,
    };
    const queryParams = {
      customer_id: query?.customer_id,
      external_customer_id: query?.external_customer_id,
    };
    const request = client.buildRequest(
      "GET",
      "/v1/members/external/{external_id}",
      pathParams,
      queryParams,
      undefined,
    );
    const response = await client.sendRequest(request);
    return client.parseResponse<Member>(response, "json", {
      404: ResourceNotFound,
      422: HTTPValidationError,
    });
  };
};
export const deleteMemberByExternalIdMembers = (client: ClientBase) => {
  /**
   * Delete a member by external ID. One of customer_id or external_customer_id must be specified.
   *
   * **Scopes**: `members:write`
   *
   * @param external_id - The member external ID.
   * @param query - Query parameters
   * @returns {void}
   * @throws {PolarNetworkError} When a network error occurs
   * @throws {PolarServerError} When the server returns a 5xx error
   * @throws {ResourceNotFound} Member not found.
   * @throws {HTTPValidationError} Validation Error
   */
  return async (
    external_id: string,
    query?: {
      customer_id?: string | null;
      external_customer_id?: string | null;
    },
  ): Promise<void> => {
    const pathParams = {
      external_id: external_id,
    };
    const queryParams = {
      customer_id: query?.customer_id,
      external_customer_id: query?.external_customer_id,
    };
    const request = client.buildRequest(
      "DELETE",
      "/v1/members/external/{external_id}",
      pathParams,
      queryParams,
      undefined,
    );
    const response = await client.sendRequest(request);
    return client.parseResponse<void>(response, "none", {
      404: ResourceNotFound,
      422: HTTPValidationError,
    });
  };
};
export const updateMemberByExternalIdMembers = (client: ClientBase) => {
  /**
   * Update a member by external ID. One of customer_id or external_customer_id must be specified.
   *
   * **Scopes**: `members:write`
   *
   * @param external_id - The member external ID.
   * @param query - Query parameters
   * @param body - Request body
   * @returns {Member}
   * @throws {PolarNetworkError} When a network error occurs
   * @throws {PolarServerError} When the server returns a 5xx error
   * @throws {ResourceNotFound} Member not found.
   * @throws {HTTPValidationError} Validation Error
   */
  return async (
    external_id: string,
    query?: {
      customer_id?: string | null;
      external_customer_id?: string | null;
    },
    body: MemberUpdate,
  ): Promise<Member> => {
    const pathParams = {
      external_id: external_id,
    };
    const queryParams = {
      customer_id: query?.customer_id,
      external_customer_id: query?.external_customer_id,
    };
    const request = client.buildRequest(
      "PATCH",
      "/v1/members/external/{external_id}",
      pathParams,
      queryParams,
      body,
    );
    const response = await client.sendRequest(request);
    return client.parseResponse<Member>(response, "json", {
      404: ResourceNotFound,
      422: HTTPValidationError,
    });
  };
};

export function createMembersService(client: ClientBase) {
  return {
    listMembers: listMembersMembers(client),
    createMember: createMemberMembers(client),
    getMember: getMemberMembers(client),
    deleteMember: deleteMemberMembers(client),
    updateMember: updateMemberMembers(client),
    getMemberByExternalId: getMemberByExternalIdMembers(client),
    deleteMemberByExternalId: deleteMemberByExternalIdMembers(client),
    updateMemberByExternalId: updateMemberByExternalIdMembers(client),
  };
}

export type Members = ReturnType<typeof createMembersService>;
