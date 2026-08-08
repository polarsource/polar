import type { ClientBase } from "../../../base";
import type {
  CustomerPortalMember,
  CustomerPortalMemberCreate,
  CustomerPortalMemberUpdate,
  ListResourceCustomerPortalMember,
} from "../../models";

import {
  CustomerPortalMembersAddMember400Error,
  CustomerPortalMembersAddMember401Error,
  CustomerPortalMembersAddMember403Error,
  CustomerPortalMembersListMembers401Error,
  CustomerPortalMembersListMembers403Error,
  CustomerPortalMembersRemoveMember400Error,
  CustomerPortalMembersRemoveMember401Error,
  CustomerPortalMembersRemoveMember403Error,
  CustomerPortalMembersRemoveMember404Error,
  CustomerPortalMembersUpdateMember400Error,
  CustomerPortalMembersUpdateMember401Error,
  CustomerPortalMembersUpdateMember403Error,
  CustomerPortalMembersUpdateMember404Error,
  HTTPValidationError,
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
   * @throws {CustomerPortalMembersListMembers401Error} Authentication required
   * @throws {CustomerPortalMembersListMembers403Error} Not permitted - requires owner or billing manager role
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
      401: CustomerPortalMembersListMembers401Error,
      403: CustomerPortalMembersListMembers403Error,
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
 * @throws {CustomerPortalMembersListMembers401Error} Authentication required
 * @throws {CustomerPortalMembersListMembers403Error} Not permitted - requires owner or billing manager role
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
   * @throws {CustomerPortalMembersAddMember400Error} Invalid request or member already exists.
   * @throws {CustomerPortalMembersAddMember401Error} Authentication required
   * @throws {CustomerPortalMembersAddMember403Error} Not permitted - requires owner or billing manager role
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
      400: CustomerPortalMembersAddMember400Error,
      401: CustomerPortalMembersAddMember401Error,
      403: CustomerPortalMembersAddMember403Error,
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
   * @throws {CustomerPortalMembersRemoveMember400Error} Cannot remove the only owner.
   * @throws {CustomerPortalMembersRemoveMember401Error} Authentication required
   * @throws {CustomerPortalMembersRemoveMember403Error} Not permitted - requires owner or billing manager role
   * @throws {CustomerPortalMembersRemoveMember404Error} Member not found.
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
      400: CustomerPortalMembersRemoveMember400Error,
      401: CustomerPortalMembersRemoveMember401Error,
      403: CustomerPortalMembersRemoveMember403Error,
      404: CustomerPortalMembersRemoveMember404Error,
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
   * @throws {CustomerPortalMembersUpdateMember400Error} Invalid role change.
   * @throws {CustomerPortalMembersUpdateMember401Error} Authentication required
   * @throws {CustomerPortalMembersUpdateMember403Error} Not permitted - requires owner or billing manager role
   * @throws {CustomerPortalMembersUpdateMember404Error} Member not found.
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
      400: CustomerPortalMembersUpdateMember400Error,
      401: CustomerPortalMembersUpdateMember401Error,
      403: CustomerPortalMembersUpdateMember403Error,
      404: CustomerPortalMembersUpdateMember404Error,
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
