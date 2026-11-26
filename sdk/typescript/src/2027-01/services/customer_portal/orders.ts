import type { ClientBase, RequestOptions } from "../../../base";
import type {
  CustomerOrder,
  CustomerOrderCreate,
  CustomerOrderInvoice,
  CustomerOrderPay,
  CustomerOrderReceipt,
  CustomerOrderSortProperty,
  CustomerOrderUpdate,
  ListResourceCustomerOrder,
  ProductBillingType,
} from "../../models";

import {
  HTTPValidationError,
  MissingInvoiceBillingDetails,
  OrderNotEligibleForInvoice,
  PaymentError,
  ResourceNotFound,
} from "../../errors";

export const listOrders = (client: ClientBase) => {
  /**
   * List orders of the authenticated customer.
   *
   * @param query - Query parameters
   * @param requestOptions - Request options
   * @returns {ListResourceCustomerOrder}
   * @throws {PolarNetworkError} When a network error occurs
   * @throws {PolarRateLimitError} When the rate limit is exceeded
   * @throws {PolarServerError} When the server returns a 5xx error
   * @throws {HTTPValidationError} Validation Error
   */
  return async (
    query?: {
      product_id?: string | string[] | null;
      product_billing_type?: ProductBillingType | ProductBillingType[] | null;
      subscription_id?: string | string[] | null;
      query?: string | null;
      page?: number;
      limit?: number;
      sorting?: CustomerOrderSortProperty[] | null;
    },
    requestOptions?: RequestOptions,
  ): Promise<ListResourceCustomerOrder> => {
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
    const response = await client.sendRequest(request, requestOptions);
    return client.parseResponse<ListResourceCustomerOrder>(response, "json", {
      422: HTTPValidationError,
    });
  };
};
/**
 * List orders of the authenticated customer.
 *
 * @param query - Query parameters
 * @param requestOptions - Request options
 * @returns {AsyncGenerator<CustomerOrder>} A generator that yields items of type CustomerOrder.
 * @throws {PolarNetworkError} When a network error occurs
 * @throws {PolarRateLimitError} When the rate limit is exceeded
 * @throws {PolarServerError} When the server returns a 5xx error
 * @throws {HTTPValidationError} Validation Error
 */
