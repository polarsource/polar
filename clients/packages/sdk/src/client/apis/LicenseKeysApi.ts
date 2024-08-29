/* tslint:disable */
/* eslint-disable */
/**
 * Polar API
 * Read the docs at https://docs.polar.sh/api
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
  LicenseKeyActivationRead,
  LicenseKeyRead,
  LicenseKeyUpdate,
  LicenseKeyWithActivations,
  ListResourceLicenseKeyRead,
  OrganizationIDFilter,
  ResourceNotFound,
  Unauthorized,
} from '../models/index';

export interface LicenseKeysApiGetRequest {
    id: string;
}

export interface LicenseKeysApiGetActivationRequest {
    id: string;
    activationId: string;
}

export interface LicenseKeysApiListRequest {
    organizationId?: OrganizationIDFilter;
    page?: number;
    limit?: number;
}

export interface LicenseKeysApiUpdateRequest {
    id: string;
    body: LicenseKeyUpdate;
}

/**
 * 
 */
export class LicenseKeysApi extends runtime.BaseAPI {

    /**
     * Get a license key.
     * Get
     */
    async getRaw(requestParameters: LicenseKeysApiGetRequest, initOverrides?: RequestInit | runtime.InitOverrideFunction): Promise<runtime.ApiResponse<LicenseKeyWithActivations>> {
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
            path: `/v1/license-keys/{id}`.replace(`{${"id"}}`, encodeURIComponent(String(requestParameters['id']))),
            method: 'GET',
            headers: headerParameters,
            query: queryParameters,
        }, initOverrides);

        return new runtime.JSONApiResponse(response);
    }

    /**
     * Get a license key.
     * Get
     */
    async get(requestParameters: LicenseKeysApiGetRequest, initOverrides?: RequestInit | runtime.InitOverrideFunction): Promise<LicenseKeyWithActivations> {
        const response = await this.getRaw(requestParameters, initOverrides);
        return await response.value();
    }

    /**
     * Get a license key activation.
     * Get Activation
     */
    async getActivationRaw(requestParameters: LicenseKeysApiGetActivationRequest, initOverrides?: RequestInit | runtime.InitOverrideFunction): Promise<runtime.ApiResponse<LicenseKeyActivationRead>> {
        if (requestParameters['id'] == null) {
            throw new runtime.RequiredError(
                'id',
                'Required parameter "id" was null or undefined when calling getActivation().'
            );
        }

        if (requestParameters['activationId'] == null) {
            throw new runtime.RequiredError(
                'activationId',
                'Required parameter "activationId" was null or undefined when calling getActivation().'
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
            path: `/v1/license-keys/{id}/activations/{activation_id}`.replace(`{${"id"}}`, encodeURIComponent(String(requestParameters['id']))).replace(`{${"activation_id"}}`, encodeURIComponent(String(requestParameters['activationId']))),
            method: 'GET',
            headers: headerParameters,
            query: queryParameters,
        }, initOverrides);

        return new runtime.JSONApiResponse(response);
    }

    /**
     * Get a license key activation.
     * Get Activation
     */
    async getActivation(requestParameters: LicenseKeysApiGetActivationRequest, initOverrides?: RequestInit | runtime.InitOverrideFunction): Promise<LicenseKeyActivationRead> {
        const response = await this.getActivationRaw(requestParameters, initOverrides);
        return await response.value();
    }

    /**
     * Get license keys connected to the given organization & filters.
     * List
     */
    async listRaw(requestParameters: LicenseKeysApiListRequest, initOverrides?: RequestInit | runtime.InitOverrideFunction): Promise<runtime.ApiResponse<ListResourceLicenseKeyRead>> {
        const queryParameters: any = {};

        if (requestParameters['organizationId'] != null) {
            queryParameters['organization_id'] = requestParameters['organizationId'];
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
            const tokenString = await token("pat", []);

            if (tokenString) {
                headerParameters["Authorization"] = `Bearer ${tokenString}`;
            }
        }
        const response = await this.request({
            path: `/v1/license-keys`,
            method: 'GET',
            headers: headerParameters,
            query: queryParameters,
        }, initOverrides);

        return new runtime.JSONApiResponse(response);
    }

    /**
     * Get license keys connected to the given organization & filters.
     * List
     */
    async list(requestParameters: LicenseKeysApiListRequest = {}, initOverrides?: RequestInit | runtime.InitOverrideFunction): Promise<ListResourceLicenseKeyRead> {
        const response = await this.listRaw(requestParameters, initOverrides);
        return await response.value();
    }

    /**
     * Update a license key.
     * Update
     */
    async updateRaw(requestParameters: LicenseKeysApiUpdateRequest, initOverrides?: RequestInit | runtime.InitOverrideFunction): Promise<runtime.ApiResponse<LicenseKeyRead>> {
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

        if (this.configuration && this.configuration.accessToken) {
            const token = this.configuration.accessToken;
            const tokenString = await token("pat", []);

            if (tokenString) {
                headerParameters["Authorization"] = `Bearer ${tokenString}`;
            }
        }
        const response = await this.request({
            path: `/v1/license-keys/{id}`.replace(`{${"id"}}`, encodeURIComponent(String(requestParameters['id']))),
            method: 'PATCH',
            headers: headerParameters,
            query: queryParameters,
            body: requestParameters['body'],
        }, initOverrides);

        return new runtime.JSONApiResponse(response);
    }

    /**
     * Update a license key.
     * Update
     */
    async update(requestParameters: LicenseKeysApiUpdateRequest, initOverrides?: RequestInit | runtime.InitOverrideFunction): Promise<LicenseKeyRead> {
        const response = await this.updateRaw(requestParameters, initOverrides);
        return await response.value();
    }

}
