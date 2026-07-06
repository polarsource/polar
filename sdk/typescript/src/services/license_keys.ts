import type { ClientBase } from "../base";
import type {
  LicenseKeyActivate,
  LicenseKeyDeactivate,
  LicenseKeyUpdate,
  LicenseKeyValidate,
} from "../models/inputs";
import type { LicenseKeyStatus } from "../models/literals";
import type {
  LicenseKeyActivationRead,
  LicenseKeyRead,
  LicenseKeyWithActivations,
  ListResourceLicenseKeyRead,
  ValidatedLicenseKey,
} from "../models/outputs";

import { HTTPValidationError, NotPermitted, ResourceNotFound, Unauthorized } from "../errors";

export const listLicenseKeys = (client: ClientBase) => {
  /**
   * Get license keys connected to the given organization & filters.
   *
   * **Scopes**: `license_keys:read` `license_keys:write`
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
    organization_id?: string | string[] | null;
    benefit_id?: string | string[] | null;
    status?: LicenseKeyStatus | LicenseKeyStatus[] | null;
    page?: number;
    limit?: number;
  }): Promise<ListResourceLicenseKeyRead> => {
    const pathParams = {};
    const queryParams = {
      organization_id: query?.organization_id,
      benefit_id: query?.benefit_id,
      status: query?.status,
      page: query?.page ?? 1,
      limit: query?.limit ?? 10,
    };
    const request = client.buildRequest(
      "GET",
      "/v1/license-keys/",
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
/**
 * Get license keys connected to the given organization & filters.
 *
 * **Scopes**: `license_keys:read` `license_keys:write`
 *
 * @param query - Query parameters
 * @returns {AsyncGenerator<LicenseKeyRead>} A generator that yields items of type LicenseKeyRead.
 * @throws {PolarNetworkError} When a network error occurs
 * @throws {PolarServerError} When the server returns a 5xx error
 * @throws {Unauthorized} Not authorized to manage license key.
 * @throws {ResourceNotFound} License key not found.
 * @throws {HTTPValidationError} Validation Error
 */
export const iterlistLicenseKeys = (client: ClientBase) => {
  return async function* (query?: {
    organization_id?: string | string[] | null;
    benefit_id?: string | string[] | null;
    status?: LicenseKeyStatus | LicenseKeyStatus[] | null;
    page?: number;
    limit?: number;
  }): AsyncGenerator<LicenseKeyRead> {
    let page: number;
    page = query?.page ?? 1;
    let limit: number | undefined;
    limit = query?.limit;

    while (true) {
      const response = await listLicenseKeys(client)({ ...query, page, limit });
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
export const getLicenseKeys = (client: ClientBase) => {
  /**
   * Get a license key.
   *
   * **Scopes**: `license_keys:read` `license_keys:write`
   *
   * @param id
   * @returns {LicenseKeyWithActivations}
   * @throws {PolarNetworkError} When a network error occurs
   * @throws {PolarServerError} When the server returns a 5xx error
   * @throws {Unauthorized} Not authorized to manage license key.
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
      "/v1/license-keys/{id}",
      pathParams,
      queryParams,
      undefined,
    );
    const response = await client.sendRequest(request);
    return client.parseResponse<LicenseKeyWithActivations>(response, "json", {
      401: Unauthorized,
      404: ResourceNotFound,
      422: HTTPValidationError,
    });
  };
};
export const updateLicenseKeys = (client: ClientBase) => {
  /**
   * Update a license key.
   *
   * **Scopes**: `license_keys:write`
   *
   * @param id
   * @param body - Request body
   * @returns {LicenseKeyRead}
   * @throws {PolarNetworkError} When a network error occurs
   * @throws {PolarServerError} When the server returns a 5xx error
   * @throws {Unauthorized} Not authorized to manage license key.
   * @throws {ResourceNotFound} License key not found.
   * @throws {HTTPValidationError} Validation Error
   */
  return async (id: string, body: LicenseKeyUpdate): Promise<LicenseKeyRead> => {
    const pathParams = {
      id: id,
    };
    const queryParams = {};
    const request = client.buildRequest(
      "PATCH",
      "/v1/license-keys/{id}",
      pathParams,
      queryParams,
      body,
    );
    const response = await client.sendRequest(request);
    return client.parseResponse<LicenseKeyRead>(response, "json", {
      401: Unauthorized,
      404: ResourceNotFound,
      422: HTTPValidationError,
    });
  };
};
export const getActivationLicenseKeys = (client: ClientBase) => {
  /**
   * Get a license key activation.
   *
   * **Scopes**: `license_keys:read` `license_keys:write`
   *
   * @param id
   * @param activation_id
   * @returns {LicenseKeyActivationRead}
   * @throws {PolarNetworkError} When a network error occurs
   * @throws {PolarServerError} When the server returns a 5xx error
   * @throws {Unauthorized} Not authorized to manage license key.
   * @throws {ResourceNotFound} License key not found.
   * @throws {HTTPValidationError} Validation Error
   */
  return async (id: string, activation_id: string): Promise<LicenseKeyActivationRead> => {
    const pathParams = {
      id: id,
      activation_id: activation_id,
    };
    const queryParams = {};
    const request = client.buildRequest(
      "GET",
      "/v1/license-keys/{id}/activations/{activation_id}",
      pathParams,
      queryParams,
      undefined,
    );
    const response = await client.sendRequest(request);
    return client.parseResponse<LicenseKeyActivationRead>(response, "json", {
      401: Unauthorized,
      404: ResourceNotFound,
      422: HTTPValidationError,
    });
  };
};
export const validateLicenseKeys = (client: ClientBase) => {
  /**
   * Validate a license key.
   *
   * **Scopes**: `license_keys:write`
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
      "/v1/license-keys/validate",
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
   * **Scopes**: `license_keys:write`
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
      "/v1/license-keys/activate",
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
   * **Scopes**: `license_keys:write`
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
      "/v1/license-keys/deactivate",
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
    update: updateLicenseKeys(client),
    getActivation: getActivationLicenseKeys(client),
    validate: validateLicenseKeys(client),
    activate: activateLicenseKeys(client),
    deactivate: deactivateLicenseKeys(client),
    iterlist: iterlistLicenseKeys(client),
  };
}

export type LicenseKeys = ReturnType<typeof createLicenseKeysService>;
