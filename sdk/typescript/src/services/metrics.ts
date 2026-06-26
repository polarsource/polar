import { ClientBase } from "../base";
import type { MetricDashboardCreate, MetricDashboardUpdate } from "../models/inputs";
import type { MetricDashboardSchema, MetricsLimits, MetricsResponse } from "../models/outputs";
import type { ProductBillingType, TimeInterval, Timezone } from "../models/literals";
import { HTTPValidationError } from "../errors";

export const getMetrics = (client: ClientBase) => {
  /**
   * Get metrics about your orders and subscriptions.
   *
   * Currency values are output in cents.
   *
   * **Scopes**: `metrics:read`
   *
   * @param query - Query parameters
   * @returns {MetricsResponse}
   * @throws {PolarNetworkError} When a network error occurs
   * @throws {PolarServerError} When the server returns a 5xx error
   * @throws {HTTPValidationError} Validation Error
   */
  return async (query: {
    start_date: string;
    end_date: string;
    timezone?: Timezone;
    interval: TimeInterval;
    organization_id?: string | string[] | null;
    product_id?: string | string[] | null;
    billing_type?: ProductBillingType | ProductBillingType[] | null;
    customer_id?: string | string[] | null;
    metrics?: string[] | null;
  }): Promise<MetricsResponse> => {
    const pathParams = {};
    const queryParams = {
      start_date: query.start_date,
      end_date: query.end_date,
      timezone: query?.timezone || "UTC",
      interval: query.interval,
      organization_id: query?.organization_id,
      product_id: query?.product_id,
      billing_type: query?.billing_type,
      customer_id: query?.customer_id,
      metrics: query?.metrics,
    };
    const request = client.buildRequest("GET", "/v1/metrics/", pathParams, queryParams, undefined);
    const response = await client.sendRequest(request);
    return client.parseResponse<MetricsResponse>(response, "json", {
      422: HTTPValidationError,
    });
  };
};
export const exportMetrics = (client: ClientBase) => {
  /**
   * Export metrics as a CSV file.
   *
   * **Scopes**: `metrics:read`
   *
   * @param query - Query parameters
   * @returns {string}
   * @throws {PolarNetworkError} When a network error occurs
   * @throws {PolarServerError} When the server returns a 5xx error
   * @throws {HTTPValidationError} Validation Error
   */
  return async (query: {
    start_date: string;
    end_date: string;
    timezone?: Timezone;
    interval: TimeInterval;
    organization_id?: string | string[] | null;
    product_id?: string | string[] | null;
    billing_type?: ProductBillingType | ProductBillingType[] | null;
    customer_id?: string | string[] | null;
    metrics?: string[] | null;
  }): Promise<string> => {
    const pathParams = {};
    const queryParams = {
      start_date: query.start_date,
      end_date: query.end_date,
      timezone: query?.timezone || "UTC",
      interval: query.interval,
      organization_id: query?.organization_id,
      product_id: query?.product_id,
      billing_type: query?.billing_type,
      customer_id: query?.customer_id,
      metrics: query?.metrics,
    };
    const request = client.buildRequest(
      "GET",
      "/v1/metrics/export",
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
export const limitsMetrics = (client: ClientBase) => {
  /**
   * Get the interval limits for the metrics endpoint.
   *
   * **Scopes**: `metrics:read`
   *
   * @returns {MetricsLimits}
   * @throws {PolarNetworkError} When a network error occurs
   * @throws {PolarServerError} When the server returns a 5xx error
   */
  return async (): Promise<MetricsLimits> => {
    const pathParams = {};
    const queryParams = {};
    const request = client.buildRequest(
      "GET",
      "/v1/metrics/limits",
      pathParams,
      queryParams,
      undefined,
    );
    const response = await client.sendRequest(request);
    return client.parseResponse<MetricsLimits>(response, "json", {});
  };
};
export const listDashboardsMetrics = (client: ClientBase) => {
  /**
   * List user-defined metric dashboards.
   *
   * **Scopes**: `metrics:read`
   *
   * @param query - Query parameters
   * @returns {MetricDashboardSchema[]}
   * @throws {PolarNetworkError} When a network error occurs
   * @throws {PolarServerError} When the server returns a 5xx error
   * @throws {HTTPValidationError} Validation Error
   */
  return async (query?: {
    organization_id?: string | string[] | null;
  }): Promise<MetricDashboardSchema[]> => {
    const pathParams = {};
    const queryParams = {
      organization_id: query?.organization_id,
    };
    const request = client.buildRequest(
      "GET",
      "/v1/metrics/dashboards",
      pathParams,
      queryParams,
      undefined,
    );
    const response = await client.sendRequest(request);
    return client.parseResponse<MetricDashboardSchema[]>(response, "json", {
      422: HTTPValidationError,
    });
  };
};
export const createDashboardMetrics = (client: ClientBase) => {
  /**
   * Create a user-defined metric dashboard.
   *
   * **Scopes**: `metrics:write`
   *
   * @param body - Request body
   * @returns {MetricDashboardSchema}
   * @throws {PolarNetworkError} When a network error occurs
   * @throws {PolarServerError} When the server returns a 5xx error
   * @throws {HTTPValidationError} Validation Error
   */
  return async (body: MetricDashboardCreate): Promise<MetricDashboardSchema> => {
    const pathParams = {};
    const queryParams = {};
    const request = client.buildRequest(
      "POST",
      "/v1/metrics/dashboards",
      pathParams,
      queryParams,
      body,
    );
    const response = await client.sendRequest(request);
    return client.parseResponse<MetricDashboardSchema>(response, "json", {
      422: HTTPValidationError,
    });
  };
};
export const getDashboardMetrics = (client: ClientBase) => {
  /**
   * Get a user-defined metric dashboard by ID.
   *
   * **Scopes**: `metrics:read`
   *
   * @param id - The metric dashboard ID.
   * @returns {MetricDashboardSchema}
   * @throws {PolarNetworkError} When a network error occurs
   * @throws {PolarServerError} When the server returns a 5xx error
   * @throws {HTTPValidationError} Validation Error
   */
  return async (id: string): Promise<MetricDashboardSchema> => {
    const pathParams = {
      id: id,
    };
    const queryParams = {};
    const request = client.buildRequest(
      "GET",
      "/v1/metrics/dashboards/{id}",
      pathParams,
      queryParams,
      undefined,
    );
    const response = await client.sendRequest(request);
    return client.parseResponse<MetricDashboardSchema>(response, "json", {
      422: HTTPValidationError,
    });
  };
};
export const deleteDashboardMetrics = (client: ClientBase) => {
  /**
   * Delete a user-defined metric dashboard.
   *
   * **Scopes**: `metrics:write`
   *
   * @param id - The metric dashboard ID.
   * @returns {void}
   * @throws {PolarNetworkError} When a network error occurs
   * @throws {PolarServerError} When the server returns a 5xx error
   * @throws {HTTPValidationError} Validation Error
   */
  return async (id: string): Promise<void> => {
    const pathParams = {
      id: id,
    };
    const queryParams = {};
    const request = client.buildRequest(
      "DELETE",
      "/v1/metrics/dashboards/{id}",
      pathParams,
      queryParams,
      undefined,
    );
    const response = await client.sendRequest(request);
    return client.parseResponse<void>(response, "none", {
      422: HTTPValidationError,
    });
  };
};
export const updateDashboardMetrics = (client: ClientBase) => {
  /**
   * Update a user-defined metric dashboard.
   *
   * **Scopes**: `metrics:write`
   *
   * @param id - The metric dashboard ID.
   * @param body - Request body
   * @returns {MetricDashboardSchema}
   * @throws {PolarNetworkError} When a network error occurs
   * @throws {PolarServerError} When the server returns a 5xx error
   * @throws {HTTPValidationError} Validation Error
   */
  return async (id: string, body: MetricDashboardUpdate): Promise<MetricDashboardSchema> => {
    const pathParams = {
      id: id,
    };
    const queryParams = {};
    const request = client.buildRequest(
      "PATCH",
      "/v1/metrics/dashboards/{id}",
      pathParams,
      queryParams,
      body,
    );
    const response = await client.sendRequest(request);
    return client.parseResponse<MetricDashboardSchema>(response, "json", {
      422: HTTPValidationError,
    });
  };
};

export function createMetricsService(client: ClientBase) {
  return {
    get: getMetrics(client),
    export: exportMetrics(client),
    limits: limitsMetrics(client),
    listDashboards: listDashboardsMetrics(client),
    createDashboard: createDashboardMetrics(client),
    getDashboard: getDashboardMetrics(client),
    deleteDashboard: deleteDashboardMetrics(client),
    updateDashboard: updateDashboardMetrics(client),
  };
}

export type Metrics = ReturnType<typeof createMetricsService>;
