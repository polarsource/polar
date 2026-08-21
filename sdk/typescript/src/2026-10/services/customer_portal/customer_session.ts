import type { ClientBase, RequestOptions } from "../../../base";
import type { CustomerCustomerSession, PortalAuthenticatedUser } from "../../models";

export const introspectCustomerSession = (client: ClientBase) => {
  /**
   * Introspect the current session and return its information.
   *
   * **Scopes**: `customer_portal:read` `customer_portal:write`
   *
   * @param requestOptions - Request options
   * @returns {CustomerCustomerSession}
   * @throws {PolarNetworkError} When a network error occurs
   * @throws {PolarRateLimitError} When the rate limit is exceeded
   * @throws {PolarServerError} When the server returns a 5xx error
   */
  return async (requestOptions?: RequestOptions): Promise<CustomerCustomerSession> => {
    const pathParams = {};
    const queryParams = {};
    const request = client.buildRequest(
      "GET",
      "/v1/customer-portal/customer-session/introspect",
      pathParams,
      queryParams,
      undefined,
    );
    const response = await client.sendRequest(request, requestOptions);
    return client.parseResponse<CustomerCustomerSession>(response, "json", {});
  };
};
export const getAuthenticatedUserCustomerSession = (client: ClientBase) => {
  /**
   * Get information about the currently authenticated portal user.
   *
   * **Scopes**: `customer_portal:read` `customer_portal:write`
   *
   * @param requestOptions - Request options
   * @returns {PortalAuthenticatedUser}
   * @throws {PolarNetworkError} When a network error occurs
   * @throws {PolarRateLimitError} When the rate limit is exceeded
   * @throws {PolarServerError} When the server returns a 5xx error
   */
  return async (requestOptions?: RequestOptions): Promise<PortalAuthenticatedUser> => {
    const pathParams = {};
    const queryParams = {};
    const request = client.buildRequest(
      "GET",
      "/v1/customer-portal/customer-session/user",
      pathParams,
      queryParams,
      undefined,
    );
    const response = await client.sendRequest(request, requestOptions);
    return client.parseResponse<PortalAuthenticatedUser>(response, "json", {});
  };
};

export function createCustomerSessionService(client: ClientBase) {
  return {
    introspect: introspectCustomerSession(client),
    getAuthenticatedUser: getAuthenticatedUserCustomerSession(client),
  };
}

export type CustomerSession = ReturnType<typeof createCustomerSessionService>;
