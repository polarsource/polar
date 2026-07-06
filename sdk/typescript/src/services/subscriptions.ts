import type { ClientBase } from "../base";
import type {
  MetadataQuery,
  SubscriptionCreateCustomer,
  SubscriptionCreateExternalCustomer,
  SubscriptionUpdate,
} from "../models/inputs";
import type {
  CustomerCancellationReason,
  SubscriptionSortProperty,
  SubscriptionStatus,
} from "../models/literals";
import type { ListResourceSubscription, Subscription } from "../models/outputs";

import {
  AlreadyCanceledSubscription,
  HTTPValidationError,
  PaymentFailed,
  ResourceNotFound,
  SubscriptionLocked,
} from "../errors";

export const listSubscriptions = (client: ClientBase) => {
  /**
   * List subscriptions.
   *
   * **Scopes**: `subscriptions:read` `subscriptions:write`
   *
   * @param query - Query parameters
   * @returns {ListResourceSubscription}
   * @throws {PolarNetworkError} When a network error occurs
   * @throws {PolarServerError} When the server returns a 5xx error
   * @throws {HTTPValidationError} Validation Error
   */
  return async (query?: {
    organization_id?: string | string[] | null;
    product_id?: string | string[] | null;
    customer_id?: string | string[] | null;
    external_customer_id?: string | string[] | null;
    discount_id?: string | string[] | null;
    active?: boolean | null;
    status?: SubscriptionStatus | SubscriptionStatus[] | null;
    cancel_at_period_end?: boolean | null;
    customer_cancellation_reason?: CustomerCancellationReason | CustomerCancellationReason[] | null;
    canceled_at_after?: string | null;
    canceled_at_before?: string | null;
    page?: number;
    limit?: number;
    sorting?: SubscriptionSortProperty[] | null;
    metadata?: MetadataQuery;
  }): Promise<ListResourceSubscription> => {
    const pathParams = {};
    const queryParams = {
      organization_id: query?.organization_id,
      product_id: query?.product_id,
      customer_id: query?.customer_id,
      external_customer_id: query?.external_customer_id,
      discount_id: query?.discount_id,
      active: query?.active,
      status: query?.status,
      cancel_at_period_end: query?.cancel_at_period_end,
      customer_cancellation_reason: query?.customer_cancellation_reason,
      canceled_at_after: query?.canceled_at_after,
      canceled_at_before: query?.canceled_at_before,
      page: query?.page ?? 1,
      limit: query?.limit ?? 10,
      sorting: query?.sorting ?? ["-started_at"],
      metadata: query?.metadata,
    };
    const request = client.buildRequest(
      "GET",
      "/v1/subscriptions/",
      pathParams,
      queryParams,
      undefined,
    );
    const response = await client.sendRequest(request);
    return client.parseResponse<ListResourceSubscription>(response, "json", {
      422: HTTPValidationError,
    });
  };
};
/**
 * List subscriptions.
 *
 * **Scopes**: `subscriptions:read` `subscriptions:write`
 *
 * @param query - Query parameters
 * @returns {AsyncGenerator<Subscription>} A generator that yields items of type Subscription.
 * @throws {PolarNetworkError} When a network error occurs
 * @throws {PolarServerError} When the server returns a 5xx error
 * @throws {HTTPValidationError} Validation Error
 */
