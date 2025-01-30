/* tslint:disable */
/* eslint-disable */
/**
 * Polar API
 * Read the docs at https://docs.polar.sh/api-reference
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
  CustomerIDFilter,
  Event,
  EventSortProperty,
  EventsIngest,
  EventsIngestResponse,
  ExternalCustomerIDFilter,
  HTTPValidationError,
  ListResourceEvent,
  MetadataQueryValue,
  OrganizationIDFilter1,
  ResourceNotFound,
  SourceFilter,
} from '../models/index';

export interface EventsApiGetRequest {
    id: string;
}

export interface EventsApiIngestRequest {
    body: EventsIngest;
}

export interface EventsApiListRequest {
    startTimestamp?: string | null;
    endTimestamp?: string | null;
    organizationId?: OrganizationIDFilter1 | null;
    customerId?: CustomerIDFilter | null;
    externalCustomerId?: ExternalCustomerIDFilter | null;
    source?: SourceFilter | null;
    page?: number;
    limit?: number;
    sorting?: Array<EventSortProperty> | null;
    metadata?: { [key: string]: MetadataQueryValue; } | null;
}

/**
 * 
 */
export class EventsApi extends runtime.BaseAPI {

    /**
     * Get an event by ID.
     * Get Event
     */
    async getRaw(requestParameters: EventsApiGetRequest, initOverrides?: RequestInit | runtime.InitOverrideFunction): Promise<runtime.ApiResponse<Event>> {
        if (requestParameters['id'] == null) {
            throw new runtime.RequiredError(
                'id',
                'Required parameter "id" was null or undefined when calling get().'
            );
        }

        const queryParameters: any = {};

        const headerParameters: runtime.HTTPHeaders = {};

        if (this.configuration && this.configuration.accessToken) {
            const token = this.configuration.accessToken;
            const tokenString = await token("pat", []);

            if (tokenString) {
                headerParameters["Authorization"] = `Bearer ${tokenString}`;
            }
        }
        const response = await this.request({
            path: `/v1/events/{id}`.replace(`{${"id"}}`, encodeURIComponent(String(requestParameters['id']))),
            method: 'GET',
            headers: headerParameters,
            query: queryParameters,
        }, initOverrides);

        return new runtime.JSONApiResponse(response);
    }

    /**
     * Get an event by ID.
     * Get Event
     */
    async get(requestParameters: EventsApiGetRequest, initOverrides?: RequestInit | runtime.InitOverrideFunction): Promise<Event> {
        const response = await this.getRaw(requestParameters, initOverrides);
        return await response.value();
    }

    /**
     * Ingest batch of events.
     * Ingest Events
     */
    async ingestRaw(requestParameters: EventsApiIngestRequest, initOverrides?: RequestInit | runtime.InitOverrideFunction): Promise<runtime.ApiResponse<EventsIngestResponse>> {
        if (requestParameters['body'] == null) {
            throw new runtime.RequiredError(
                'body',
                'Required parameter "body" was null or undefined when calling ingest().'
            );
        }

        const queryParameters: any = {};

        const headerParameters: runtime.HTTPHeaders = {};

        headerParameters['Content-Type'] = 'application/json';

        if (this.configuration && this.configuration.accessToken) {
            const token = this.configuration.accessToken;
            const tokenString = await token("pat", []);

            if (tokenString) {
                headerParameters["Authorization"] = `Bearer ${tokenString}`;
            }
        }
        const response = await this.request({
            path: `/v1/events/ingest`,
            method: 'POST',
            headers: headerParameters,
            query: queryParameters,
            body: requestParameters['body'],
        }, initOverrides);

        return new runtime.JSONApiResponse(response);
    }

    /**
     * Ingest batch of events.
     * Ingest Events
     */
    async ingest(requestParameters: EventsApiIngestRequest, initOverrides?: RequestInit | runtime.InitOverrideFunction): Promise<EventsIngestResponse> {
        const response = await this.ingestRaw(requestParameters, initOverrides);
        return await response.value();
    }

    /**
     * List events.
     * List Events
     */
    async listRaw(requestParameters: EventsApiListRequest, initOverrides?: RequestInit | runtime.InitOverrideFunction): Promise<runtime.ApiResponse<ListResourceEvent>> {
        const queryParameters: any = {};

        if (requestParameters['startTimestamp'] != null) {
            queryParameters['start_timestamp'] = requestParameters['startTimestamp'];
        }

        if (requestParameters['endTimestamp'] != null) {
            queryParameters['end_timestamp'] = requestParameters['endTimestamp'];
        }

        if (requestParameters['organizationId'] != null) {
            queryParameters['organization_id'] = requestParameters['organizationId'];
        }

        if (requestParameters['customerId'] != null) {
            queryParameters['customer_id'] = requestParameters['customerId'];
        }

        if (requestParameters['externalCustomerId'] != null) {
            queryParameters['external_customer_id'] = requestParameters['externalCustomerId'];
        }

        if (requestParameters['source'] != null) {
            queryParameters['source'] = requestParameters['source'];
        }

        if (requestParameters['page'] != null) {
            queryParameters['page'] = requestParameters['page'];
        }

        if (requestParameters['limit'] != null) {
            queryParameters['limit'] = requestParameters['limit'];
        }

        if (requestParameters['sorting'] != null) {
            queryParameters['sorting'] = requestParameters['sorting'];
        }

        if (requestParameters['metadata'] != null) {
            queryParameters['metadata'] = requestParameters['metadata'];
        }

        const headerParameters: runtime.HTTPHeaders = {};

        if (this.configuration && this.configuration.accessToken) {
            const token = this.configuration.accessToken;
            const tokenString = await token("pat", []);

            if (tokenString) {
                headerParameters["Authorization"] = `Bearer ${tokenString}`;
            }
        }
        const response = await this.request({
            path: `/v1/events/`,
            method: 'GET',
            headers: headerParameters,
            query: queryParameters,
        }, initOverrides);

        return new runtime.JSONApiResponse(response);
    }

    /**
     * List events.
     * List Events
     */
    async list(requestParameters: EventsApiListRequest = {}, initOverrides?: RequestInit | runtime.InitOverrideFunction): Promise<ListResourceEvent> {
        const response = await this.listRaw(requestParameters, initOverrides);
        return await response.value();
    }

}
