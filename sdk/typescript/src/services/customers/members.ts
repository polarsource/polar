import type { ClientBase } from "../../base";
import type { MemberCreateFromCustomer, MemberUpdate } from "../../models/inputs";
import type { Member } from "../../models/outputs";

import {
  AmbiguousExternalCustomerID,
  HTTPValidationError,
  NotPermitted,
  ResourceNotFound,
} from "../../errors";

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
   * @returns {Member}
   * @throws {PolarNetworkError} When a network error occurs
   * @throws {PolarRateLimitError} When the rate limit is exceeded
   * @throws {PolarServerError} When the server returns a 5xx error
   * @throws {NotPermitted} Not permitted to add members.
   * @throws {ResourceNotFound} Customer not found.
   * @throws {HTTPValidationError} Validation Error
   */
  return async (id: string, body: MemberCreateFromCustomer): Promise<Member> => {
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
    const response = await client.sendRequest(request);
    return client.parseResponse<Member>(response, "json", {
      403: NotPermitted,
      404: ResourceNotFound,
      422: HTTPValidationError,
    });
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
   * @returns {Member}
   * @throws {PolarNetworkError} When a network error occurs
   * @throws {PolarRateLimitError} When the rate limit is exceeded
   * @throws {PolarServerError} When the server returns a 5xx error
   * @throws {NotPermitted} Not permitted to add members.
   * @throws {ResourceNotFound} Customer not found.
   * @throws {AmbiguousExternalCustomerID} The external customer ID matches customers in several accessible organizations.
   * @throws {HTTPValidationError} Validation Error
   */
  return async (external_id_path: string, body: MemberCreateFromCustomer): Promise<Member> => {
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
    const response = await client.sendRequest(request);
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
   * @returns {Member}
   * @throws {PolarNetworkError} When a network error occurs
   * @throws {PolarRateLimitError} When the rate limit is exceeded
   * @throws {PolarServerError} When the server returns a 5xx error
   * @throws {ResourceNotFound} Member not found.
   * @throws {HTTPValidationError} Validation Error
   */
  return async (id: string, member_id: string): Promise<Member> => {
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
    const response = await client.sendRequest(request);
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
   * @returns {void}
   * @throws {PolarNetworkError} When a network error occurs
   * @throws {PolarRateLimitError} When the rate limit is exceeded
   * @throws {PolarServerError} When the server returns a 5xx error
   * @throws {ResourceNotFound} Member not found.
   * @throws {HTTPValidationError} Validation Error
   */
  return async (id: string, member_id: string): Promise<void> => {
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
    const response = await client.sendRequest(request);
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
   * @returns {Member}
   * @throws {PolarNetworkError} When a network error occurs
   * @throws {PolarRateLimitError} When the rate limit is exceeded
   * @throws {PolarServerError} When the server returns a 5xx error
   * @throws {ResourceNotFound} Member not found.
   * @throws {HTTPValidationError} Validation Error
   */
  return async (id: string, member_id: string, body: MemberUpdate): Promise<Member> => {
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
    const response = await client.sendRequest(request);
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
   * @returns {Member}
   * @throws {PolarNetworkError} When a network error occurs
   * @throws {PolarRateLimitError} When the rate limit is exceeded
   * @throws {PolarServerError} When the server returns a 5xx error
   * @throws {ResourceNotFound} Member not found.
   * @throws {AmbiguousExternalCustomerID} The external customer ID matches customers in several accessible organizations.
   * @throws {HTTPValidationError} Validation Error
   */
  return async (external_id: string, member_external_id: string): Promise<Member> => {
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
    const response = await client.sendRequest(request);
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
   * @returns {void}
   * @throws {PolarNetworkError} When a network error occurs
   * @throws {PolarRateLimitError} When the rate limit is exceeded
   * @throws {PolarServerError} When the server returns a 5xx error
   * @throws {ResourceNotFound} Member not found.
   * @throws {AmbiguousExternalCustomerID} The external customer ID matches customers in several accessible organizations.
   * @throws {HTTPValidationError} Validation Error
   */
  return async (external_id: string, member_external_id: string): Promise<void> => {
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
    const response = await client.sendRequest(request);
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
    const response = await client.sendRequest(request);
    return client.parseResponse<Member>(response, "json", {
      404: ResourceNotFound,
      409: AmbiguousExternalCustomerID,
      422: HTTPValidationError,
    });
  };
};

export function createMembersService(client: ClientBase) {
  return {
    create: createMembers(client),
    createExternal: createExternalMembers(client),
    get: getMembers(client),
    delete: deleteMembers(client),
    update: updateMembers(client),
    getExternal: getExternalMembers(client),
    deleteExternal: deleteExternalMembers(client),
    updateExternal: updateExternalMembers(client),
  };
}

export type Members = ReturnType<typeof createMembersService>;
