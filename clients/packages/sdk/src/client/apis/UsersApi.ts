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
  ListResourceLicenseKeyRead,
  NotPermitted,
  ResourceNotFound,
  Unauthorized,
  UserRead,
  UserScopes,
  UserSetAccount,
  UserStripePortalSession,
  ValidatedLicenseKey,
} from '../models/index';

export interface UsersApiActivateLicenseKeyRequest {
    body: LicenseKeyActivate;
}

export interface UsersApiDeactivateLicenseKeyRequest {
    body: LicenseKeyDeactivate;
}

export interface UsersApiListLicenseKeysRequest {
    organizationId: string;
    benefitId?: string;
    page?: number;
    limit?: number;
}

export interface UsersApiSetAccountRequest {
    body: UserSetAccount;
}

export interface UsersApiValidateLicenseKeyRequest {
    body: LicenseKeyValidate;
}

/**
 *
 */
export class UsersApi extends runtime.BaseAPI {

    /**
     * Activate a license key instance.
     * Activate License Key
     */
    async activateLicenseKeyRaw(requestParameters: UsersApiActivateLicenseKeyRequest, initOverrides?: RequestInit | runtime.InitOverrideFunction): Promise<runtime.ApiResponse<LicenseKeyActivationRead>> {
        if (requestParameters['body'] == null) {
            throw new runtime.RequiredError(
                'body',
                'Required parameter "body" was null or undefined when calling activateLicenseKey().'
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
    async activateLicenseKey(requestParameters: UsersApiActivateLicenseKeyRequest, initOverrides?: RequestInit | runtime.InitOverrideFunction): Promise<LicenseKeyActivationRead> {
        const response = await this.activateLicenseKeyRaw(requestParameters, initOverrides);
        return await response.value();
    }

    /**
     * Create Stripe Customer Portal
     */
    async createStripeCustomerPortalRaw(initOverrides?: RequestInit | runtime.InitOverrideFunction): Promise<runtime.ApiResponse<UserStripePortalSession>> {
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
            path: `/v1/users/me/stripe_customer_portal`,
            method: 'POST',
            headers: headerParameters,
            query: queryParameters,
        }, initOverrides);

        return new runtime.JSONApiResponse(response);
    }

    /**
     * Create Stripe Customer Portal
     */
    async createStripeCustomerPortal(initOverrides?: RequestInit | runtime.InitOverrideFunction): Promise<UserStripePortalSession> {
        const response = await this.createStripeCustomerPortalRaw(initOverrides);
        return await response.value();
    }

    /**
     * Deactivate a license key instance.
     * Deactivate license key activation
     */
    async deactivateLicenseKeyRaw(requestParameters: UsersApiDeactivateLicenseKeyRequest, initOverrides?: RequestInit | runtime.InitOverrideFunction): Promise<runtime.ApiResponse<void>> {
        if (requestParameters['body'] == null) {
            throw new runtime.RequiredError(
                'body',
                'Required parameter "body" was null or undefined when calling deactivateLicenseKey().'
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
     * Deactivate license key activation
     */
    async deactivateLicenseKey(requestParameters: UsersApiDeactivateLicenseKeyRequest, initOverrides?: RequestInit | runtime.InitOverrideFunction): Promise<void> {
        await this.deactivateLicenseKeyRaw(requestParameters, initOverrides);
    }

    /**
     * Get Authenticated
     */
    async getAuthenticatedRaw(initOverrides?: RequestInit | runtime.InitOverrideFunction): Promise<runtime.ApiResponse<UserRead>> {
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
            path: `/v1/users/me`,
            method: 'GET',
            headers: headerParameters,
            query: queryParameters,
        }, initOverrides);

        return new runtime.JSONApiResponse(response);
    }

    /**
     * Get Authenticated
     */
    async getAuthenticated(initOverrides?: RequestInit | runtime.InitOverrideFunction): Promise<UserRead> {
        const response = await this.getAuthenticatedRaw(initOverrides);
        return await response.value();
    }

    /**
     * List License Keys
     */
    async listLicenseKeysRaw(requestParameters: UsersApiListLicenseKeysRequest, initOverrides?: RequestInit | runtime.InitOverrideFunction): Promise<runtime.ApiResponse<ListResourceLicenseKeyRead>> {
        if (requestParameters['organizationId'] == null) {
            throw new runtime.RequiredError(
                'organizationId',
                'Required parameter "organizationId" was null or undefined when calling listLicenseKeys().'
            );
        }

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
            path: `/v1/users/license-keys`,
            method: 'GET',
            headers: headerParameters,
            query: queryParameters,
        }, initOverrides);

        return new runtime.JSONApiResponse(response);
    }

    /**
     * List License Keys
     */
    async listLicenseKeys(requestParameters: UsersApiListLicenseKeysRequest, initOverrides?: RequestInit | runtime.InitOverrideFunction): Promise<ListResourceLicenseKeyRead> {
        const response = await this.listLicenseKeysRaw(requestParameters, initOverrides);
        return await response.value();
    }

    /**
     * Scopes
     */
    async scopesRaw(initOverrides?: RequestInit | runtime.InitOverrideFunction): Promise<runtime.ApiResponse<UserScopes>> {
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
            path: `/v1/users/me/scopes`,
            method: 'GET',
            headers: headerParameters,
            query: queryParameters,
        }, initOverrides);

        return new runtime.JSONApiResponse(response);
    }

    /**
     * Scopes
     */
    async scopes(initOverrides?: RequestInit | runtime.InitOverrideFunction): Promise<UserScopes> {
        const response = await this.scopesRaw(initOverrides);
        return await response.value();
    }

    /**
     * Set Account
     */
    async setAccountRaw(requestParameters: UsersApiSetAccountRequest, initOverrides?: RequestInit | runtime.InitOverrideFunction): Promise<runtime.ApiResponse<UserRead>> {
        if (requestParameters['body'] == null) {
            throw new runtime.RequiredError(
                'body',
                'Required parameter "body" was null or undefined when calling setAccount().'
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
            path: `/v1/users/me/account`,
            method: 'PATCH',
            headers: headerParameters,
            query: queryParameters,
            body: requestParameters['body'],
        }, initOverrides);

        return new runtime.JSONApiResponse(response);
    }

    /**
     * Set Account
     */
    async setAccount(requestParameters: UsersApiSetAccountRequest, initOverrides?: RequestInit | runtime.InitOverrideFunction): Promise<UserRead> {
        const response = await this.setAccountRaw(requestParameters, initOverrides);
        return await response.value();
    }

    /**
     * Validate a license key.
     * Validate License Key
     */
    async validateLicenseKeyRaw(requestParameters: UsersApiValidateLicenseKeyRequest, initOverrides?: RequestInit | runtime.InitOverrideFunction): Promise<runtime.ApiResponse<ValidatedLicenseKey>> {
        if (requestParameters['body'] == null) {
            throw new runtime.RequiredError(
                'body',
                'Required parameter "body" was null or undefined when calling validateLicenseKey().'
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
    async validateLicenseKey(requestParameters: UsersApiValidateLicenseKeyRequest, initOverrides?: RequestInit | runtime.InitOverrideFunction): Promise<ValidatedLicenseKey> {
        const response = await this.validateLicenseKeyRaw(requestParameters, initOverrides);
        return await response.value();
    }

}
