/* tslint:disable */
/* eslint-disable */
/**
 * Polar API
 *  Welcome to the **Polar API** for [polar.sh](https://polar.sh).  This specification contains both the definitions of the Polar HTTP API and the Webhook API.  #### Authentication  Use a [Personal Access Token](https://polar.sh/settings) and send it in the `Authorization` header on the format `Bearer [YOUR_TOKEN]`.  #### Feedback  If you have any feedback or comments, reach out in the [Polar API-issue](https://github.com/polarsource/polar/issues/834), or reach out on the Polar Discord server.  We\'d love to see what you\'ve built with the API and to get your thoughts on how we can make the API better!  #### Connecting  The Polar API is online at `https://api.polar.sh`. 
 *
 * The version of the OpenAPI document: 0.1.0
 * 
 *
 * NOTE: This class is auto generated by OpenAPI Generator (https://openapi-generator.tech).
 * https://openapi-generator.tech
 * Do not edit the class manually.
 */


import * as runtime from '../runtime';
import type {
  HTTPValidationError,
  ListResourceWebhookDelivery,
  ListResourceWebhookEndpoint,
  WebhookEndpoint,
  WebhookEndpointCreate,
  WebhookEndpointUpdate,
} from '../models/index';

export interface WebhooksApiCreateWebhookEndpointRequest {
    webhookEndpointCreate: WebhookEndpointCreate;
}

export interface WebhooksApiDeleteWebhookEndpointRequest {
    id: string;
}

export interface WebhooksApiGetWebhookEndpointRequest {
    id: string;
}

export interface WebhooksApiListWebhookDeliveriesRequest {
    endpointId?: string;
    page?: number;
    limit?: number;
}

export interface WebhooksApiListWebhookEndpointsRequest {
    organizationId?: string;
    userId?: string;
    page?: number;
    limit?: number;
}

export interface WebhooksApiRedeliverWebhookEventRequest {
    id: string;
}

export interface WebhooksApiUpdateWebhookEndpointRequest {
    id: string;
    webhookEndpointUpdate: WebhookEndpointUpdate;
}

/**
 * 
 */
export class WebhooksApi extends runtime.BaseAPI {

    /**
     * Create a new Webhook Endpoint
     * Create Webhook Endpoint
     */
    async createWebhookEndpointRaw(requestParameters: WebhooksApiCreateWebhookEndpointRequest, initOverrides?: RequestInit | runtime.InitOverrideFunction): Promise<runtime.ApiResponse<WebhookEndpoint>> {
        if (requestParameters['webhookEndpointCreate'] == null) {
            throw new runtime.RequiredError(
                'webhookEndpointCreate',
                'Required parameter "webhookEndpointCreate" was null or undefined when calling createWebhookEndpoint().'
            );
        }

        const queryParameters: any = {};

        const headerParameters: runtime.HTTPHeaders = {};

        headerParameters['Content-Type'] = 'application/json';

        if (this.configuration && this.configuration.accessToken) {
            const token = this.configuration.accessToken;
            const tokenString = await token("HTTPBearer", []);

            if (tokenString) {
                headerParameters["Authorization"] = `Bearer ${tokenString}`;
            }
        }
        const response = await this.request({
            path: `/api/v1/webhooks/endpoints`,
            method: 'POST',
            headers: headerParameters,
            query: queryParameters,
            body: requestParameters['webhookEndpointCreate'],
        }, initOverrides);

        return new runtime.JSONApiResponse(response);
    }

    /**
     * Create a new Webhook Endpoint
     * Create Webhook Endpoint
     */
    async createWebhookEndpoint(requestParameters: WebhooksApiCreateWebhookEndpointRequest, initOverrides?: RequestInit | runtime.InitOverrideFunction): Promise<WebhookEndpoint> {
        const response = await this.createWebhookEndpointRaw(requestParameters, initOverrides);
        return await response.value();
    }

    /**
     * Delete a Webhook Endpoint
     * Delete Webhook Endpoint
     */
    async deleteWebhookEndpointRaw(requestParameters: WebhooksApiDeleteWebhookEndpointRequest, initOverrides?: RequestInit | runtime.InitOverrideFunction): Promise<runtime.ApiResponse<void>> {
        if (requestParameters['id'] == null) {
            throw new runtime.RequiredError(
                'id',
                'Required parameter "id" was null or undefined when calling deleteWebhookEndpoint().'
            );
        }

        const queryParameters: any = {};

        const headerParameters: runtime.HTTPHeaders = {};

        if (this.configuration && this.configuration.accessToken) {
            const token = this.configuration.accessToken;
            const tokenString = await token("HTTPBearer", []);

            if (tokenString) {
                headerParameters["Authorization"] = `Bearer ${tokenString}`;
            }
        }
        const response = await this.request({
            path: `/api/v1/webhooks/endpoints/{id}`.replace(`{${"id"}}`, encodeURIComponent(String(requestParameters['id']))),
            method: 'DELETE',
            headers: headerParameters,
            query: queryParameters,
        }, initOverrides);

        return new runtime.VoidApiResponse(response);
    }

