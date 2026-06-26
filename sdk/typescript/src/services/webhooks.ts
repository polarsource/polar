import { ClientBase } from "../base";
import type { WebhookEndpointCreate, WebhookEndpointUpdate } from "../models/inputs";
import type {
  ListResourceWebhookDelivery,
  ListResourceWebhookEndpoint,
  WebhookEndpoint,
} from "../models/outputs";
import type { WebhookEventType } from "../models/literals";
import { HTTPValidationError, ResourceNotFound } from "../errors";

export const listWebhookEndpointsWebhooks = (client: ClientBase) => {
  /**
   * List webhook endpoints.
   *
   * **Scopes**: `webhooks:read` `webhooks:write`
   *
   * @param query - Query parameters
   * @returns {ListResourceWebhookEndpoint}
   * @throws {PolarNetworkError} When a network error occurs
   * @throws {PolarServerError} When the server returns a 5xx error
   * @throws {HTTPValidationError} Validation Error
   */
  return async (query?: {
    organization_id?: string | string[] | null;
    page?: number;
    limit?: number;
  }): Promise<ListResourceWebhookEndpoint> => {
    const pathParams = {};
    const queryParams = {
      organization_id: query?.organization_id,
      page: query?.page || 1,
      limit: query?.limit || 10,
    };
    const request = client.buildRequest(
      "GET",
      "/v1/webhooks/endpoints",
      pathParams,
      queryParams,
      undefined,
    );
    const response = await client.sendRequest(request);
    return client.parseResponse<ListResourceWebhookEndpoint>(response, "json", {
      422: HTTPValidationError,
    });
  };
};
export const createWebhookEndpointWebhooks = (client: ClientBase) => {
  /**
   * Create a webhook endpoint.
   *
   * **Scopes**: `webhooks:write`
   *
   * @param body - Request body
   * @returns {WebhookEndpoint}
   * @throws {PolarNetworkError} When a network error occurs
   * @throws {PolarServerError} When the server returns a 5xx error
   * @throws {HTTPValidationError} Validation Error
   */
  return async (body: WebhookEndpointCreate): Promise<WebhookEndpoint> => {
    const pathParams = {};
    const queryParams = {};
    const request = client.buildRequest(
      "POST",
      "/v1/webhooks/endpoints",
      pathParams,
      queryParams,
      body,
    );
    const response = await client.sendRequest(request);
    return client.parseResponse<WebhookEndpoint>(response, "json", {
      422: HTTPValidationError,
    });
  };
};
export const getWebhookEndpointWebhooks = (client: ClientBase) => {
  /**
   * Get a webhook endpoint by ID.
   *
   * **Scopes**: `webhooks:read` `webhooks:write`
   *
   * @param id - The webhook endpoint ID.
   * @returns {WebhookEndpoint}
   * @throws {PolarNetworkError} When a network error occurs
   * @throws {PolarServerError} When the server returns a 5xx error
   * @throws {ResourceNotFound} Webhook endpoint not found.
   * @throws {HTTPValidationError} Validation Error
   */
  return async (id: string): Promise<WebhookEndpoint> => {
    const pathParams = {
      id: id,
    };
    const queryParams = {};
    const request = client.buildRequest(
      "GET",
      "/v1/webhooks/endpoints/{id}",
      pathParams,
      queryParams,
      undefined,
    );
    const response = await client.sendRequest(request);
    return client.parseResponse<WebhookEndpoint>(response, "json", {
      404: ResourceNotFound,
      422: HTTPValidationError,
    });
  };
};
export const deleteWebhookEndpointWebhooks = (client: ClientBase) => {
  /**
   * Delete a webhook endpoint.
   *
   * **Scopes**: `webhooks:write`
   *
   * @param id - The webhook endpoint ID.
   * @returns {void}
   * @throws {PolarNetworkError} When a network error occurs
   * @throws {PolarServerError} When the server returns a 5xx error
   * @throws {ResourceNotFound} Webhook endpoint not found.
   * @throws {HTTPValidationError} Validation Error
   */
  return async (id: string): Promise<void> => {
    const pathParams = {
      id: id,
    };
    const queryParams = {};
    const request = client.buildRequest(
      "DELETE",
      "/v1/webhooks/endpoints/{id}",
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
export const updateWebhookEndpointWebhooks = (client: ClientBase) => {
  /**
   * Update a webhook endpoint.
   *
   * **Scopes**: `webhooks:write`
   *
   * @param id - The webhook endpoint ID.
   * @param body - Request body
   * @returns {WebhookEndpoint}
   * @throws {PolarNetworkError} When a network error occurs
   * @throws {PolarServerError} When the server returns a 5xx error
   * @throws {ResourceNotFound} Webhook endpoint not found.
   * @throws {HTTPValidationError} Validation Error
   */
  return async (id: string, body: WebhookEndpointUpdate): Promise<WebhookEndpoint> => {
    const pathParams = {
      id: id,
    };
    const queryParams = {};
    const request = client.buildRequest(
      "PATCH",
      "/v1/webhooks/endpoints/{id}",
      pathParams,
      queryParams,
      body,
    );
    const response = await client.sendRequest(request);
    return client.parseResponse<WebhookEndpoint>(response, "json", {
      404: ResourceNotFound,
      422: HTTPValidationError,
    });
  };
};
export const resetWebhookEndpointSecretWebhooks = (client: ClientBase) => {
  /**
   * Regenerate a webhook endpoint secret.
   *
   * **Scopes**: `webhooks:write`
   *
   * @param id - The webhook endpoint ID.
   * @returns {WebhookEndpoint}
   * @throws {PolarNetworkError} When a network error occurs
   * @throws {PolarServerError} When the server returns a 5xx error
   * @throws {ResourceNotFound} Webhook endpoint not found.
   * @throws {HTTPValidationError} Validation Error
   */
  return async (id: string): Promise<WebhookEndpoint> => {
    const pathParams = {
      id: id,
    };
    const queryParams = {};
    const request = client.buildRequest(
      "PATCH",
      "/v1/webhooks/endpoints/{id}/secret",
      pathParams,
      queryParams,
      undefined,
    );
    const response = await client.sendRequest(request);
    return client.parseResponse<WebhookEndpoint>(response, "json", {
      404: ResourceNotFound,
      422: HTTPValidationError,
    });
  };
};
export const listWebhookDeliveriesWebhooks = (client: ClientBase) => {
  /**
   * List webhook deliveries.
   *
   * Deliveries are all the attempts to deliver a webhook event to an endpoint.
   *
   * **Scopes**: `webhooks:read` `webhooks:write`
   *
   * @param query - Query parameters
   * @returns {ListResourceWebhookDelivery}
   * @throws {PolarNetworkError} When a network error occurs
   * @throws {PolarServerError} When the server returns a 5xx error
   * @throws {HTTPValidationError} Validation Error
   */
  return async (query?: {
    endpoint_id?: string | string[] | null;
    start_timestamp?: string | null;
    end_timestamp?: string | null;
    succeeded?: boolean | null;
    query?: string | null;
    http_code_class?: "2xx" | "3xx" | "4xx" | "5xx" | null;
    event_type?: WebhookEventType | WebhookEventType[] | null;
    page?: number;
    limit?: number;
  }): Promise<ListResourceWebhookDelivery> => {
    const pathParams = {};
    const queryParams = {
      endpoint_id: query?.endpoint_id,
      start_timestamp: query?.start_timestamp,
      end_timestamp: query?.end_timestamp,
      succeeded: query?.succeeded,
      query: query?.query,
      http_code_class: query?.http_code_class,
      event_type: query?.event_type,
      page: query?.page || 1,
      limit: query?.limit || 10,
    };
    const request = client.buildRequest(
      "GET",
      "/v1/webhooks/deliveries",
      pathParams,
      queryParams,
      undefined,
    );
    const response = await client.sendRequest(request);
    return client.parseResponse<ListResourceWebhookDelivery>(response, "json", {
      422: HTTPValidationError,
    });
  };
};
export const redeliverWebhookEventWebhooks = (client: ClientBase) => {
  /**
   * Schedule the re-delivery of a webhook event.
   *
   * **Scopes**: `webhooks:write`
   *
   * @param id - The webhook event ID.
   * @returns {unknown}
   * @throws {PolarNetworkError} When a network error occurs
   * @throws {PolarServerError} When the server returns a 5xx error
   * @throws {ResourceNotFound} Webhook event not found.
   * @throws {HTTPValidationError} Validation Error
   */
  return async (id: string): Promise<unknown> => {
    const pathParams = {
      id: id,
    };
    const queryParams = {};
    const request = client.buildRequest(
      "POST",
      "/v1/webhooks/events/{id}/redeliver",
      pathParams,
      queryParams,
      undefined,
    );
    const response = await client.sendRequest(request);
    return client.parseResponse<unknown>(response, "json", {
      404: ResourceNotFound,
      422: HTTPValidationError,
    });
  };
};

export function createWebhooksService(client: ClientBase) {
  return {
    listWebhookEndpoints: listWebhookEndpointsWebhooks(client),
    createWebhookEndpoint: createWebhookEndpointWebhooks(client),
    getWebhookEndpoint: getWebhookEndpointWebhooks(client),
    deleteWebhookEndpoint: deleteWebhookEndpointWebhooks(client),
    updateWebhookEndpoint: updateWebhookEndpointWebhooks(client),
    resetWebhookEndpointSecret: resetWebhookEndpointSecretWebhooks(client),
    listWebhookDeliveries: listWebhookDeliveriesWebhooks(client),
    redeliverWebhookEvent: redeliverWebhookEventWebhooks(client),
  };
}

export type Webhooks = ReturnType<typeof createWebhooksService>;
