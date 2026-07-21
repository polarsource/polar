import type { ClientBase } from "../../../base";
import type {
  CustomerEmailUpdateRequest,
  CustomerEmailUpdateVerifyRequest,
  CustomerEmailUpdateVerifyResponse,
  CustomerPaymentMethod,
  CustomerPaymentMethodConfirm,
  CustomerPaymentMethodCreate,
  CustomerPaymentMethodCreateResponse,
  CustomerPortalCustomer,
  CustomerPortalCustomerUpdate,
  ListResourceCustomerPaymentMethod,
} from "../../models";

import {
  CheckEmailUpdate401Error,
  CustomerNotReady,
  HTTPValidationError,
  PaymentMethodInUseByActiveSubscription,
  PaymentMethodSetupFailed,
  ResourceNotFound,
  VerifyEmailUpdate401Error,
  VerifyEmailUpdate422Error,
} from "../../errors";

export const getCustomers = (client: ClientBase) => {
  /**
   * Get authenticated customer.
   *
   * **Scopes**: `customer_portal:read` `customer_portal:write`
   *
   * @returns {CustomerPortalCustomer}
   * @throws {PolarNetworkError} When a network error occurs
   * @throws {PolarRateLimitError} When the rate limit is exceeded
   * @throws {PolarServerError} When the server returns a 5xx error
   */
  return async (): Promise<CustomerPortalCustomer> => {
    const pathParams = {};
    const queryParams = {};
    const request = client.buildRequest(
      "GET",
      "/v1/customer-portal/customers/me",
      pathParams,
      queryParams,
      undefined,
    );
    const response = await client.sendRequest(request);
    return client.parseResponse<CustomerPortalCustomer>(response, "json", {});
  };
};
export const updateCustomers = (client: ClientBase) => {
  /**
   * Update authenticated customer.
   *
   * @param body - Request body
   * @returns {CustomerPortalCustomer}
   * @throws {PolarNetworkError} When a network error occurs
   * @throws {PolarRateLimitError} When the rate limit is exceeded
   * @throws {PolarServerError} When the server returns a 5xx error
   * @throws {HTTPValidationError} Validation Error
   */
  return async (body: CustomerPortalCustomerUpdate): Promise<CustomerPortalCustomer> => {
    const pathParams = {};
    const queryParams = {};
    const request = client.buildRequest(
      "PATCH",
      "/v1/customer-portal/customers/me",
      pathParams,
      queryParams,
      body,
    );
    const response = await client.sendRequest(request);
    return client.parseResponse<CustomerPortalCustomer>(response, "json", {
      422: HTTPValidationError,
    });
  };
};
export const listPaymentMethodsCustomers = (client: ClientBase) => {
  /**
   * Get saved payment methods of the authenticated customer.
   *
   * @param query - Query parameters
   * @returns {ListResourceCustomerPaymentMethod}
   * @throws {PolarNetworkError} When a network error occurs
   * @throws {PolarRateLimitError} When the rate limit is exceeded
   * @throws {PolarServerError} When the server returns a 5xx error
   * @throws {HTTPValidationError} Validation Error
   */
  return async (query?: {
    page?: number;
    limit?: number;
  }): Promise<ListResourceCustomerPaymentMethod> => {
    const pathParams = {};
    const queryParams = {
      page: query?.page ?? 1,
      limit: query?.limit ?? 10,
    };
    const request = client.buildRequest(
      "GET",
      "/v1/customer-portal/customers/me/payment-methods",
      pathParams,
      queryParams,
      undefined,
    );
    const response = await client.sendRequest(request);
    return client.parseResponse<ListResourceCustomerPaymentMethod>(response, "json", {
      422: HTTPValidationError,
    });
  };
};
/**
 * Get saved payment methods of the authenticated customer.
 *
 * @param query - Query parameters
 * @returns {AsyncGenerator<CustomerPaymentMethod>} A generator that yields items of type CustomerPaymentMethod.
 * @throws {PolarNetworkError} When a network error occurs
 * @throws {PolarRateLimitError} When the rate limit is exceeded
 * @throws {PolarServerError} When the server returns a 5xx error
 * @throws {HTTPValidationError} Validation Error
 */
