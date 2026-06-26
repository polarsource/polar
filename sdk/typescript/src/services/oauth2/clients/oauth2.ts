import { ClientBase } from "../../../base";
import type {
  OAuth2ClientConfiguration,
  OAuth2ClientConfigurationUpdate,
} from "../../../models/inputs";
import { HTTPValidationError } from "../../../errors";

export const createClientOauth2 = (client: ClientBase) => {
  /**
   * Create an OAuth2 client.
   *
   * @param body - Request body
   * @returns {unknown}
   * @throws {PolarNetworkError} When a network error occurs
   * @throws {PolarServerError} When the server returns a 5xx error
   * @throws {HTTPValidationError} Validation Error
   */
  return async (body: OAuth2ClientConfiguration): Promise<unknown> => {
    const pathParams = {};
    const queryParams = {};
    const request = client.buildRequest(
      "POST",
      "/v1/oauth2/register",
      pathParams,
      queryParams,
      body,
    );
    const response = await client.sendRequest(request);
    return client.parseResponse<unknown>(response, "json", {
      422: HTTPValidationError,
    });
  };
};
export const getClientOauth2 = (client: ClientBase) => {
  /**
   * Get an OAuth2 client by Client ID.
   *
   * @param client_id
   * @returns {unknown}
   * @throws {PolarNetworkError} When a network error occurs
   * @throws {PolarServerError} When the server returns a 5xx error
   * @throws {HTTPValidationError} Validation Error
   */
  return async (client_id: string): Promise<unknown> => {
    const pathParams = {
      client_id: client_id,
    };
    const queryParams = {};
    const request = client.buildRequest(
      "GET",
      "/v1/oauth2/register/{client_id}",
      pathParams,
      queryParams,
      undefined,
    );
    const response = await client.sendRequest(request);
    return client.parseResponse<unknown>(response, "json", {
      422: HTTPValidationError,
    });
  };
};
export const updateClientOauth2 = (client: ClientBase) => {
  /**
   * Update an OAuth2 client.
   *
   * @param client_id_path
   * @param body - Request body
   * @returns {unknown}
   * @throws {PolarNetworkError} When a network error occurs
   * @throws {PolarServerError} When the server returns a 5xx error
   * @throws {HTTPValidationError} Validation Error
   */
  return async (
    client_id_path: string,
    body: OAuth2ClientConfigurationUpdate,
  ): Promise<unknown> => {
    const pathParams = {
      client_id: client_id_path,
    };
    const queryParams = {};
    const request = client.buildRequest(
      "PUT",
      "/v1/oauth2/register/{client_id}",
      pathParams,
      queryParams,
      body,
    );
    const response = await client.sendRequest(request);
    return client.parseResponse<unknown>(response, "json", {
      422: HTTPValidationError,
    });
  };
};
export const deleteClientOauth2 = (client: ClientBase) => {
  /**
   * Delete an OAuth2 client.
   *
   * @param client_id
   * @returns {unknown}
   * @throws {PolarNetworkError} When a network error occurs
   * @throws {PolarServerError} When the server returns a 5xx error
   * @throws {HTTPValidationError} Validation Error
   */
  return async (client_id: string): Promise<unknown> => {
    const pathParams = {
      client_id: client_id,
    };
    const queryParams = {};
    const request = client.buildRequest(
      "DELETE",
      "/v1/oauth2/register/{client_id}",
      pathParams,
      queryParams,
      undefined,
    );
    const response = await client.sendRequest(request);
    return client.parseResponse<unknown>(response, "json", {
      422: HTTPValidationError,
    });
  };
};

export function createOauth2Service(client: ClientBase) {
  return {
    createClient: createClientOauth2(client),
    getClient: getClientOauth2(client),
    updateClient: updateClientOauth2(client),
    deleteClient: deleteClientOauth2(client),
  };
}

export type Oauth2 = ReturnType<typeof createOauth2Service>;
