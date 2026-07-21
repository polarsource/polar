import type { ClientBase } from "../../../base";
import type {
  CustomerPortalMember,
  CustomerPortalMemberCreate,
  CustomerPortalMemberUpdate,
  ListResourceCustomerPortalMember,
} from "../../models";

import {
  AddMember400Error,
  AddMember401Error,
  AddMember403Error,
  HTTPValidationError,
  ListMembers401Error,
  ListMembers403Error,
  RemoveMember400Error,
  RemoveMember401Error,
  RemoveMember403Error,
  RemoveMember404Error,
  UpdateMember400Error,
  UpdateMember401Error,
  UpdateMember403Error,
  UpdateMember404Error,
} from "../../errors";

export const listMembersMembers = (client: ClientBase) => {
  /**
   * List all members of the customer's team.
   *
   * Only available to owners and billing managers of team customers.
   *
   * @param query - Query parameters
   * @returns {ListResourceCustomerPortalMember}
   * @throws {PolarNetworkError} When a network error occurs
   * @throws {PolarRateLimitError} When the rate limit is exceeded
   * @throws {PolarServerError} When the server returns a 5xx error
   * @throws {ListMembers401Error} Authentication required
   * @throws {ListMembers403Error} Not permitted - requires owner or billing manager role
   * @throws {HTTPValidationError} Validation Error
   */
  return async (query?: {
    page?: number;
    limit?: number;
  }): Promise<ListResourceCustomerPortalMember> => {
    const pathParams = {};
    const queryParams = {
      page: query?.page ?? 1,
      limit: query?.limit ?? 10,
    };
    const request = client.buildRequest(
      "GET",
      "/v1/customer-portal/members",
      pathParams,
      queryParams,
      undefined,
    );
    const response = await client.sendRequest(request);
    return client.parseResponse<ListResourceCustomerPortalMember>(response, "json", {
      401: ListMembers401Error,
      403: ListMembers403Error,
      422: HTTPValidationError,
    });
  };
};
/**
 * List all members of the customer's team.
 *
 * Only available to owners and billing managers of team customers.
 *
 * @param query - Query parameters
 * @returns {AsyncGenerator<CustomerPortalMember>} A generator that yields items of type CustomerPortalMember.
 * @throws {PolarNetworkError} When a network error occurs
 * @throws {PolarRateLimitError} When the rate limit is exceeded
 * @throws {PolarServerError} When the server returns a 5xx error
 * @throws {ListMembers401Error} Authentication required
 * @throws {ListMembers403Error} Not permitted - requires owner or billing manager role
 * @throws {HTTPValidationError} Validation Error
 */
export const iterListMembersMembers = (client: ClientBase) => {
  return async function* (query?: {
    page?: number;
    limit?: number;
  }): AsyncGenerator<CustomerPortalMember> {
    let page: number;
    page = query?.page ?? 1;
    let limit: number | undefined;
    limit = query?.limit;

    while (true) {
      const response = await listMembersMembers(client)({ ...query, page, limit });
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
export const addMemberMembers = (client: ClientBase) => {
  /**
   * Add a new member to the customer's team.
   *
   * Only available to owners and billing managers of team customers.
   *
   * Rules:
   * - Cannot add a member with the owner role (there must be exactly one owner)
   * - If a member with this email already exists, the existing member is returned
   *
   * @param body - Request body
   * @returns {CustomerPortalMember}
   * @throws {PolarNetworkError} When a network error occurs
   * @throws {PolarRateLimitError} When the rate limit is exceeded
   * @throws {PolarServerError} When the server returns a 5xx error
   * @throws {AddMember400Error} Invalid request or member already exists.
   * @throws {AddMember401Error} Authentication required
   * @throws {AddMember403Error} Not permitted - requires owner or billing manager role
   * @throws {HTTPValidationError} Validation Error
   */
  return async (body: CustomerPortalMemberCreate): Promise<CustomerPortalMember> => {
    const pathParams = {};
    const queryParams = {};
    const request = client.buildRequest(
      "POST",
      "/v1/customer-portal/members",
      pathParams,
      queryParams,
      body,
    );
    const response = await client.sendRequest(request);
    return client.parseResponse<CustomerPortalMember>(response, "json", {
      400: AddMember400Error,
      401: AddMember401Error,
      403: AddMember403Error,
      422: HTTPValidationError,
    });
  };
};
export const removeMemberMembers = (client: ClientBase) => {
  /**
   * Remove a member from the team.
   *
   * Only available to owners and billing managers of team customers.
   *
   * Rules:
   * - Cannot remove yourself
   * - Cannot remove the only owner
   *
   * @param id
   * @returns {void}
   * @throws {PolarNetworkError} When a network error occurs
   * @throws {PolarRateLimitError} When the rate limit is exceeded
   * @throws {PolarServerError} When the server returns a 5xx error
   * @throws {RemoveMember400Error} Cannot remove the only owner.
   * @throws {RemoveMember401Error} Authentication required
   * @throws {RemoveMember403Error} Not permitted - requires owner or billing manager role
   * @throws {RemoveMember404Error} Member not found.
   * @throws {HTTPValidationError} Validation Error
   */
  return async (id: string): Promise<void> => {
    const pathParams = {
      id: id,
    };
    const queryParams = {};
    const request = client.buildRequest(
      "DELETE",
      "/v1/customer-portal/members/{id}",
      pathParams,
      queryParams,
      undefined,
    );
    const response = await client.sendRequest(request);
    return client.parseResponse<void>(response, "none", {
      400: RemoveMember400Error,
      401: RemoveMember401Error,
      403: RemoveMember403Error,
      404: RemoveMember404Error,
      422: HTTPValidationError,
    });
  };
};
export const updateMemberMembers = (client: ClientBase) => {
  /**
   * Update a member's name or role.
   *
   * Only available to owners and billing managers of team customers.
   *
   * Rules:
   * - Cannot modify your own role (to prevent self-demotion)
   * - Customer must have exactly one owner at all times
   *
   * @param id
   * @param body - Request body
   * @returns {CustomerPortalMember}
   * @throws {PolarNetworkError} When a network error occurs
   * @throws {PolarRateLimitError} When the rate limit is exceeded
   * @throws {PolarServerError} When the server returns a 5xx error
   * @throws {UpdateMember400Error} Invalid role change.
   * @throws {UpdateMember401Error} Authentication required
   * @throws {UpdateMember403Error} Not permitted - requires owner or billing manager role
   * @throws {UpdateMember404Error} Member not found.
   * @throws {HTTPValidationError} Validation Error
   */
  return async (id: string, body: CustomerPortalMemberUpdate): Promise<CustomerPortalMember> => {
    const pathParams = {
      id: id,
    };
    const queryParams = {};
    const request = client.buildRequest(
      "PATCH",
      "/v1/customer-portal/members/{id}",
      pathParams,
      queryParams,
      body,
    );
    const response = await client.sendRequest(request);
    return client.parseResponse<CustomerPortalMember>(response, "json", {
      400: UpdateMember400Error,
      401: UpdateMember401Error,
      403: UpdateMember403Error,
      404: UpdateMember404Error,
      422: HTTPValidationError,
    });
  };
};

export function createMembersService(client: ClientBase) {
  return {
    listMembers: listMembersMembers(client),
    addMember: addMemberMembers(client),
    removeMember: removeMemberMembers(client),
    updateMember: updateMemberMembers(client),
    iterListMembers: iterListMembersMembers(client),
  };
}

export type Members = ReturnType<typeof createMembersService>;