export const iterListPaymentMethodsCustomers = (client: ClientBase) => {
  return async function* (query?: {
    page?: number;
    limit?: number;
  }): AsyncGenerator<CustomerPaymentMethod> {
    let page: number;
    page = query?.page ?? 1;
    let limit: number | undefined;
    limit = query?.limit;

    while (true) {
      const response = await listPaymentMethodsCustomers(client)({ ...query, page, limit });
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
export const addPaymentMethodCustomers = (client: ClientBase) => {
  /**
   * Add a payment method to the authenticated customer.
   *
   * @param body - Request body
   * @returns {CustomerPaymentMethodCreateResponse}
   * @throws {PolarNetworkError} When a network error occurs
   * @throws {PolarRateLimitError} When the rate limit is exceeded
   * @throws {PolarServerError} When the server returns a 5xx error
   * @throws {PaymentMethodSetupFailed} The card was declined while setting up the payment method.
   * @throws {HTTPValidationError} Validation Error
   */
  return async (
    body: CustomerPaymentMethodCreate,
  ): Promise<CustomerPaymentMethodCreateResponse> => {
    const pathParams = {};
    const queryParams = {};
    const request = client.buildRequest(
      "POST",
      "/v1/customer-portal/customers/me/payment-methods",
      pathParams,
      queryParams,
      body,
    );
    const response = await client.sendRequest(request);
    return client.parseResponse<CustomerPaymentMethodCreateResponse>(response, "json", {
      400: PaymentMethodSetupFailed,
      422: HTTPValidationError,
    });
  };
};
export const confirmPaymentMethodCustomers = (client: ClientBase) => {
  /**
   * Confirm a payment method for the authenticated customer.
   *
   * @param body - Request body
   * @returns {CustomerPaymentMethodCreateResponse}
   * @throws {PolarNetworkError} When a network error occurs
   * @throws {PolarRateLimitError} When the rate limit is exceeded
   * @throws {PolarServerError} When the server returns a 5xx error
   * @throws {CustomerNotReady} Customer is not ready to confirm a payment method.
   * @throws {HTTPValidationError} Validation Error
   */
  return async (
    body: CustomerPaymentMethodConfirm,
  ): Promise<CustomerPaymentMethodCreateResponse> => {
    const pathParams = {};
    const queryParams = {};
    const request = client.buildRequest(
      "POST",
      "/v1/customer-portal/customers/me/payment-methods/confirm",
      pathParams,
      queryParams,
      body,
    );
    const response = await client.sendRequest(request);
    return client.parseResponse<CustomerPaymentMethodCreateResponse>(response, "json", {
      400: CustomerNotReady,
      422: HTTPValidationError,
    });
  };
};
export const deletePaymentMethodCustomers = (client: ClientBase) => {
  /**
   * Delete a payment method from the authenticated customer.
   *
   * @param id
   * @returns {void}
   * @throws {PolarNetworkError} When a network error occurs
   * @throws {PolarRateLimitError} When the rate limit is exceeded
   * @throws {PolarServerError} When the server returns a 5xx error
   * @throws {PaymentMethodInUseByActiveSubscription} Payment method is used by active subscription(s).
   * @throws {ResourceNotFound} Payment method not found.
   * @throws {HTTPValidationError} Validation Error
   */
  return async (id: string): Promise<void> => {
    const pathParams = {
      id: id,
    };
    const queryParams = {};
    const request = client.buildRequest(
      "DELETE",
      "/v1/customer-portal/customers/me/payment-methods/{id}",
      pathParams,
      queryParams,
      undefined,
    );
    const response = await client.sendRequest(request);
    return client.parseResponse<void>(response, "none", {
      400: PaymentMethodInUseByActiveSubscription,
      404: ResourceNotFound,
      422: HTTPValidationError,
    });
  };
};
export const requestEmailUpdateCustomers = (client: ClientBase) => {
  /**
   * Request an email change for the authenticated customer.
   *
   * @param body - Request body
   * @returns {unknown}
   * @throws {PolarNetworkError} When a network error occurs
   * @throws {PolarRateLimitError} When the rate limit is exceeded
   * @throws {PolarServerError} When the server returns a 5xx error
   * @throws {HTTPValidationError} Validation Error
   */
  return async (body: CustomerEmailUpdateRequest): Promise<unknown> => {
    const pathParams = {};
    const queryParams = {};
    const request = client.buildRequest(
      "POST",
      "/v1/customer-portal/customers/me/email-update/request",
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
export const checkEmailUpdateCustomers = (client: ClientBase) => {
  /**
   * Check if an email change verification token is still valid.
   *
   * @param query - Query parameters
   * @returns {void}
   * @throws {PolarNetworkError} When a network error occurs
   * @throws {PolarRateLimitError} When the rate limit is exceeded
   * @throws {PolarServerError} When the server returns a 5xx error
   * @throws {CheckEmailUpdate401Error} Invalid or expired verification token.
   * @throws {HTTPValidationError} Validation Error
   */
  return async (query: { token: string }): Promise<void> => {
    const pathParams = {};
    const queryParams = {
      token: query.token,
    };
    const request = client.buildRequest(
      "GET",
      "/v1/customer-portal/customers/me/email-update/check",
      pathParams,
      queryParams,
      undefined,
    );
    const response = await client.sendRequest(request);
    return client.parseResponse<void>(response, "none", {
      401: CheckEmailUpdate401Error,
      422: HTTPValidationError,
    });
  };
};
export const verifyEmailUpdateCustomers = (client: ClientBase) => {
  /**
   * Verify an email change using the token from the verification email.
   *
   * @param body - Request body
   * @returns {CustomerEmailUpdateVerifyResponse}
   * @throws {PolarNetworkError} When a network error occurs
   * @throws {PolarRateLimitError} When the rate limit is exceeded
   * @throws {PolarServerError} When the server returns a 5xx error
   * @throws {VerifyEmailUpdate401Error} Invalid or expired verification token.
   * @throws {VerifyEmailUpdate422Error} Email address is already in use.
   */
  return async (
    body: CustomerEmailUpdateVerifyRequest,
  ): Promise<CustomerEmailUpdateVerifyResponse> => {
    const pathParams = {};
    const queryParams = {};
    const request = client.buildRequest(
      "POST",
      "/v1/customer-portal/customers/me/email-update/verify",
      pathParams,
      queryParams,
      body,
    );
    const response = await client.sendRequest(request);
    return client.parseResponse<CustomerEmailUpdateVerifyResponse>(response, "json", {
      401: VerifyEmailUpdate401Error,
      422: VerifyEmailUpdate422Error,
    });
  };
};

export function createCustomersService(client: ClientBase) {
  return {
    get: getCustomers(client),
    update: updateCustomers(client),
    listPaymentMethods: listPaymentMethodsCustomers(client),
    addPaymentMethod: addPaymentMethodCustomers(client),
    confirmPaymentMethod: confirmPaymentMethodCustomers(client),
    deletePaymentMethod: deletePaymentMethodCustomers(client),
    requestEmailUpdate: requestEmailUpdateCustomers(client),
    checkEmailUpdate: checkEmailUpdateCustomers(client),
    verifyEmailUpdate: verifyEmailUpdateCustomers(client),
    iterListPaymentMethods: iterListPaymentMethodsCustomers(client),
  };
}

export type Customers = ReturnType<typeof createCustomersService>;