    /**
     * Delete a Webhook Endpoint
     * Delete Webhook Endpoint
     */
    async deleteWebhookEndpoint(requestParameters: WebhooksApiDeleteWebhookEndpointRequest, initOverrides?: RequestInit | runtime.InitOverrideFunction): Promise<void> {
        await this.deleteWebhookEndpointRaw(requestParameters, initOverrides);
    }

    /**
     * Get a Webhook Endpoint
     * Get Webhook Endpoint
     */
    async getWebhookEndpointRaw(requestParameters: WebhooksApiGetWebhookEndpointRequest, initOverrides?: RequestInit | runtime.InitOverrideFunction): Promise<runtime.ApiResponse<WebhookEndpoint>> {
        if (requestParameters['id'] == null) {
            throw new runtime.RequiredError(
                'id',
                'Required parameter "id" was null or undefined when calling getWebhookEndpoint().'
            );
        }

        const queryParameters: any = {};

        const headerParameters: runtime.HTTPHeaders = {};

        if (this.configuration && this.configuration.accessToken) {
            const token = this.configuration.accessToken;
            const tokenString = await token("HTTPBearer", []);

            if (tokenString) {
                headerParameters["Authorization"] = `Bearer ${tokenString}`;
            }
        }
        const response = await this.request({
            path: `/api/v1/webhooks/endpoints/{id}`.replace(`{${"id"}}`, encodeURIComponent(String(requestParameters['id']))),
            method: 'GET',
            headers: headerParameters,
            query: queryParameters,
        }, initOverrides);

        return new runtime.JSONApiResponse(response);
    }

    /**
     * Get a Webhook Endpoint
     * Get Webhook Endpoint
     */
    async getWebhookEndpoint(requestParameters: WebhooksApiGetWebhookEndpointRequest, initOverrides?: RequestInit | runtime.InitOverrideFunction): Promise<WebhookEndpoint> {
        const response = await this.getWebhookEndpointRaw(requestParameters, initOverrides);
        return await response.value();
    }

    /**
     * List Webhook Deliveries
     * List Webhook Deliveries
     */
    async listWebhookDeliveriesRaw(requestParameters: WebhooksApiListWebhookDeliveriesRequest, initOverrides?: RequestInit | runtime.InitOverrideFunction): Promise<runtime.ApiResponse<ListResourceWebhookDelivery>> {
        const queryParameters: any = {};

        if (requestParameters['endpointId'] != null) {
            queryParameters['endpoint_id'] = requestParameters['endpointId'];
        }

        if (requestParameters['page'] != null) {
            queryParameters['page'] = requestParameters['page'];
        }

        if (requestParameters['limit'] != null) {
            queryParameters['limit'] = requestParameters['limit'];
        }

        const headerParameters: runtime.HTTPHeaders = {};

        if (this.configuration && this.configuration.accessToken) {
            const token = this.configuration.accessToken;
            const tokenString = await token("HTTPBearer", []);

            if (tokenString) {
                headerParameters["Authorization"] = `Bearer ${tokenString}`;
            }
        }
        const response = await this.request({
            path: `/api/v1/webhooks/deliveries`,
            method: 'GET',
            headers: headerParameters,
            query: queryParameters,
        }, initOverrides);

        return new runtime.JSONApiResponse(response);
    }

    /**
     * List Webhook Deliveries
     * List Webhook Deliveries
     */
    async listWebhookDeliveries(requestParameters: WebhooksApiListWebhookDeliveriesRequest = {}, initOverrides?: RequestInit | runtime.InitOverrideFunction): Promise<ListResourceWebhookDelivery> {
        const response = await this.listWebhookDeliveriesRaw(requestParameters, initOverrides);
        return await response.value();
    }

    /**
     * List Webhook Endpoints
     * List Webhook Endpoints
     */
    async listWebhookEndpointsRaw(requestParameters: WebhooksApiListWebhookEndpointsRequest, initOverrides?: RequestInit | runtime.InitOverrideFunction): Promise<runtime.ApiResponse<ListResourceWebhookEndpoint>> {
        const queryParameters: any = {};

        if (requestParameters['organizationId'] != null) {
            queryParameters['organization_id'] = requestParameters['organizationId'];
        }

        if (requestParameters['userId'] != null) {
            queryParameters['user_id'] = requestParameters['userId'];
        }

        if (requestParameters['page'] != null) {
            queryParameters['page'] = requestParameters['page'];
        }

        if (requestParameters['limit'] != null) {
            queryParameters['limit'] = requestParameters['limit'];
        }

        const headerParameters: runtime.HTTPHeaders = {};

        if (this.configuration && this.configuration.accessToken) {
            const token = this.configuration.accessToken;
            const tokenString = await token("HTTPBearer", []);

            if (tokenString) {
                headerParameters["Authorization"] = `Bearer ${tokenString}`;
            }
        }
        const response = await this.request({
            path: `/api/v1/webhooks/endpoints`,
            method: 'GET',
            headers: headerParameters,
            query: queryParameters,
        }, initOverrides);

        return new runtime.JSONApiResponse(response);
    }

