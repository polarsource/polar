import { ClientBase } from "../../base";
import type {
  LicenseKeyActivate,
  LicenseKeyDeactivate,
  LicenseKeyValidate,
} from "../../models/inputs";
import type {
  LicenseKeyActivationRead,
  LicenseKeyWithActivations,
  ListResourceLicenseKeyRead,
  ValidatedLicenseKey,
} from "../../models/outputs";
import { HTTPValidationError, NotPermitted, ResourceNotFound, Unauthorized } from "../../errors";

export const listLicenseKeys = (client: ClientBase) => {
  /**
   * **Scopes**: `customer_portal:read` `customer_portal:write`
   *
   * @param query - Query parameters
   * @returns {ListResourceLicenseKeyRead}
   * @throws {PolarNetworkError} When a network error occurs
   * @throws {PolarServerError} When the server returns a 5xx error
   * @throws {Unauthorized} Not authorized to manage license key.
   * @throws {ResourceNotFound} License key not found.
   * @throws {HTTPValidationError} Validation Error
   */
  return async (query?: {
    benefit_id?: string | null;
    page?: number;
    limit?: number;
  }): Promise<ListResourceLicenseKeyRead> => {
    const pathParams = {};
    const queryParams = {
      benefit_id: query?.benefit_id,
      page: query?.page ?? 1,
      limit: query?.limit ?? 10,
    };
    const request = client.buildRequest(
      "GET",
      "/v1/customer-portal/license-keys/",
      pathParams,
      queryParams,
      undefined,
    );
    const response = await client.sendRequest(request);
    return client.parseResponse<ListResourceLicenseKeyRead>(response, "json", {
      401: Unauthorized,
      404: ResourceNotFound,
      422: HTTPValidationError,
    });
  };
};
export const getLicenseKeys = (client: ClientBase) => {
  /**
   * Get a license key.
   *
   * **Scopes**: `customer_portal:read` `customer_portal:write`
   *
   * @param id
   * @returns {LicenseKeyWithActivations}
   * @throws {PolarNetworkError} When a network error occurs
   * @throws {PolarServerError} When the server returns a 5xx error
   * @throws {ResourceNotFound} License key not found.
   * @throws {HTTPValidationError} Validation Error
   */
  return async (id: string): Promise<LicenseKeyWithActivations> => {
    const pathParams = {
      id: id,
    };
    const queryParams = {};
    const request = client.buildRequest(
      "GET",
      "/v1/customer-portal/license-keys/{id}",
      pathParams,
      queryParams,
      undefined,
    );
    const response = await client.sendRequest(request);
    return client.parseResponse<LicenseKeyWithActivations>(response, "json", {
      404: ResourceNotFound,
      422: HTTPValidationError,
    });
  };
};
export const validateLicenseKeys = (client: ClientBase) => {
  /**
   * Validate a license key.
   *
   * > This endpoint doesn't require authentication and can be safely used on a public
   * > client, like a desktop application or a mobile app.
   * > If you plan to validate a license key on a server, use the `/v1/license-keys/validate`
   * > endpoint instead.
   *
   * @param body - Request body
   * @returns {ValidatedLicenseKey}
   * @throws {PolarNetworkError} When a network error occurs
   * @throws {PolarServerError} When the server returns a 5xx error
   * @throws {ResourceNotFound} License key not found.
   * @throws {HTTPValidationError} Validation Error
   */
  return async (body: LicenseKeyValidate): Promise<ValidatedLicenseKey> => {
    const pathParams = {};
    const queryParams = {};
    const request = client.buildRequest(
      "POST",
      "/v1/customer-portal/license-keys/validate",
      pathParams,
      queryParams,
      body,
    );
    const response = await client.sendRequest(request);
    return client.parseResponse<ValidatedLicenseKey>(response, "json", {
      404: ResourceNotFound,
      422: HTTPValidationError,
    });
  };
};
export const activateLicenseKeys = (client: ClientBase) => {
  /**
   * Activate a license key instance.
   *
   * > This endpoint doesn't require authentication and can be safely used on a public
   * > client, like a desktop application or a mobile app.
   * > If you plan to validate a license key on a server, use the `/v1/license-keys/activate`
   * > endpoint instead.
   *
   * @param body - Request body
   * @returns {LicenseKeyActivationRead}
   * @throws {PolarNetworkError} When a network error occurs
   * @throws {PolarServerError} When the server returns a 5xx error
   * @throws {NotPermitted} License key activation not supported or limit reached. Use /validate endpoint for licenses without activations.
   * @throws {ResourceNotFound} License key not found.
   * @throws {HTTPValidationError} Validation Error
   */
  return async (body: LicenseKeyActivate): Promise<LicenseKeyActivationRead> => {
    const pathParams = {};
    const queryParams = {};
    const request = client.buildRequest(
      "POST",
      "/v1/customer-portal/license-keys/activate",
      pathParams,
      queryParams,
      body,
    );
    const response = await client.sendRequest(request);
    return client.parseResponse<LicenseKeyActivationRead>(response, "json", {
      403: NotPermitted,
      404: ResourceNotFound,
      422: HTTPValidationError,
    });
  };
};
export const deactivateLicenseKeys = (client: ClientBase) => {
  /**
   * Deactivate a license key instance.
   *
   * > This endpoint doesn't require authentication and can be safely used on a public
   * > client, like a desktop application or a mobile app.
   * > If you plan to validate a license key on a server, use the `/v1/license-keys/deactivate`
   * > endpoint instead.
   *
   * @param body - Request body
   * @returns {void}
   * @throws {PolarNetworkError} When a network error occurs
   * @throws {PolarServerError} When the server returns a 5xx error
   * @throws {ResourceNotFound} License key not found.
   * @throws {HTTPValidationError} Validation Error
   */
  return async (body: LicenseKeyDeactivate): Promise<void> => {
    const pathParams = {};
    const queryParams = {};
    const request = client.buildRequest(
      "POST",
      "/v1/customer-portal/license-keys/deactivate",
      pathParams,
      queryParams,
      body,
    );
    const response = await client.sendRequest(request);
    return client.parseResponse<void>(response, "none", {
      404: ResourceNotFound,
      422: HTTPValidationError,
    });
  };
};

export function createLicenseKeysService(client: ClientBase) {
  return {
    list: listLicenseKeys(client),
    get: getLicenseKeys(client),
    validate: validateLicenseKeys(client),
    activate: activateLicenseKeys(client),
    deactivate: deactivateLicenseKeys(client),
  };
}

export type LicenseKeys = ReturnType<typeof createLicenseKeysService>;
