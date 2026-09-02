import type { ClientBase, RequestOptions } from "../../../base";
import type {
  LicenseKeyActivate,
  LicenseKeyActivationRead,
  LicenseKeyDeactivate,
  LicenseKeyRead,
  LicenseKeyValidate,
  LicenseKeyWithActivations,
  ListResourceLicenseKeyRead,
  ValidatedLicenseKey,
} from "../../models";

import {
  HTTPValidationError,
  NotPermitted,
  ResourceNotFound,
  RotateNotPermitted,
  Unauthorized,
} from "../../errors";

export const listLicenseKeys = (client: ClientBase) => {
  /**
   * **Scopes**: `customer_portal:read` `customer_portal:write`
   *
   * @param query - Query parameters
   * @param requestOptions - Request options
   * @returns {ListResourceLicenseKeyRead}
   * @throws {PolarNetworkError} When a network error occurs
   * @throws {PolarRateLimitError} When the rate limit is exceeded
   * @throws {PolarServerError} When the server returns a 5xx error
   * @throws {Unauthorized} Not authorized to manage license key.
   * @throws {ResourceNotFound} License key not found.
   * @throws {HTTPValidationError} Validation Error
   */
  return async (
    query?: {
      benefit_id?: string | null;
      page?: number;
      limit?: number;
    },
    requestOptions?: RequestOptions,
  ): Promise<ListResourceLicenseKeyRead> => {
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
    const response = await client.sendRequest(request, requestOptions);
    return client.parseResponse<ListResourceLicenseKeyRead>(response, "json", {
      401: Unauthorized,
      404: ResourceNotFound,
      422: HTTPValidationError,
    });
  };
};
/**
 * **Scopes**: `customer_portal:read` `customer_portal:write`
 *
 * @param query - Query parameters
 * @param requestOptions - Request options
 * @returns {AsyncGenerator<LicenseKeyRead>} A generator that yields items of type LicenseKeyRead.
 * @throws {PolarNetworkError} When a network error occurs
 * @throws {PolarRateLimitError} When the rate limit is exceeded
 * @throws {PolarServerError} When the server returns a 5xx error
 * @throws {Unauthorized} Not authorized to manage license key.
 * @throws {ResourceNotFound} License key not found.
 * @throws {HTTPValidationError} Validation Error
 */
