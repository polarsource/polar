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
  LicenseKeyActivate,
  LicenseKeyActivationRead,
  LicenseKeyDeactivate,
  LicenseKeyValidate,
  LicenseKeyWithActivations,
  ListResourceLicenseKeyRead,
  NotPermitted,
  OrganizationIDFilter,
  ResourceNotFound,
  Unauthorized,
  ValidatedLicenseKey,
} from '../models/index';

export interface UsersLicenseKeysApiActivateRequest {
    body: LicenseKeyActivate;
}

export interface UsersLicenseKeysApiDeactivateRequest {
    body: LicenseKeyDeactivate;
}

export interface UsersLicenseKeysApiGetRequest {
    id: string;
}

export interface UsersLicenseKeysApiListRequest {
    organizationId?: OrganizationIDFilter;
    benefitId?: string;
    page?: number;
    limit?: number;
}

export interface UsersLicenseKeysApiValidateRequest {
    body: LicenseKeyValidate;
}

/**
 * 
 */
export class UsersLicenseKeysApi extends runtime.BaseAPI {

    /**
     * Activate a license key instance.
     * Activate License Key
     */
    async activateRaw(requestParameters: UsersLicenseKeysApiActivateRequest, initOverrides?: RequestInit | runtime.InitOverrideFunction): Promise<runtime.ApiResponse<LicenseKeyActivationRead>> {
        if (requestParameters['body'] == null) {
            throw new runtime.RequiredError(
                'body',
                'Required parameter "body" was null or undefined when calling activate().'
            );
        }

        const queryParameters: any = {};

        const headerParameters: runtime.HTTPHeaders = {};

        headerParameters['Content-Type'] = 'application/json';

        const response = await this.request({
            path: `/v1/users/license-keys/activate`,
            method: 'POST',
            headers: headerParameters,
            query: queryParameters,
            body: requestParameters['body'],
        }, initOverrides);

        return new runtime.JSONApiResponse(response);
    }

    /**
     * Activate a license key instance.
     * Activate License Key
     */
    async activate(requestParameters: UsersLicenseKeysApiActivateRequest, initOverrides?: RequestInit | runtime.InitOverrideFunction): Promise<LicenseKeyActivationRead> {
        const response = await this.activateRaw(requestParameters, initOverrides);
        return await response.value();
    }

    /**
     * Deactivate a license key instance.
     * Deactivate License Key
     */
    async deactivateRaw(requestParameters: UsersLicenseKeysApiDeactivateRequest, initOverrides?: RequestInit | runtime.InitOverrideFunction): Promise<runtime.ApiResponse<void>> {
        if (requestParameters['body'] == null) {
            throw new runtime.RequiredError(
                'body',
                'Required parameter "body" was null or undefined when calling deactivate().'
            );
        }

        const queryParameters: any = {};

        const headerParameters: runtime.HTTPHeaders = {};

        headerParameters['Content-Type'] = 'application/json';

        const response = await this.request({
            path: `/v1/users/license-keys/deactivate`,
            method: 'POST',
            headers: headerParameters,
            query: queryParameters,
            body: requestParameters['body'],
        }, initOverrides);

        return new runtime.VoidApiResponse(response);
    }

    /**
     * Deactivate a license key instance.
     * Deactivate License Key
     */
    async deactivate(requestParameters: UsersLicenseKeysApiDeactivateRequest, initOverrides?: RequestInit | runtime.InitOverrideFunction): Promise<void> {
        await this.deactivateRaw(requestParameters, initOverrides);
    }

    /**
     * Get a license key.
     * Get License Key
     */
    async getRaw(requestParameters: UsersLicenseKeysApiGetRequest, initOverrides?: RequestInit | runtime.InitOverrideFunction): Promise<runtime.ApiResponse<LicenseKeyWithActivations>> {
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
            path: `/v1/users/license-keys/{id}`.replace(`{${"id"}}`, encodeURIComponent(String(requestParameters['id']))),
            method: 'GET',
            headers: headerParameters,
            query: queryParameters,
        }, initOverrides);

        return new runtime.JSONApiResponse(response);
    }

    /**
     * Get a license key.
     * Get License Key
     */
    async get(requestParameters: UsersLicenseKeysApiGetRequest, initOverrides?: RequestInit | runtime.InitOverrideFunction): Promise<LicenseKeyWithActivations> {
        const response = await this.getRaw(requestParameters, initOverrides);
        return await response.value();
    }

    /**
     * List License Keys
     */
    async listRaw(requestParameters: UsersLicenseKeysApiListRequest, initOverrides?: RequestInit | runtime.InitOverrideFunction): Promise<runtime.ApiResponse<ListResourceLicenseKeyRead>> {
        const queryParameters: any = {};

        if (requestParameters['organizationId'] != null) {
            queryParameters['organization_id'] = requestParameters['organizationId'];
        }

        if (requestParameters['benefitId'] != null) {
            queryParameters['benefit_id'] = requestParameters['benefitId'];
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
            path: `/v1/users/license-keys/`,
            method: 'GET',
            headers: headerParameters,
            query: queryParameters,
        }, initOverrides);

        return new runtime.JSONApiResponse(response);
    }

    /**
     * List License Keys
     */
    async list(requestParameters: UsersLicenseKeysApiListRequest = {}, initOverrides?: RequestInit | runtime.InitOverrideFunction): Promise<ListResourceLicenseKeyRead> {
        const response = await this.listRaw(requestParameters, initOverrides);
        return await response.value();
    }

    /**
     * Validate a license key.
     * Validate License Key
     */
    async validateRaw(requestParameters: UsersLicenseKeysApiValidateRequest, initOverrides?: RequestInit | runtime.InitOverrideFunction): Promise<runtime.ApiResponse<ValidatedLicenseKey>> {
        if (requestParameters['body'] == null) {
            throw new runtime.RequiredError(
                'body',
                'Required parameter "body" was null or undefined when calling validate().'
            );
        }

        const queryParameters: any = {};

        const headerParameters: runtime.HTTPHeaders = {};

        headerParameters['Content-Type'] = 'application/json';

        const response = await this.request({
            path: `/v1/users/license-keys/validate`,
            method: 'POST',
            headers: headerParameters,
            query: queryParameters,
            body: requestParameters['body'],
        }, initOverrides);

        return new runtime.JSONApiResponse(response);
    }

    /**
     * Validate a license key.
     * Validate License Key
     */
    async validate(requestParameters: UsersLicenseKeysApiValidateRequest, initOverrides?: RequestInit | runtime.InitOverrideFunction): Promise<ValidatedLicenseKey> {
        const response = await this.validateRaw(requestParameters, initOverrides);
        return await response.value();
    }

}
