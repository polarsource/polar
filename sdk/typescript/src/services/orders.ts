import { ClientBase } from "../base";
import type { MetadataQuery, OrderCreate, OrderFinalize, OrderUpdate } from "../models/inputs";
import type { ListResourceOrder, Order, OrderInvoice, OrderReceipt } from "../models/outputs";
import type { OrderSortProperty, ProductBillingType } from "../models/literals";
import {
  Finalize402Error,
  Finalize403Error,
  HTTPValidationError,
  MissingInvoiceBillingDetails,
  OrderNotDraft,
  ResourceNotFound,
} from "../errors";

export const listOrders = (client: ClientBase) => {
  /**
   * List orders.
   *
   * **Scopes**: `orders:read`
   *
   * @param query - Query parameters
   * @returns {ListResourceOrder}
   * @throws {PolarNetworkError} When a network error occurs
   * @throws {PolarServerError} When the server returns a 5xx error
   * @throws {HTTPValidationError} Validation Error
   */
  return async (query?: {
    organization_id?: string | string[] | null;
    product_id?: string | string[] | null;
    product_billing_type?: ProductBillingType | ProductBillingType[] | null;
    discount_id?: string | string[] | null;
    customer_id?: string | string[] | null;
    external_customer_id?: string | string[] | null;
    checkout_id?: string | string[] | null;
    subscription_id?: string | string[] | null;
    page?: number;
    limit?: number;
    sorting?: OrderSortProperty[] | null;
    metadata?: MetadataQuery;
  }): Promise<ListResourceOrder> => {
    const pathParams = {};
    const queryParams = {
      organization_id: query?.organization_id,
      product_id: query?.product_id,
      product_billing_type: query?.product_billing_type,
      discount_id: query?.discount_id,
      customer_id: query?.customer_id,
      external_customer_id: query?.external_customer_id,
      checkout_id: query?.checkout_id,
      subscription_id: query?.subscription_id,
      page: query?.page || 1,
      limit: query?.limit || 10,
      sorting: query?.sorting || ["-created_at"],
      metadata: query?.metadata,
    };
    const request = client.buildRequest("GET", "/v1/orders/", pathParams, queryParams, undefined);
    const response = await client.sendRequest(request);
    return client.parseResponse<ListResourceOrder>(response, "json", {
      422: HTTPValidationError,
    });
  };
};
export const createOrders = (client: ClientBase) => {
  /**
   * Create a draft order for an off-session charge against a saved payment
   * method. The order is created with `status=draft` and no invoice number;
   * call `POST /v1/orders/{id}/finalize` to attempt the charge.
   *
   * The organization must have the `off_session_charges_enabled` feature flag.
   *
   * **Scopes**: `orders:write`
   *
   * @param body - Request body* @returns {Order}
   * @throws {PolarNetworkError} When a network error occurs
   * @throws {PolarServerError} When the server returns a 5xx error
   * @throws {HTTPValidationError} Validation Error
   */
  return async (body?: OrderCreate): Promise<Order> => {
    const pathParams = {};
    const queryParams = {};
    const request = client.buildRequest("POST", "/v1/orders/", pathParams, queryParams, body);
    const response = await client.sendRequest(request);
    return client.parseResponse<Order>(response, "json", {
      422: HTTPValidationError,
    });
  };
};
export const exportOrders = (client: ClientBase) => {
  /**
   * Export orders as a CSV file.
   *
   * **Scopes**: `orders:read`
   *
   * @param query - Query parameters
   * @returns {string}
   * @throws {PolarNetworkError} When a network error occurs
   * @throws {PolarServerError} When the server returns a 5xx error
   * @throws {HTTPValidationError} Validation Error
   */
  return async (query?: {
    organization_id?: string | string[] | null;
    product_id?: string | string[] | null;
  }): Promise<string> => {
    const pathParams = {};
    const queryParams = {
      organization_id: query?.organization_id,
      product_id: query?.product_id,
    };
    const request = client.buildRequest(
      "GET",
      "/v1/orders/export",
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
export const getOrders = (client: ClientBase) => {
  /**
   * Get an order by ID.
   *
   * **Scopes**: `orders:read`
   *
   * @param id - The order ID.
   * @returns {Order}
   * @throws {PolarNetworkError} When a network error occurs
   * @throws {PolarServerError} When the server returns a 5xx error
   * @throws {ResourceNotFound} Order not found.
   * @throws {HTTPValidationError} Validation Error
   */
  return async (id: string): Promise<Order> => {
    const pathParams = {
      id: id,
    };
    const queryParams = {};
    const request = client.buildRequest(
      "GET",
      "/v1/orders/{id}",
      pathParams,
      queryParams,
      undefined,
    );
    const response = await client.sendRequest(request);
    return client.parseResponse<Order>(response, "json", {
      404: ResourceNotFound,
      422: HTTPValidationError,
    });
  };
};
export const updateOrders = (client: ClientBase) => {
  /**
   * Update an order.
   *
   * **Scopes**: `orders:write`
   *
   * @param id - The order ID.
   * @param body - Request body* @returns {Order}
   * @throws {PolarNetworkError} When a network error occurs
   * @throws {PolarServerError} When the server returns a 5xx error
   * @throws {ResourceNotFound} Order not found.
   * @throws {HTTPValidationError} Validation Error
   */
  return async (id: string, body?: OrderUpdate): Promise<Order> => {
    const pathParams = {
      id: id,
    };
    const queryParams = {};
    const request = client.buildRequest("PATCH", "/v1/orders/{id}", pathParams, queryParams, body);
    const response = await client.sendRequest(request);
    return client.parseResponse<Order>(response, "json", {
      404: ResourceNotFound,
      422: HTTPValidationError,
    });
  };
};
export const finalizeOrders = (client: ClientBase) => {
  /**
   * Finalize a draft order and synchronously attempt an off-session charge.
   *
   * On success, the order transitions to `paid` and benefit grants fire
   * before the response returns. On failure (decline, missing payment method,
   * SCA challenge), the order stays in `draft` and a 4xx error is returned.
   *
   * The request fails with 412 if the order is not in `draft` status.
   *
   * **Scopes**: `orders:write`
   *
   * @param id - The order ID.
   * @param body - Request body* @returns {Order}
   * @throws {PolarNetworkError} When a network error occurs
   * @throws {PolarServerError} When the server returns a 5xx error
   * @throws {Finalize402Error} The charge failed, or requires customer authentication (e.g. a 3DS challenge) that can't be completed off-session.
   * @throws {Finalize403Error} Off-session charges are not enabled for this organization, or its account can't currently accept payments.
   * @throws {ResourceNotFound} Order not found.
   * @throws {OrderNotDraft} The order is not in `draft` status.
   * @throws {HTTPValidationError} Validation Error
   */
  return async (id: string, body?: OrderFinalize): Promise<Order> => {
    const pathParams = {
      id: id,
    };
    const queryParams = {};
    const request = client.buildRequest(
      "POST",
      "/v1/orders/{id}/finalize",
      pathParams,
      queryParams,
      body,
    );
    const response = await client.sendRequest(request);
    return client.parseResponse<Order>(response, "json", {
      402: Finalize402Error,
      403: Finalize403Error,
      404: ResourceNotFound,
      412: OrderNotDraft,
      422: HTTPValidationError,
    });
  };
};
export const invoiceOrders = (client: ClientBase) => {
  /**
   * Get an order's invoice data.
   *
   * **Scopes**: `orders:read`
   *
   * @param id - The order ID.
   * @returns {OrderInvoice}
   * @throws {PolarNetworkError} When a network error occurs
   * @throws {PolarServerError} When the server returns a 5xx error
   * @throws {ResourceNotFound} Order not found.
   * @throws {HTTPValidationError} Validation Error
   */
  return async (id: string): Promise<OrderInvoice> => {
    const pathParams = {
      id: id,
    };
    const queryParams = {};
    const request = client.buildRequest(
      "GET",
      "/v1/orders/{id}/invoice",
      pathParams,
      queryParams,
      undefined,
    );
    const response = await client.sendRequest(request);
    return client.parseResponse<OrderInvoice>(response, "json", {
      404: ResourceNotFound,
      422: HTTPValidationError,
    });
  };
};
export const generateInvoiceOrders = (client: ClientBase) => {
  /**
   * Trigger generation of an order's invoice.
   *
   * **Scopes**: `orders:read`
   *
   * @param id - The order ID.
   * @returns {unknown}
   * @throws {PolarNetworkError} When a network error occurs
   * @throws {PolarServerError} When the server returns a 5xx error
   * @throws {ResourceNotFound} Order not found.
   * @throws {MissingInvoiceBillingDetails} Order is missing billing name or address.
   */
  return async (id: string): Promise<unknown> => {
    const pathParams = {
      id: id,
    };
    const queryParams = {};
    const request = client.buildRequest(
      "POST",
      "/v1/orders/{id}/invoice",
      pathParams,
      queryParams,
      undefined,
    );
    const response = await client.sendRequest(request);
    return client.parseResponse<unknown>(response, "json", {
      404: ResourceNotFound,
      422: MissingInvoiceBillingDetails,
    });
  };
};
export const receiptOrders = (client: ClientBase) => {
  /**
   * Get a presigned URL to download an order's receipt PDF.
   *
   * **Scopes**: `orders:read`
   *
   * @param id - The order ID.
   * @returns {OrderReceipt}
   * @throws {PolarNetworkError} When a network error occurs
   * @throws {PolarServerError} When the server returns a 5xx error
   * @throws {ResourceNotFound} Order not found.
   * @throws {HTTPValidationError} Validation Error
   */
  return async (id: string): Promise<OrderReceipt> => {
    const pathParams = {
      id: id,
    };
    const queryParams = {};
    const request = client.buildRequest(
      "GET",
      "/v1/orders/{id}/receipt",
      pathParams,
      queryParams,
      undefined,
    );
    const response = await client.sendRequest(request);
    return client.parseResponse<OrderReceipt>(response, "json", {
      404: ResourceNotFound,
      422: HTTPValidationError,
    });
  };
};

export function createOrdersService(client: ClientBase) {
  return {
    list: listOrders(client),
    create: createOrders(client),
    export: exportOrders(client),
    get: getOrders(client),
    update: updateOrders(client),
    finalize: finalizeOrders(client),
    invoice: invoiceOrders(client),
    generateInvoice: generateInvoiceOrders(client),
    receipt: receiptOrders(client),
  };
}

export type Orders = ReturnType<typeof createOrdersService>;
