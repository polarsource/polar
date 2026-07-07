import type { ClientBase } from "../../base";
import type { CustomFieldCreate, CustomFieldUpdate } from "../models/inputs";
import type { CustomFieldSortProperty, CustomFieldType } from "../models/literals";
import type { CustomField, ListResourceCustomField } from "../models/outputs";

import { HTTPValidationError, ResourceNotFound } from "../errors";

export const listCustomFields = (client: ClientBase) => {
  /**
   * List custom fields.
   *
   * **Scopes**: `custom_fields:read` `custom_fields:write`
   *
   * @param query - Query parameters
   * @returns {ListResourceCustomField}
   * @throws {PolarNetworkError} When a network error occurs
   * @throws {PolarRateLimitError} When the rate limit is exceeded
   * @throws {PolarServerError} When the server returns a 5xx error
   * @throws {HTTPValidationError} Validation Error
   */
  return async (query?: {
    organization_id?: string | string[] | null;
    query?: string | null;
    type?: CustomFieldType | CustomFieldType[] | null;
    page?: number;
    limit?: number;
    sorting?: CustomFieldSortProperty[] | null;
  }): Promise<ListResourceCustomField> => {
    const pathParams = {};
    const queryParams = {
      organization_id: query?.organization_id,
      query: query?.query,
      type: query?.type,
      page: query?.page ?? 1,
      limit: query?.limit ?? 10,
      sorting: query?.sorting ?? ["slug"],
    };
    const request = client.buildRequest(
      "GET",
      "/v1/custom-fields/",
      pathParams,
      queryParams,
      undefined,
    );
    const response = await client.sendRequest(request);
    return client.parseResponse<ListResourceCustomField>(response, "json", {
      422: HTTPValidationError,
    });
  };
};
/**
 * List custom fields.
 *
 * **Scopes**: `custom_fields:read` `custom_fields:write`
 *
 * @param query - Query parameters
 * @returns {AsyncGenerator<CustomField>} A generator that yields items of type CustomField.
 * @throws {PolarNetworkError} When a network error occurs
 * @throws {PolarRateLimitError} When the rate limit is exceeded
 * @throws {PolarServerError} When the server returns a 5xx error
 * @throws {HTTPValidationError} Validation Error
 */
export const iterlistCustomFields = (client: ClientBase) => {
  return async function* (query?: {
    organization_id?: string | string[] | null;
    query?: string | null;
    type?: CustomFieldType | CustomFieldType[] | null;
    page?: number;
    limit?: number;
    sorting?: CustomFieldSortProperty[] | null;
  }): AsyncGenerator<CustomField> {
    let page: number;
    page = query?.page ?? 1;
    let limit: number | undefined;
    limit = query?.limit;

    while (true) {
      const response = await listCustomFields(client)({ ...query, page, limit });
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
export const createCustomFields = (client: ClientBase) => {
  /**
   * Create a custom field.
   *
   * **Scopes**: `custom_fields:write`
   *
   * @param body - Request body
   * @returns {CustomField}
   * @throws {PolarNetworkError} When a network error occurs
   * @throws {PolarRateLimitError} When the rate limit is exceeded
   * @throws {PolarServerError} When the server returns a 5xx error
   * @throws {HTTPValidationError} Validation Error
   */
  return async (body: CustomFieldCreate): Promise<CustomField> => {
    const pathParams = {};
    const queryParams = {};
    const request = client.buildRequest(
      "POST",
      "/v1/custom-fields/",
      pathParams,
      queryParams,
      body,
    );
    const response = await client.sendRequest(request);
    return client.parseResponse<CustomField>(response, "json", {
      422: HTTPValidationError,
    });
  };
};
export const getCustomFields = (client: ClientBase) => {
  /**
   * Get a custom field by ID.
   *
   * **Scopes**: `custom_fields:read` `custom_fields:write`
   *
   * @param id - The custom field ID.
   * @returns {CustomField}
   * @throws {PolarNetworkError} When a network error occurs
   * @throws {PolarRateLimitError} When the rate limit is exceeded
   * @throws {PolarServerError} When the server returns a 5xx error
   * @throws {ResourceNotFound} Custom field not found.
   * @throws {HTTPValidationError} Validation Error
   */
  return async (id: string): Promise<CustomField> => {
    const pathParams = {
      id: id,
    };
    const queryParams = {};
    const request = client.buildRequest(
      "GET",
      "/v1/custom-fields/{id}",
      pathParams,
      queryParams,
      undefined,
    );
    const response = await client.sendRequest(request);
    return client.parseResponse<CustomField>(response, "json", {
      404: ResourceNotFound,
      422: HTTPValidationError,
    });
  };
};
export const deleteCustomFields = (client: ClientBase) => {
  /**
   * Delete a custom field.
   *
   * **Scopes**: `custom_fields:write`
   *
   * @param id - The custom field ID.
   * @returns {void}
   * @throws {PolarNetworkError} When a network error occurs
   * @throws {PolarRateLimitError} When the rate limit is exceeded
   * @throws {PolarServerError} When the server returns a 5xx error
   * @throws {ResourceNotFound} Custom field not found.
   * @throws {HTTPValidationError} Validation Error
   */
  return async (id: string): Promise<void> => {
    const pathParams = {
      id: id,
    };
    const queryParams = {};
    const request = client.buildRequest(
      "DELETE",
      "/v1/custom-fields/{id}",
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
export const updateCustomFields = (client: ClientBase) => {
  /**
   * Update a custom field.
   *
   * **Scopes**: `custom_fields:write`
   *
   * @param id - The custom field ID.
   * @param body - Request body
   * @returns {CustomField}
   * @throws {PolarNetworkError} When a network error occurs
   * @throws {PolarRateLimitError} When the rate limit is exceeded
   * @throws {PolarServerError} When the server returns a 5xx error
   * @throws {ResourceNotFound} Custom field not found.
   * @throws {HTTPValidationError} Validation Error
   */
  return async (id: string, body: CustomFieldUpdate): Promise<CustomField> => {
    const pathParams = {
      id: id,
    };
    const queryParams = {};
    const request = client.buildRequest(
      "PATCH",
      "/v1/custom-fields/{id}",
      pathParams,
      queryParams,
      body,
    );
    const response = await client.sendRequest(request);
    return client.parseResponse<CustomField>(response, "json", {
      404: ResourceNotFound,
      422: HTTPValidationError,
    });
  };
};

export function createCustomFieldsService(client: ClientBase) {
  return {
    list: listCustomFields(client),
    create: createCustomFields(client),
    get: getCustomFields(client),
    delete: deleteCustomFields(client),
    update: updateCustomFields(client),
    iterlist: iterlistCustomFields(client),
  };
}

export type CustomFields = ReturnType<typeof createCustomFieldsService>;