    /**
     * List Webhook Endpoints
     * List Webhook Endpoints
     */
    async listWebhookEndpoints(requestParameters: WebhooksApiListWebhookEndpointsRequest = {}, initOverrides?: RequestInit | runtime.InitOverrideFunction): Promise<ListResourceWebhookEndpoint> {
        const response = await this.listWebhookEndpointsRaw(requestParameters, initOverrides);
        return await response.value();
    }

    /**
     * Schedule a re-delivery of a Webhook Event
     * Redeliver Webhook Event
     */
    async redeliverWebhookEventRaw(requestParameters: WebhooksApiRedeliverWebhookEventRequest, initOverrides?: RequestInit | runtime.InitOverrideFunction): Promise<runtime.ApiResponse<any>> {
        if (requestParameters['id'] == null) {
            throw new runtime.RequiredError(
                'id',
                'Required parameter "id" was null or undefined when calling redeliverWebhookEvent().'
            );
        }

        const queryParameters: any = {};

        const headerParameters: runtime.HTTPHeaders = {};

        if (this.configuration && this.configuration.accessToken) {
            const token = this.configuration.accessToken;
            const tokenString = await token("HTTPBearer", []);

            if (tokenString) {
                headerParameters["Authorization"] = `Bearer ${tokenString}`;
            }
        }
        const response = await this.request({
            path: `/api/v1/webhooks/events/{id}/redeliver`.replace(`{${"id"}}`, encodeURIComponent(String(requestParameters['id']))),
            method: 'POST',
            headers: headerParameters,
            query: queryParameters,
        }, initOverrides);

        if (this.isJsonMime(response.headers.get('content-type'))) {
            return new runtime.JSONApiResponse<any>(response);
        } else {
            return new runtime.TextApiResponse(response) as any;
        }
    }

    /**
     * Schedule a re-delivery of a Webhook Event
     * Redeliver Webhook Event
     */
    async redeliverWebhookEvent(requestParameters: WebhooksApiRedeliverWebhookEventRequest, initOverrides?: RequestInit | runtime.InitOverrideFunction): Promise<any> {
        const response = await this.redeliverWebhookEventRaw(requestParameters, initOverrides);
        return await response.value();
    }

    /**
     * Update a Webhook Endpoint
     * Update Webhook Endpoint
     */
    async updateWebhookEndpointRaw(requestParameters: WebhooksApiUpdateWebhookEndpointRequest, initOverrides?: RequestInit | runtime.InitOverrideFunction): Promise<runtime.ApiResponse<WebhookEndpoint>> {
        if (requestParameters['id'] == null) {
            throw new runtime.RequiredError(
                'id',
                'Required parameter "id" was null or undefined when calling updateWebhookEndpoint().'
            );
        }

        if (requestParameters['webhookEndpointUpdate'] == null) {
            throw new runtime.RequiredError(
                'webhookEndpointUpdate',
                'Required parameter "webhookEndpointUpdate" was null or undefined when calling updateWebhookEndpoint().'
            );
        }

        const queryParameters: any = {};

        const headerParameters: runtime.HTTPHeaders = {};

        headerParameters['Content-Type'] = 'application/json';

        if (this.configuration && this.configuration.accessToken) {
            const token = this.configuration.accessToken;
            const tokenString = await token("HTTPBearer", []);

            if (tokenString) {
                headerParameters["Authorization"] = `Bearer ${tokenString}`;
            }
        }
        const response = await this.request({
            path: `/api/v1/webhooks/endpoints/{id}`.replace(`{${"id"}}`, encodeURIComponent(String(requestParameters['id']))),
            method: 'PATCH',
            headers: headerParameters,
            query: queryParameters,
            body: requestParameters['webhookEndpointUpdate'],
        }, initOverrides);

        return new runtime.JSONApiResponse(response);
    }

    /**
     * Update a Webhook Endpoint
     * Update Webhook Endpoint
     */
    async updateWebhookEndpoint(requestParameters: WebhooksApiUpdateWebhookEndpointRequest, initOverrides?: RequestInit | runtime.InitOverrideFunction): Promise<WebhookEndpoint> {
        const response = await this.updateWebhookEndpointRaw(requestParameters, initOverrides);
        return await response.value();
    }

}
