import type { ClientBase } from "../../../base";
import type {
  AuthorizeResponseOrganization,
  AuthorizeResponseUser,
  IntrospectTokenResponse,
  RevokeTokenResponse,
  TokenResponse,
  UserInfoOrganization,
  UserInfoUser,
} from "../../models";

import { createClientsService } from "./clients";

export const authorizeOauth2 = (client: ClientBase) => {
  /**
   *
   * @returns {AuthorizeResponseUser | AuthorizeResponseOrganization}
   * @throws {PolarNetworkError} When a network error occurs
   * @throws {PolarRateLimitError} When the rate limit is exceeded
   * @throws {PolarServerError} When the server returns a 5xx error
   */
  return async (): Promise<AuthorizeResponseUser | AuthorizeResponseOrganization> => {
    const pathParams = {};
    const queryParams = {};
    const request = client.buildRequest(
      "GET",
      "/v1/oauth2/authorize",
      pathParams,
      queryParams,
      undefined,
    );
    const response = await client.sendRequest(request);
    return client.parseResponse<AuthorizeResponseUser | AuthorizeResponseOrganization>(
      response,
      "json",
      {},
    );
  };
};
export const requestTokenOauth2 = (client: ClientBase) => {
  /**
   * Request an access token using a valid grant.
   *
   * @returns {TokenResponse}
   * @throws {PolarNetworkError} When a network error occurs
   * @throws {PolarRateLimitError} When the rate limit is exceeded
   * @throws {PolarServerError} When the server returns a 5xx error
   */
  return async (): Promise<TokenResponse> => {
    const pathParams = {};
    const queryParams = {};
    const request = client.buildRequest(
      "POST",
      "/v1/oauth2/token",
      pathParams,
      queryParams,
      undefined,
    );
    const response = await client.sendRequest(request);
    return client.parseResponse<TokenResponse>(response, "json", {});
  };
};
export const revokeTokenOauth2 = (client: ClientBase) => {
  /**
   * Revoke an access token or a refresh token.
   *
   * @returns {RevokeTokenResponse}
   * @throws {PolarNetworkError} When a network error occurs
   * @throws {PolarRateLimitError} When the rate limit is exceeded
   * @throws {PolarServerError} When the server returns a 5xx error
   */
  return async (): Promise<RevokeTokenResponse> => {
    const pathParams = {};
    const queryParams = {};
    const request = client.buildRequest(
      "POST",
      "/v1/oauth2/revoke",
      pathParams,
      queryParams,
      undefined,
    );
    const response = await client.sendRequest(request);
    return client.parseResponse<RevokeTokenResponse>(response, "json", {});
  };
};
export const introspectTokenOauth2 = (client: ClientBase) => {
  /**
   * Get information about an access token.
   *
   * @returns {IntrospectTokenResponse}
   * @throws {PolarNetworkError} When a network error occurs
   * @throws {PolarRateLimitError} When the rate limit is exceeded
   * @throws {PolarServerError} When the server returns a 5xx error
   */
  return async (): Promise<IntrospectTokenResponse> => {
    const pathParams = {};
    const queryParams = {};
    const request = client.buildRequest(
      "POST",
      "/v1/oauth2/introspect",
      pathParams,
      queryParams,
      undefined,
    );
    const response = await client.sendRequest(request);
    return client.parseResponse<IntrospectTokenResponse>(response, "json", {});
  };
};
export const userinfoOauth2 = (client: ClientBase) => {
  /**
   * Get information about the authenticated user.
   *
   * @returns {UserInfoUser | UserInfoOrganization}
   * @throws {PolarNetworkError} When a network error occurs
   * @throws {PolarRateLimitError} When the rate limit is exceeded
   * @throws {PolarServerError} When the server returns a 5xx error
   */
  return async (): Promise<UserInfoUser | UserInfoOrganization> => {
    const pathParams = {};
    const queryParams = {};
    const request = client.buildRequest(
      "GET",
      "/v1/oauth2/userinfo",
      pathParams,
      queryParams,
      undefined,
    );
    const response = await client.sendRequest(request);
    return client.parseResponse<UserInfoUser | UserInfoOrganization>(response, "json", {});
  };
};

export function createOauth2Service(client: ClientBase) {
  return {
    authorize: authorizeOauth2(client),
    requestToken: requestTokenOauth2(client),
    revokeToken: revokeTokenOauth2(client),
    introspectToken: introspectTokenOauth2(client),
    userinfo: userinfoOauth2(client),
    clients: createClientsService(client),
  };
}

export type Oauth2 = ReturnType<typeof createOauth2Service>;
