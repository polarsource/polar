import { ClientBase } from "../../base";
import type { CustomerOrderConfirmPayment, CustomerOrderUpdate } from "../../models/inputs";
import type {
  CustomerOrder,
  CustomerOrderInvoice,
  CustomerOrderPaymentConfirmation,
  CustomerOrderPaymentStatus,
  CustomerOrderReceipt,
  ListResourceCustomerOrder,
} from "../../models/outputs";
import type { CustomerOrderSortProperty, ProductBillingType } from "../../models/literals";
import {
  HTTPValidationError,
  ManualRetryLimitExceeded,
  MissingInvoiceBillingDetails,
  OrderNotEligibleForInvoice,
  OrderNotEligibleForRetry,
  PaymentAlreadyInProgress,
  ResourceNotFound,
} from "../../errors";

export const listOrders = (client: ClientBase) => {
  /**
   * List orders of the authenticated customer.
   *
   * @param query - Query parameters
   * @returns {ListResourceCustomerOrder}
   * @throws {PolarNetworkError} When a network error occurs
   * @throws {PolarServerError} When the server returns a 5xx error
   * @throws {HTTPValidationError} Validation Error
   */
  return async (query?: {
    product_id?: string | string[] | null;
    product_billing_type?: ProductBillingType | ProductBillingType[] | null;
    subscription_id?: string | string[] | null;
    query?: string | null;
    page?: number;
    limit?: number;
    sorting?: CustomerOrderSortProperty[] | null;
  }): Promise<ListResourceCustomerOrder> => {
    const pathParams = {};
    const queryParams = {
      product_id: query?.product_id,
      product_billing_type: query?.product_billing_type,
      subscription_id: query?.subscription_id,
      query: query?.query,
      page: query?.page ?? 1,
      limit: query?.limit ?? 10,
      sorting: query?.sorting ?? ["-created_at"],
    };
    const request = client.buildRequest(
      "GET",
      "/v1/customer-portal/orders/",
      pathParams,
      queryParams,
      undefined,
    );
    const response = await client.sendRequest(request);
    return client.parseResponse<ListResourceCustomerOrder>(response, "json", {
      422: HTTPValidationError,
    });
  };
};
/**
 * List orders of the authenticated customer.
 *
 * @param query - Query parameters
 * @returns {AsyncGenerator<CustomerOrder>} A generator that yields items of type CustomerOrder.
 * @throws {PolarNetworkError} When a network error occurs
 * @throws {PolarServerError} When the server returns a 5xx error
 * @throws {HTTPValidationError} Validation Error
 */