export const iterListOrders = (client: ClientBase) => {
  return async function* (
    query?: {
      product_id?: string | string[] | null;
      product_billing_type?: ProductBillingType | ProductBillingType[] | null;
      subscription_id?: string | string[] | null;
      query?: string | null;
      page?: number;
      limit?: number;
      sorting?: CustomerOrderSortProperty[] | null;
    },
    requestOptions?: RequestOptions,
  ): AsyncGenerator<CustomerOrder> {
    let page: number;
    page = query?.page ?? 1;
    let limit: number | undefined;
    limit = query?.limit;

    while (true) {
      const response = await listOrders(client)({ ...query, page, limit }, requestOptions);
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
export const createOrders = (client: ClientBase) => {
  /**
   * Prepare a draft order for the first paid period of an ended trial.
   *
   * @param body - Request body
   * @param requestOptions - Request options
   * @returns {CustomerOrder}
   * @throws {PolarNetworkError} When a network error occurs
   * @throws {PolarRateLimitError} When the rate limit is exceeded
   * @throws {PolarServerError} When the server returns a 5xx error
   * @throws {HTTPValidationError} Validation Error
   */
  return async (
    body: CustomerOrderCreate,
    requestOptions?: RequestOptions,
  ): Promise<CustomerOrder> => {
    const pathParams = {};
    const queryParams = {};
    const request = client.buildRequest(
      "POST",
      "/v1/customer-portal/orders/",
      pathParams,
      queryParams,
      body,
    );
    const response = await client.sendRequest(request, requestOptions);
    return client.parseResponse<CustomerOrder>(response, "json", {
      422: HTTPValidationError,
    });
  };
};
export const getOrders = (client: ClientBase) => {
  /**
   * Get an order by ID for the authenticated customer.
   *
   * @param id - The order ID.
   * @param requestOptions - Request options
   * @returns {CustomerOrder}
   * @throws {PolarNetworkError} When a network error occurs
   * @throws {PolarRateLimitError} When the rate limit is exceeded
   * @throws {PolarServerError} When the server returns a 5xx error
   * @throws {ResourceNotFound} Order not found.
   * @throws {HTTPValidationError} Validation Error
   */
  return async (id: string, requestOptions?: RequestOptions): Promise<CustomerOrder> => {
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
    const response = await client.sendRequest(request, requestOptions);
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
   * @param requestOptions - Request options
   * @returns {CustomerOrder}
   * @throws {PolarNetworkError} When a network error occurs
   * @throws {PolarRateLimitError} When the rate limit is exceeded
   * @throws {PolarServerError} When the server returns a 5xx error
   * @throws {ResourceNotFound} Order not found.
   * @throws {HTTPValidationError} Validation Error
   */
  return async (
    id: string,
    body: CustomerOrderUpdate,
    requestOptions?: RequestOptions,
  ): Promise<CustomerOrder> => {
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
    const response = await client.sendRequest(request, requestOptions);
    return client.parseResponse<CustomerOrder>(response, "json", {
      404: ResourceNotFound,
      422: HTTPValidationError,
    });
  };
};
export const payOrders = (client: ClientBase) => {
  /**
   * Submit payment for an order for asynchronous settlement.
   *
   * @param id - The order ID.
   * @param body - Request body
   * @param requestOptions - Request options
   * @returns {CustomerOrder}
   * @throws {PolarNetworkError} When a network error occurs
   * @throws {PolarRateLimitError} When the rate limit is exceeded
   * @throws {PolarServerError} When the server returns a 5xx error
   * @throws {PaymentError} Bad Request
   * @throws {ResourceNotFound} Order not found.
   * @throws {HTTPValidationError} Validation Error
   */
  return async (
    id: string,
    body: CustomerOrderPay,
    requestOptions?: RequestOptions,
  ): Promise<CustomerOrder> => {
    const pathParams = {
      id: id,
    };
    const queryParams = {};
    const request = client.buildRequest(
      "PATCH",
      "/v1/customer-portal/orders/{id}/pay",
      pathParams,
      queryParams,
      body,
    );
    const response = await client.sendRequest(request, requestOptions);
    return client.parseResponse<CustomerOrder>(response, "json", {
      400: PaymentError,
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
   * @param requestOptions - Request options
   * @returns {CustomerOrderInvoice}
   * @throws {PolarNetworkError} When a network error occurs
   * @throws {PolarRateLimitError} When the rate limit is exceeded
   * @throws {PolarServerError} When the server returns a 5xx error
   * @throws {ResourceNotFound} Order not found.
   * @throws {HTTPValidationError} Validation Error
   */
  return async (id: string, requestOptions?: RequestOptions): Promise<CustomerOrderInvoice> => {
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
    const response = await client.sendRequest(request, requestOptions);
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
   * @param requestOptions - Request options
   * @returns {unknown}
   * @throws {PolarNetworkError} When a network error occurs
   * @throws {PolarRateLimitError} When the rate limit is exceeded
   * @throws {PolarServerError} When the server returns a 5xx error
   * @throws {ResourceNotFound} Order not found.
   * @throws {OrderNotEligibleForInvoice} Order is not eligible for invoice generation (invalid status).
   * @throws {MissingInvoiceBillingDetails} Order is missing billing name or address.
   */
  return async (id: string, requestOptions?: RequestOptions): Promise<unknown> => {
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
    const response = await client.sendRequest(request, requestOptions);
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
   * @param requestOptions - Request options
   * @returns {CustomerOrderReceipt}
   * @throws {PolarNetworkError} When a network error occurs
   * @throws {PolarRateLimitError} When the rate limit is exceeded
   * @throws {PolarServerError} When the server returns a 5xx error
   * @throws {ResourceNotFound} Order not found.
   * @throws {HTTPValidationError} Validation Error
   */
  return async (id: string, requestOptions?: RequestOptions): Promise<CustomerOrderReceipt> => {
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
    const response = await client.sendRequest(request, requestOptions);
    return client.parseResponse<CustomerOrderReceipt>(response, "json", {
      404: ResourceNotFound,
      422: HTTPValidationError,
    });
  };
};

export function createOrdersService(client: ClientBase) {
  return {
    list: listOrders(client),
    create: createOrders(client),
    get: getOrders(client),
    update: updateOrders(client),
    pay: payOrders(client),
    invoice: invoiceOrders(client),
    generateInvoice: generateInvoiceOrders(client),
    receipt: receiptOrders(client),
    iterList: iterListOrders(client),
  };
}

export type Orders = ReturnType<typeof createOrdersService>;