export const iterlistSubscriptions = (client: ClientBase) => {
  return async function* (query?: {
    organization_id?: string | string[] | null;
    product_id?: string | string[] | null;
    customer_id?: string | string[] | null;
    external_customer_id?: string | string[] | null;
    discount_id?: string | string[] | null;
    active?: boolean | null;
    status?: SubscriptionStatus | SubscriptionStatus[] | null;
    cancel_at_period_end?: boolean | null;
    customer_cancellation_reason?: CustomerCancellationReason | CustomerCancellationReason[] | null;
    canceled_at_after?: string | null;
    canceled_at_before?: string | null;
    page?: number;
    limit?: number;
    sorting?: SubscriptionSortProperty[] | null;
    metadata?: MetadataQuery;
  }): AsyncGenerator<Subscription> {
    let page: number;
    page = query?.page ?? 1;
    let limit: number | undefined;
    limit = query?.limit;

    while (true) {
      const response = await listSubscriptions(client)({ ...query, page, limit });
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
export const createSubscriptions = (client: ClientBase) => {
  /**
   * Create a subscription programmatically.
   *
   * This endpoint only allows to create subscription on free products.
   * For paid products, use the checkout flow.
   *
   * No initial order will be created and no confirmation email will be sent.
   *
   * **Scopes**: `subscriptions:write`
   *
   * @param body - Request body
   * @returns {Subscription}
   * @throws {PolarNetworkError} When a network error occurs
   * @throws {PolarServerError} When the server returns a 5xx error
   * @throws {HTTPValidationError} Validation Error
   */
  return async (
    body: SubscriptionCreateCustomer | SubscriptionCreateExternalCustomer,
  ): Promise<Subscription> => {
    const pathParams = {};
    const queryParams = {};
    const request = client.buildRequest(
      "POST",
      "/v1/subscriptions/",
      pathParams,
      queryParams,
      body,
    );
    const response = await client.sendRequest(request);
    return client.parseResponse<Subscription>(response, "json", {
      422: HTTPValidationError,
    });
  };
};
export const exportSubscriptions = (client: ClientBase) => {
  /**
   * Export subscriptions as a CSV file.
   *
   * **Scopes**: `subscriptions:read` `subscriptions:write`
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
      "/v1/subscriptions/export",
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
export const getSubscriptions = (client: ClientBase) => {
  /**
   * Get a subscription by ID.
   *
   * **Scopes**: `subscriptions:read` `subscriptions:write`
   *
   * @param id - The subscription ID.
   * @returns {Subscription}
   * @throws {PolarNetworkError} When a network error occurs
   * @throws {PolarServerError} When the server returns a 5xx error
   * @throws {ResourceNotFound} Subscription not found.
   * @throws {HTTPValidationError} Validation Error
   */
  return async (id: string): Promise<Subscription> => {
    const pathParams = {
      id: id,
    };
    const queryParams = {};
    const request = client.buildRequest(
      "GET",
      "/v1/subscriptions/{id}",
      pathParams,
      queryParams,
      undefined,
    );
    const response = await client.sendRequest(request);
    return client.parseResponse<Subscription>(response, "json", {
      404: ResourceNotFound,
      422: HTTPValidationError,
    });
  };
};
export const revokeSubscriptions = (client: ClientBase) => {
  /**
   * Revoke a subscription, i.e cancel immediately.
   *
   * **Scopes**: `subscriptions:write`
   *
   * @param id - The subscription ID.
   * @returns {Subscription}
   * @throws {PolarNetworkError} When a network error occurs
   * @throws {PolarServerError} When the server returns a 5xx error
   * @throws {AlreadyCanceledSubscription} This subscription is already revoked.
   * @throws {ResourceNotFound} Subscription not found.
   * @throws {SubscriptionLocked} Subscription is pending an update.
   * @throws {HTTPValidationError} Validation Error
   */
  return async (id: string): Promise<Subscription> => {
    const pathParams = {
      id: id,
    };
    const queryParams = {};
    const request = client.buildRequest(
      "DELETE",
      "/v1/subscriptions/{id}",
      pathParams,
      queryParams,
      undefined,
    );
    const response = await client.sendRequest(request);
    return client.parseResponse<Subscription>(response, "json", {
      403: AlreadyCanceledSubscription,
      404: ResourceNotFound,
      409: SubscriptionLocked,
      422: HTTPValidationError,
    });
  };
};
export const updateSubscriptions = (client: ClientBase) => {
  /**
   * Update a subscription.
   *
   * **Scopes**: `subscriptions:write`
   *
   * @param id - The subscription ID.
   * @param body - Request body
   * @returns {Subscription}
   * @throws {PolarNetworkError} When a network error occurs
   * @throws {PolarServerError} When the server returns a 5xx error
   * @throws {PaymentFailed} Payment required to apply the subscription update.
   * @throws {AlreadyCanceledSubscription} Subscription is already canceled or will be at the end of the period.
   * @throws {ResourceNotFound} Subscription not found.
   * @throws {SubscriptionLocked} Subscription is pending an update.
   * @throws {HTTPValidationError} Validation Error
   */
  return async (id: string, body: SubscriptionUpdate): Promise<Subscription> => {
    const pathParams = {
      id: id,
    };
    const queryParams = {};
    const request = client.buildRequest(
      "PATCH",
      "/v1/subscriptions/{id}",
      pathParams,
      queryParams,
      body,
    );
    const response = await client.sendRequest(request);
    return client.parseResponse<Subscription>(response, "json", {
      402: PaymentFailed,
      403: AlreadyCanceledSubscription,
      404: ResourceNotFound,
      409: SubscriptionLocked,
      422: HTTPValidationError,
    });
  };
};

export function createSubscriptionsService(client: ClientBase) {
  return {
    list: listSubscriptions(client),
    create: createSubscriptions(client),
    export: exportSubscriptions(client),
    get: getSubscriptions(client),
    revoke: revokeSubscriptions(client),
    update: updateSubscriptions(client),
    iterlist: iterlistSubscriptions(client),
  };
}

export type Subscriptions = ReturnType<typeof createSubscriptionsService>;