export const iterlistOrders = (client: ClientBase) => {
  return async function* (query?: {
    product_id?: string | string[] | null;
    product_billing_type?: ProductBillingType | ProductBillingType[] | null;
    subscription_id?: string | string[] | null;
    query?: string | null;
    page?: number;
    limit?: number;
    sorting?: CustomerOrderSortProperty[] | null;
  }): AsyncGenerator<CustomerOrder> {
    let page: number;
    page = query?.page ?? 1;
    let limit: number | undefined;
    limit = query?.limit;

    while (true) {
      const response = await listOrders(client)({ ...query, page, limit });
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
export const getOrders = (client: ClientBase) => {
  /**
   * Get an order by ID for the authenticated customer.
   *
   * @param id - The order ID.
   * @returns {CustomerOrder}
   * @throws {PolarNetworkError} When a network error occurs
   * @throws {PolarServerError} When the server returns a 5xx error
   * @throws {ResourceNotFound} Order not found.
   * @throws {HTTPValidationError} Validation Error
   */
  return async (id: string): Promise<CustomerOrder> => {
    const pathParams = {
      id: id,
    };
    const queryParams = {};
    const request = client.buildRequest(
      "GET",
      "/v1/customer-portal/orders/{id}",
      pathParams,
      queryParams,
      undefined,
    );
    const response = await client.sendRequest(request);
    return client.parseResponse<CustomerOrder>(response, "json", {
      404: ResourceNotFound,
      422: HTTPValidationError,
    });
  };
};
export const updateOrders = (client: ClientBase) => {
  /**
   * Update an order for the authenticated customer.
   *
   * @param id - The order ID.
   * @param body - Request body
   * @returns {CustomerOrder}
   * @throws {PolarNetworkError} When a network error occurs
   * @throws {PolarServerError} When the server returns a 5xx error
   * @throws {ResourceNotFound} Order not found.
   * @throws {HTTPValidationError} Validation Error
   */
  return async (id: string, body: CustomerOrderUpdate): Promise<CustomerOrder> => {
    const pathParams = {
      id: id,
    };
    const queryParams = {};
    const request = client.buildRequest(
      "PATCH",
      "/v1/customer-portal/orders/{id}",
      pathParams,
      queryParams,
      body,
    );
    const response = await client.sendRequest(request);
    return client.parseResponse<CustomerOrder>(response, "json", {
      404: ResourceNotFound,
      422: HTTPValidationError,
    });
  };
};
export const invoiceOrders = (client: ClientBase) => {
  /**
   * Get an order's invoice data.
   *
   * @param id - The order ID.
   * @returns {CustomerOrderInvoice}
   * @throws {PolarNetworkError} When a network error occurs
   * @throws {PolarServerError} When the server returns a 5xx error
   * @throws {ResourceNotFound} Order not found.
   * @throws {HTTPValidationError} Validation Error
   */
  return async (id: string): Promise<CustomerOrderInvoice> => {
    const pathParams = {
      id: id,
    };
    const queryParams = {};
    const request = client.buildRequest(
      "GET",
      "/v1/customer-portal/orders/{id}/invoice",
      pathParams,
      queryParams,
      undefined,
    );
    const response = await client.sendRequest(request);
    return client.parseResponse<CustomerOrderInvoice>(response, "json", {
      404: ResourceNotFound,
      422: HTTPValidationError,
    });
  };
};
export const generateInvoiceOrders = (client: ClientBase) => {
  /**
   * Trigger generation of an order's invoice.
   *
   * @param id - The order ID.
   * @returns {unknown}
   * @throws {PolarNetworkError} When a network error occurs
   * @throws {PolarServerError} When the server returns a 5xx error
   * @throws {ResourceNotFound} Order not found.
   * @throws {OrderNotEligibleForInvoice} Order is not eligible for invoice generation (invalid status).
   * @throws {MissingInvoiceBillingDetails} Order is missing billing name or address.
   */
  return async (id: string): Promise<unknown> => {
    const pathParams = {
      id: id,
    };
    const queryParams = {};
    const request = client.buildRequest(
      "POST",
      "/v1/customer-portal/orders/{id}/invoice",
      pathParams,
      queryParams,
      undefined,
    );
    const response = await client.sendRequest(request);
    return client.parseResponse<unknown>(response, "json", {
      404: ResourceNotFound,
      409: OrderNotEligibleForInvoice,
      422: MissingInvoiceBillingDetails,
    });
  };
};
export const receiptOrders = (client: ClientBase) => {
  /**
   * Get a presigned URL to download an order's receipt PDF.
   *
   * @param id - The order ID.
   * @returns {CustomerOrderReceipt}
   * @throws {PolarNetworkError} When a network error occurs
   * @throws {PolarServerError} When the server returns a 5xx error
   * @throws {ResourceNotFound} Order not found.
   * @throws {HTTPValidationError} Validation Error
   */
  return async (id: string): Promise<CustomerOrderReceipt> => {
    const pathParams = {
      id: id,
    };
    const queryParams = {};
    const request = client.buildRequest(
      "GET",
      "/v1/customer-portal/orders/{id}/receipt",
      pathParams,
      queryParams,
      undefined,
    );
    const response = await client.sendRequest(request);
    return client.parseResponse<CustomerOrderReceipt>(response, "json", {
      404: ResourceNotFound,
      422: HTTPValidationError,
    });
  };
};
export const getPaymentStatusOrders = (client: ClientBase) => {
  /**
   * Get the current payment status for an order.
   *
   * @param id - The order ID.
   * @returns {CustomerOrderPaymentStatus}
   * @throws {PolarNetworkError} When a network error occurs
   * @throws {PolarServerError} When the server returns a 5xx error
   * @throws {ResourceNotFound} Order not found.
   * @throws {HTTPValidationError} Validation Error
   */
  return async (id: string): Promise<CustomerOrderPaymentStatus> => {
    const pathParams = {
      id: id,
    };
    const queryParams = {};
    const request = client.buildRequest(
      "GET",
      "/v1/customer-portal/orders/{id}/payment-status",
      pathParams,
      queryParams,
      undefined,
    );
    const response = await client.sendRequest(request);
    return client.parseResponse<CustomerOrderPaymentStatus>(response, "json", {
      404: ResourceNotFound,
      422: HTTPValidationError,
    });
  };
};
export const confirmRetryPaymentOrders = (client: ClientBase) => {
  /**
   * Confirm a retry payment using a Stripe confirmation token.
   *
   * @param id - The order ID.
   * @param body - Request body
   * @returns {CustomerOrderPaymentConfirmation}
   * @throws {PolarNetworkError} When a network error occurs
   * @throws {PolarServerError} When the server returns a 5xx error
   * @throws {ResourceNotFound} Order not found.
   * @throws {PaymentAlreadyInProgress} Payment already in progress.
   * @throws {OrderNotEligibleForRetry} Order not eligible for retry or payment confirmation failed.
   * @throws {ManualRetryLimitExceeded} Manual retry limit exceeded.
   */
  return async (
    id: string,
    body: CustomerOrderConfirmPayment,
  ): Promise<CustomerOrderPaymentConfirmation> => {
    const pathParams = {
      id: id,
    };
    const queryParams = {};
    const request = client.buildRequest(
      "POST",
      "/v1/customer-portal/orders/{id}/confirm-payment",
      pathParams,
      queryParams,
      body,
    );
    const response = await client.sendRequest(request);
    return client.parseResponse<CustomerOrderPaymentConfirmation>(response, "json", {
      404: ResourceNotFound,
      409: PaymentAlreadyInProgress,
      422: OrderNotEligibleForRetry,
      429: ManualRetryLimitExceeded,
    });
  };
};

export function createOrdersService(client: ClientBase) {
  return {
    list: listOrders(client),
    get: getOrders(client),
    update: updateOrders(client),
    invoice: invoiceOrders(client),
    generateInvoice: generateInvoiceOrders(client),
    receipt: receiptOrders(client),
    getPaymentStatus: getPaymentStatusOrders(client),
    confirmRetryPayment: confirmRetryPaymentOrders(client),
    iterlist: iterlistOrders(client),
  };
}

export type Orders = ReturnType<typeof createOrdersService>;
