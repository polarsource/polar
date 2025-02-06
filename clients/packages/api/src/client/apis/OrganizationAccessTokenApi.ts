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
  HTTPValidationError,
  ListResourceOrganizationAccessToken,
  OrganizationAccessToken,
  OrganizationAccessTokenCreate,
  OrganizationAccessTokenCreateResponse,
  OrganizationAccessTokenUpdate,
} from '../models/index';

export interface OrganizationAccessTokenApiCreateRequest {
    body: OrganizationAccessTokenCreate;
}

export interface OrganizationAccessTokenApiDeleteRequest {
    id: string;
}

export interface OrganizationAccessTokenApiListRequest {
    page?: number;
    limit?: number;
}

export interface OrganizationAccessTokenApiUpdateRequest {
    id: string;
    body: OrganizationAccessTokenUpdate;
}

/**
 * 
 */
export class OrganizationAccessTokenApi extends runtime.BaseAPI {

    /**
     * Create
     */
    async createRaw(requestParameters: OrganizationAccessTokenApiCreateRequest, initOverrides?: RequestInit | runtime.InitOverrideFunction): Promise<runtime.ApiResponse<OrganizationAccessTokenCreateResponse>> {
        if (requestParameters['body'] == null) {
            throw new runtime.RequiredError(
                'body',
                'Required parameter "body" was null or undefined when calling create().'
            );
        }

        const queryParameters: any = {};

        const headerParameters: runtime.HTTPHeaders = {};

        headerParameters['Content-Type'] = 'application/json';

        const response = await this.request({
            path: `/v1/organization-access-tokens/`,
            method: 'POST',
            headers: headerParameters,
            query: queryParameters,
            body: requestParameters['body'],
        }, initOverrides);

        return new runtime.JSONApiResponse(response);
    }

    /**
     * Create
     */
    async create(requestParameters: OrganizationAccessTokenApiCreateRequest, initOverrides?: RequestInit | runtime.InitOverrideFunction): Promise<OrganizationAccessTokenCreateResponse> {
        const response = await this.createRaw(requestParameters, initOverrides);
        return await response.value();
    }

    /**
     * Delete
     */
    async deleteRaw(requestParameters: OrganizationAccessTokenApiDeleteRequest, initOverrides?: RequestInit | runtime.InitOverrideFunction): Promise<runtime.ApiResponse<void>> {
        if (requestParameters['id'] == null) {
            throw new runtime.RequiredError(
                'id',
                'Required parameter "id" was null or undefined when calling delete().'
            );
        }

        const queryParameters: any = {};

        const headerParameters: runtime.HTTPHeaders = {};

        const response = await this.request({
            path: `/v1/organization-access-tokens/{id}`.replace(`{${"id"}}`, encodeURIComponent(String(requestParameters['id']))),
            method: 'DELETE',
            headers: headerParameters,
            query: queryParameters,
        }, initOverrides);

        return new runtime.VoidApiResponse(response);
    }

    /**
     * Delete
     */
    async delete(requestParameters: OrganizationAccessTokenApiDeleteRequest, initOverrides?: RequestInit | runtime.InitOverrideFunction): Promise<void> {
        await this.deleteRaw(requestParameters, initOverrides);
    }

    /**
     * List organization access tokens.
     * List
     */
    async listRaw(requestParameters: OrganizationAccessTokenApiListRequest, initOverrides?: RequestInit | runtime.InitOverrideFunction): Promise<runtime.ApiResponse<ListResourceOrganizationAccessToken>> {
        const queryParameters: any = {};

        if (requestParameters['page'] != null) {
            queryParameters['page'] = requestParameters['page'];
        }

        if (requestParameters['limit'] != null) {
            queryParameters['limit'] = requestParameters['limit'];
        }

        const headerParameters: runtime.HTTPHeaders = {};

        const response = await this.request({
            path: `/v1/organization-access-tokens/`,
            method: 'GET',
            headers: headerParameters,
            query: queryParameters,
        }, initOverrides);

        return new runtime.JSONApiResponse(response);
    }

    /**
     * List organization access tokens.
     * List
     */
    async list(requestParameters: OrganizationAccessTokenApiListRequest = {}, initOverrides?: RequestInit | runtime.InitOverrideFunction): Promise<ListResourceOrganizationAccessToken> {
        const response = await this.listRaw(requestParameters, initOverrides);
        return await response.value();
    }

    /**
     * Update
     */
    async updateRaw(requestParameters: OrganizationAccessTokenApiUpdateRequest, initOverrides?: RequestInit | runtime.InitOverrideFunction): Promise<runtime.ApiResponse<OrganizationAccessToken>> {
        if (requestParameters['id'] == null) {
            throw new runtime.RequiredError(
                'id',
                'Required parameter "id" was null or undefined when calling update().'
            );
        }

        if (requestParameters['body'] == null) {
            throw new runtime.RequiredError(
                'body',
                'Required parameter "body" was null or undefined when calling update().'
            );
        }

        const queryParameters: any = {};

        const headerParameters: runtime.HTTPHeaders = {};

        headerParameters['Content-Type'] = 'application/json';

        const response = await this.request({
            path: `/v1/organization-access-tokens/{id}`.replace(`{${"id"}}`, encodeURIComponent(String(requestParameters['id']))),
            method: 'PATCH',
            headers: headerParameters,
            query: queryParameters,
            body: requestParameters['body'],
        }, initOverrides);

        return new runtime.JSONApiResponse(response);
    }

    /**
     * Update
     */
    async update(requestParameters: OrganizationAccessTokenApiUpdateRequest, initOverrides?: RequestInit | runtime.InitOverrideFunction): Promise<OrganizationAccessToken> {
        const response = await this.updateRaw(requestParameters, initOverrides);
        return await response.value();
    }

}
