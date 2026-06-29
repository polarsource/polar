import { ClientBase } from "../base";
import type { ListResourceMember } from "../models/outputs";
import type { MemberRole, MemberSortProperty } from "../models/literals";
import { HTTPValidationError } from "../errors";

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
      page: query?.page ?? 1,
      limit: query?.limit ?? 10,
      sorting: query?.sorting ?? ["-created_at"],
    };
    const request = client.buildRequest("GET", "/v1/members/", pathParams, queryParams, undefined);
    const response = await client.sendRequest(request);
    return client.parseResponse<ListResourceMember>(response, "json", {
      422: HTTPValidationError,
    });
  };
};

export function createMembersService(client: ClientBase) {
  return {
    listMembers: listMembersMembers(client),
  };
}

export type Members = ReturnType<typeof createMembersService>;