export const iterListLicenseKeys = (client: ClientBase) => {
  return async function* (
    query?: {
      benefit_id?: string | null;
      page?: number;
      limit?: number;
    },
    requestOptions?: RequestOptions,
  ): AsyncGenerator<LicenseKeyRead> {
    let page: number;
    page = query?.page ?? 1;
    let limit: number | undefined;
    limit = query?.limit;

    while (true) {
      const response = await listLicenseKeys(client)({ ...query, page, limit }, requestOptions);
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
   * **Scopes**: `customer_portal:read` `customer_portal:write`
   *
   * @param id
   * @param requestOptions - Request options
   * @returns {LicenseKeyWithActivations}
   * @throws {PolarNetworkError} When a network error occurs
   * @throws {PolarRateLimitError} When the rate limit is exceeded
   * @throws {PolarServerError} When the server returns a 5xx error
   * @throws {ResourceNotFound} License key not found.
   * @throws {HTTPValidationError} Validation Error
   */
  return async (
    id: string,
    requestOptions?: RequestOptions,
  ): Promise<LicenseKeyWithActivations> => {
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
    const response = await client.sendRequest(request, requestOptions);
    return client.parseResponse<LicenseKeyWithActivations>(response, "json", {
      404: ResourceNotFound,
      422: HTTPValidationError,
    });
  };
};
export const rotateLicenseKeys = (client: ClientBase) => {
  /**
   * Rotate a license key.
   *
   * Generates a new key string for the same license key record. The previous
   * key string immediately stops validating. Status, usage, limits, expiry,
   * and activations are preserved.
   *
   * **Scopes**: `customer_portal:write`
   *
   * @param id
   * @param requestOptions - Request options
   * @returns {LicenseKeyRead}
   * @throws {PolarNetworkError} When a network error occurs
   * @throws {PolarRateLimitError} When the rate limit is exceeded
   * @throws {PolarServerError} When the server returns a 5xx error
   * @throws {RotateNotPermitted} License key cannot be rotated in its current status. Allowed statuses: disabled, granted.
   * @throws {Unauthorized} Not authorized to manage license key.
   * @throws {ResourceNotFound} License key not found.
   * @throws {HTTPValidationError} Validation Error
   */
  return async (id: string, requestOptions?: RequestOptions): Promise<LicenseKeyRead> => {
    const pathParams = {
      id: id,
    };
    const queryParams = {};
    const request = client.buildRequest(
      "POST",
      "/v1/customer-portal/license-keys/{id}/rotate",
      pathParams,
      queryParams,
      undefined,
    );
    const response = await client.sendRequest(request, requestOptions);
    return client.parseResponse<LicenseKeyRead>(response, "json", {
      400: RotateNotPermitted,
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
   * > This endpoint doesn't require authentication and can be safely used on a public
   * > client, like a desktop application or a mobile app.
   * > If you plan to validate a license key on a server, use the `/v1/license-keys/validate`
   * > endpoint instead.
   *
   * @param body - Request body
   * @param requestOptions - Request options
   * @returns {ValidatedLicenseKey}
   * @throws {PolarNetworkError} When a network error occurs
   * @throws {PolarRateLimitError} When the rate limit is exceeded
   * @throws {PolarServerError} When the server returns a 5xx error
   * @throws {ResourceNotFound} License key not found.
   * @throws {HTTPValidationError} Validation Error
   */
  return async (
    body: LicenseKeyValidate,
    requestOptions?: RequestOptions,
  ): Promise<ValidatedLicenseKey> => {
    const pathParams = {};
    const queryParams = {};
    const request = client.buildRequest(
      "POST",
      "/v1/customer-portal/license-keys/validate",
      pathParams,
      queryParams,
      body,
    );
    const response = await client.sendRequest(request, requestOptions);
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
   * @param requestOptions - Request options
   * @returns {LicenseKeyActivationRead}
   * @throws {PolarNetworkError} When a network error occurs
   * @throws {PolarRateLimitError} When the rate limit is exceeded
   * @throws {PolarServerError} When the server returns a 5xx error
   * @throws {NotPermitted} License key activation not supported or limit reached. Use /validate endpoint for licenses without activations.
   * @throws {ResourceNotFound} License key not found.
   * @throws {HTTPValidationError} Validation Error
   */
  return async (
    body: LicenseKeyActivate,
    requestOptions?: RequestOptions,
  ): Promise<LicenseKeyActivationRead> => {
    const pathParams = {};
    const queryParams = {};
    const request = client.buildRequest(
      "POST",
      "/v1/customer-portal/license-keys/activate",
      pathParams,
      queryParams,
      body,
    );
    const response = await client.sendRequest(request, requestOptions);
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
   * @param requestOptions - Request options
   * @returns {void}
   * @throws {PolarNetworkError} When a network error occurs
   * @throws {PolarRateLimitError} When the rate limit is exceeded
   * @throws {PolarServerError} When the server returns a 5xx error
   * @throws {ResourceNotFound} License key not found.
   * @throws {HTTPValidationError} Validation Error
   */
  return async (body: LicenseKeyDeactivate, requestOptions?: RequestOptions): Promise<void> => {
    const pathParams = {};
    const queryParams = {};
    const request = client.buildRequest(
      "POST",
      "/v1/customer-portal/license-keys/deactivate",
      pathParams,
      queryParams,
      body,
    );
    const response = await client.sendRequest(request, requestOptions);
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
    rotate: rotateLicenseKeys(client),
    validate: validateLicenseKeys(client),
    activate: activateLicenseKeys(client),
    deactivate: deactivateLicenseKeys(client),
    iterList: iterListLicenseKeys(client),
  };
}

export type LicenseKeys = ReturnType<typeof createLicenseKeysService>;
