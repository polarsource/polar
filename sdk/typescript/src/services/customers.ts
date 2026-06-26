import { ClientBase } from "../base";
import type {
  CustomerCreate,
  CustomerUpdate,
  CustomerUpdateExternalID,
  MetadataQuery,
} from "../models/inputs";
import type {
  Customer,
  CustomerState,
  ListResourceCustomer,
  ListResourcePaymentMethod,
} from "../models/outputs";
import type { CustomerSortProperty } from "../models/literals";
import { HTTPValidationError, ResourceNotFound } from "../errors";

export const listCustomers = (client: ClientBase) => {
  /**
   * List customers.
   *
   * **Scopes**: `customers:read` `customers:write`
   *
   * @param query - Query parameters
   * @returns {ListResourceCustomer}
   * @throws {PolarNetworkError} When a network error occurs
   * @throws {PolarServerError} When the server returns a 5xx error
   * @throws {HTTPValidationError} Validation Error
   */
  return async (query?: {
    organization_id?: string | string[] | null;
    email?: string | null;
    query?: string | null;
    active?: boolean | null;
    page?: number;
    limit?: number;
    sorting?: CustomerSortProperty[] | null;
    metadata?: MetadataQuery;
  }): Promise<ListResourceCustomer> => {
    const pathParams = {};
    const queryParams = {
      organization_id: query?.organization_id,
      email: query?.email,
      query: query?.query,
      active: query?.active,
      page: query?.page || 1,
      limit: query?.limit || 10,
      sorting: query?.sorting || ["-created_at"],
      metadata: query?.metadata,
    };
    const request = client.buildRequest(
      "GET",
      "/v1/customers/",
      pathParams,
      queryParams,
      undefined,
    );
    const response = await client.sendRequest(request);
    return client.parseResponse<ListResourceCustomer>(response, "json", {
      422: HTTPValidationError,
    });
  };
};
export const createCustomers = (client: ClientBase) => {
  /**
   * Create a customer.
   *
   * **Scopes**: `customers:write`
   *
   * @param body - Request body* @returns {Customer}
   * @throws {PolarNetworkError} When a network error occurs
   * @throws {PolarServerError} When the server returns a 5xx error
   * @throws {HTTPValidationError} Validation Error
   */
  return async (body?: CustomerCreate): Promise<Customer> => {
    const pathParams = {};
    const queryParams = {};
    const request = client.buildRequest("POST", "/v1/customers/", pathParams, queryParams, body);
    const response = await client.sendRequest(request);
    return client.parseResponse<Customer>(response, "json", {
      422: HTTPValidationError,
    });
  };
};
export const exportCustomers = (client: ClientBase) => {
  /**
   * Export customers as a CSV file.
   *
   * **Scopes**: `customers:read` `customers:write`
   *
   * @param query - Query parameters
   * @returns {string}
   * @throws {PolarNetworkError} When a network error occurs
   * @throws {PolarServerError} When the server returns a 5xx error
   * @throws {HTTPValidationError} Validation Error
   */
  return async (query?: { organization_id?: string | string[] | null }): Promise<string> => {
    const pathParams = {};
    const queryParams = {
      organization_id: query?.organization_id,
    };
    const request = client.buildRequest(
      "GET",
      "/v1/customers/export",
      pathParams,
      queryParams,
      undefined,
    );
    const response = await client.sendRequest(request);
    return client.parseResponse<string>(response, "text", {
      422: HTTPValidationError,
    });
  };
};
export const getCustomers = (client: ClientBase) => {
  /**
   * Get a customer by ID.
   *
   * **Scopes**: `customers:read` `customers:write`
   *
   * @param id - The customer ID.
   * @returns {Customer}
   * @throws {PolarNetworkError} When a network error occurs
   * @throws {PolarServerError} When the server returns a 5xx error
   * @throws {ResourceNotFound} Customer not found.
   * @throws {HTTPValidationError} Validation Error
   */
  return async (id: string): Promise<Customer> => {
    const pathParams = {
      id: id,
    };
    const queryParams = {};
    const request = client.buildRequest(
      "GET",
      "/v1/customers/{id}",
      pathParams,
      queryParams,
      undefined,
    );
    const response = await client.sendRequest(request);
    return client.parseResponse<Customer>(response, "json", {
      404: ResourceNotFound,
      422: HTTPValidationError,
    });
  };
};
export const deleteCustomers = (client: ClientBase) => {
  /**
   * Delete a customer.
   *
   * This action cannot be undone and will immediately:
   * - Cancel any active subscriptions for the customer
   * - Revoke all their benefits
   * - Clear any `external_id`
   *
   * Use it only in the context of deleting a user within your
   * own service. Otherwise, use more granular API endpoints to cancel
   * a specific subscription or revoke certain benefits.
   *
   * Note: The customers information will nonetheless be retained for historic
   * orders and subscriptions.
   *
   * Set `anonymize=true` to also anonymize PII for GDPR compliance.
   *
   * **Scopes**: `customers:write`
   *
   * @param id - The customer ID.
   * @param query - Query parameters
   * @returns {void}
   * @throws {PolarNetworkError} When a network error occurs
   * @throws {PolarServerError} When the server returns a 5xx error
   * @throws {ResourceNotFound} Customer not found.
   * @throws {HTTPValidationError} Validation Error
   */
  return async (
    id: string,
    query?: {
      anonymize?: boolean;
    },
  ): Promise<void> => {
    const pathParams = {
      id: id,
    };
    const queryParams = {
      anonymize: query?.anonymize,
    };
    const request = client.buildRequest(
      "DELETE",
      "/v1/customers/{id}",
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
export const updateCustomers = (client: ClientBase) => {
  /**
   * Update a customer.
   *
   * **Scopes**: `customers:write`
   *
   * @param id - The customer ID.
   * @param body - Request body* @returns {Customer}
   * @throws {PolarNetworkError} When a network error occurs
   * @throws {PolarServerError} When the server returns a 5xx error
   * @throws {ResourceNotFound} Customer not found.
   * @throws {HTTPValidationError} Validation Error
   */
  return async (id: string, body?: CustomerUpdate): Promise<Customer> => {
    const pathParams = {
      id: id,
    };
    const queryParams = {};
    const request = client.buildRequest(
      "PATCH",
      "/v1/customers/{id}",
      pathParams,
      queryParams,
      body,
    );
    const response = await client.sendRequest(request);
    return client.parseResponse<Customer>(response, "json", {
      404: ResourceNotFound,
      422: HTTPValidationError,
    });
  };
};
export const getExternalCustomers = (client: ClientBase) => {
  /**
   * Get a customer by external ID.
   *
   * **Scopes**: `customers:read` `customers:write`
   *
   * @param external_id - The customer external ID.
   * @returns {Customer}
   * @throws {PolarNetworkError} When a network error occurs
   * @throws {PolarServerError} When the server returns a 5xx error
   * @throws {ResourceNotFound} Customer not found.
   * @throws {HTTPValidationError} Validation Error
   */
  return async (external_id: string): Promise<Customer> => {
    const pathParams = {
      external_id: external_id,
    };
    const queryParams = {};
    const request = client.buildRequest(
      "GET",
      "/v1/customers/external/{external_id}",
      pathParams,
      queryParams,
      undefined,
    );
    const response = await client.sendRequest(request);
    return client.parseResponse<Customer>(response, "json", {
      404: ResourceNotFound,
      422: HTTPValidationError,
    });
  };
};
export const deleteExternalCustomers = (client: ClientBase) => {
  /**
   * Delete a customer by external ID.
   *
   * Immediately cancels any active subscriptions and revokes any active benefits.
   *
   * Set `anonymize=true` to also anonymize PII for GDPR compliance.
   *
   * **Scopes**: `customers:write`
   *
   * @param external_id - The customer external ID.
   * @param query - Query parameters
   * @returns {void}
   * @throws {PolarNetworkError} When a network error occurs
   * @throws {PolarServerError} When the server returns a 5xx error
   * @throws {ResourceNotFound} Customer not found.
   * @throws {HTTPValidationError} Validation Error
   */
  return async (
    external_id: string,
    query?: {
      anonymize?: boolean;
    },
  ): Promise<void> => {
    const pathParams = {
      external_id: external_id,
    };
    const queryParams = {
      anonymize: query?.anonymize,
    };
    const request = client.buildRequest(
      "DELETE",
      "/v1/customers/external/{external_id}",
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
export const updateExternalCustomers = (client: ClientBase) => {
  /**
   * Update a customer by external ID.
   *
   * **Scopes**: `customers:write`
   *
   * @param external_id - The customer external ID.
   * @param body - Request body* @returns {Customer}
   * @throws {PolarNetworkError} When a network error occurs
   * @throws {PolarServerError} When the server returns a 5xx error
   * @throws {ResourceNotFound} Customer not found.
   * @throws {HTTPValidationError} Validation Error
   */
  return async (external_id: string, body?: CustomerUpdateExternalID): Promise<Customer> => {
    const pathParams = {
      external_id: external_id,
    };
    const queryParams = {};
    const request = client.buildRequest(
      "PATCH",
      "/v1/customers/external/{external_id}",
      pathParams,
      queryParams,
      body,
    );
    const response = await client.sendRequest(request);
    return client.parseResponse<Customer>(response, "json", {
      404: ResourceNotFound,
      422: HTTPValidationError,
    });
  };
};
export const getStateCustomers = (client: ClientBase) => {
  /**
   * Get a customer state by ID.
   *
   * The customer state includes information about
   * the customer's active subscriptions and benefits.
   *
   * It's the ideal endpoint to use when you need to get a full overview
   * of a customer's status.
   *
   * **Scopes**: `customers:read` `customers:write`
   *
   * @param id - The customer ID.
   * @returns {CustomerState}
   * @throws {PolarNetworkError} When a network error occurs
   * @throws {PolarServerError} When the server returns a 5xx error
   * @throws {ResourceNotFound} Customer not found.
   * @throws {HTTPValidationError} Validation Error
   */
  return async (id: string): Promise<CustomerState> => {
    const pathParams = {
      id: id,
    };
    const queryParams = {};
    const request = client.buildRequest(
      "GET",
      "/v1/customers/{id}/state",
      pathParams,
      queryParams,
      undefined,
    );
    const response = await client.sendRequest(request);
    return client.parseResponse<CustomerState>(response, "json", {
      404: ResourceNotFound,
      422: HTTPValidationError,
    });
  };
};
export const getStateExternalCustomers = (client: ClientBase) => {
  /**
   * Get a customer state by external ID.
   *
   * The customer state includes information about
   * the customer's active subscriptions and benefits.
   *
   * It's the ideal endpoint to use when you need to get a full overview
   * of a customer's status.
   *
   * **Scopes**: `customers:read` `customers:write`
   *
   * @param external_id - The customer external ID.
   * @returns {CustomerState}
   * @throws {PolarNetworkError} When a network error occurs
   * @throws {PolarServerError} When the server returns a 5xx error
   * @throws {ResourceNotFound} Customer not found.
   * @throws {HTTPValidationError} Validation Error
   */
  return async (external_id: string): Promise<CustomerState> => {
    const pathParams = {
      external_id: external_id,
    };
    const queryParams = {};
    const request = client.buildRequest(
      "GET",
      "/v1/customers/external/{external_id}/state",
      pathParams,
      queryParams,
      undefined,
    );
    const response = await client.sendRequest(request);
    return client.parseResponse<CustomerState>(response, "json", {
      404: ResourceNotFound,
      422: HTTPValidationError,
    });
  };
};
export const listPaymentMethodsCustomers = (client: ClientBase) => {
  /**
   * Get saved payment methods of a customer.
   *
   * **Scopes**: `customers:read` `customers:write`
   *
   * @param id - The customer ID.
   * @param query - Query parameters
   * @returns {ListResourcePaymentMethod}
   * @throws {PolarNetworkError} When a network error occurs
   * @throws {PolarServerError} When the server returns a 5xx error
   * @throws {ResourceNotFound} Customer not found.
   * @throws {HTTPValidationError} Validation Error
   */
  return async (
    id: string,
    query?: {
      page?: number;
      limit?: number;
    },
  ): Promise<ListResourcePaymentMethod> => {
    const pathParams = {
      id: id,
    };
    const queryParams = {
      page: query?.page || 1,
      limit: query?.limit || 10,
    };
    const request = client.buildRequest(
      "GET",
      "/v1/customers/{id}/payment-methods",
      pathParams,
      queryParams,
      undefined,
    );
    const response = await client.sendRequest(request);
    return client.parseResponse<ListResourcePaymentMethod>(response, "json", {
      404: ResourceNotFound,
      422: HTTPValidationError,
    });
  };
};
export const listPaymentMethodsExternalCustomers = (client: ClientBase) => {
  /**
   * Get saved payment methods of a customer by external ID.
   *
   * **Scopes**: `customers:read` `customers:write`
   *
   * @param external_id - The customer external ID.
   * @param query - Query parameters
   * @returns {ListResourcePaymentMethod}
   * @throws {PolarNetworkError} When a network error occurs
   * @throws {PolarServerError} When the server returns a 5xx error
   * @throws {ResourceNotFound} Customer not found.
   * @throws {HTTPValidationError} Validation Error
   */
  return async (
    external_id: string,
    query?: {
      page?: number;
      limit?: number;
    },
  ): Promise<ListResourcePaymentMethod> => {
    const pathParams = {
      external_id: external_id,
    };
    const queryParams = {
      page: query?.page || 1,
      limit: query?.limit || 10,
    };
    const request = client.buildRequest(
      "GET",
      "/v1/customers/external/{external_id}/payment-methods",
      pathParams,
      queryParams,
      undefined,
    );
    const response = await client.sendRequest(request);
    return client.parseResponse<ListResourcePaymentMethod>(response, "json", {
      404: ResourceNotFound,
      422: HTTPValidationError,
    });
  };
};

export function createCustomersService(client: ClientBase) {
  return {
    list: listCustomers(client),
    create: createCustomers(client),
    export: exportCustomers(client),
    get: getCustomers(client),
    delete: deleteCustomers(client),
    update: updateCustomers(client),
    getExternal: getExternalCustomers(client),
    deleteExternal: deleteExternalCustomers(client),
    updateExternal: updateExternalCustomers(client),
    getState: getStateCustomers(client),
    getStateExternal: getStateExternalCustomers(client),
    listPaymentMethods: listPaymentMethodsCustomers(client),
    listPaymentMethodsExternal: listPaymentMethodsExternalCustomers(client),
  };
}

export type Customers = ReturnType<typeof createCustomersService>;
