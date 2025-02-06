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
  ExternalOrganization,
  GithubUser,
  HTTPValidationError,
  InstallationCreate,
  LookupUserRequest,
  OrganizationBillingPlan,
  OrganizationCheckPermissionsInput,
  WebhookResponse,
} from '../models/index';

export interface IntegrationsGithubApiCheckOrganizationPermissionsRequest {
    id: string;
    body: OrganizationCheckPermissionsInput;
}

export interface IntegrationsGithubApiGetOrganizationBillingPlanRequest {
    id: string;
}

export interface IntegrationsGithubApiInstallRequest {
    body: InstallationCreate;
}

export interface IntegrationsGithubApiIntegrationsGithubAuthorizeRequest {
    paymentIntentId?: string | null;
    returnTo?: string | null;
    attribution?: string | null;
}

export interface IntegrationsGithubApiIntegrationsGithubCallbackRequest {
    code?: string | null;
    codeVerifier?: string | null;
    state?: string | null;
    error?: string | null;
}

export interface IntegrationsGithubApiLookupUserOperationRequest {
    body: LookupUserRequest;
}

export interface IntegrationsGithubApiRedirectToOrganizationInstallationRequest {
    id: string;
    returnTo?: string | null;
}

/**
 * 
 */
export class IntegrationsGithubApi extends runtime.BaseAPI {

    /**
     * Check Organization Permissions
     */
    async checkOrganizationPermissionsRaw(requestParameters: IntegrationsGithubApiCheckOrganizationPermissionsRequest, initOverrides?: RequestInit | runtime.InitOverrideFunction): Promise<runtime.ApiResponse<void>> {
        if (requestParameters['id'] == null) {
            throw new runtime.RequiredError(
                'id',
                'Required parameter "id" was null or undefined when calling checkOrganizationPermissions().'
            );
        }

        if (requestParameters['body'] == null) {
            throw new runtime.RequiredError(
                'body',
                'Required parameter "body" was null or undefined when calling checkOrganizationPermissions().'
            );
        }

        const queryParameters: any = {};

        const headerParameters: runtime.HTTPHeaders = {};

        headerParameters['Content-Type'] = 'application/json';

        const response = await this.request({
            path: `/v1/integrations/github/organizations/{id}/check_permissions`.replace(`{${"id"}}`, encodeURIComponent(String(requestParameters['id']))),
            method: 'POST',
            headers: headerParameters,
            query: queryParameters,
            body: requestParameters['body'],
        }, initOverrides);

        return new runtime.VoidApiResponse(response);
    }

    /**
     * Check Organization Permissions
     */
    async checkOrganizationPermissions(requestParameters: IntegrationsGithubApiCheckOrganizationPermissionsRequest, initOverrides?: RequestInit | runtime.InitOverrideFunction): Promise<void> {
        await this.checkOrganizationPermissionsRaw(requestParameters, initOverrides);
    }

    /**
     * Get Organization Billing Plan
     */
    async getOrganizationBillingPlanRaw(requestParameters: IntegrationsGithubApiGetOrganizationBillingPlanRequest, initOverrides?: RequestInit | runtime.InitOverrideFunction): Promise<runtime.ApiResponse<OrganizationBillingPlan>> {
        if (requestParameters['id'] == null) {
            throw new runtime.RequiredError(
                'id',
                'Required parameter "id" was null or undefined when calling getOrganizationBillingPlan().'
            );
        }

        const queryParameters: any = {};

        const headerParameters: runtime.HTTPHeaders = {};

        const response = await this.request({
            path: `/v1/integrations/github/organizations/{id}/billing`.replace(`{${"id"}}`, encodeURIComponent(String(requestParameters['id']))),
            method: 'GET',
            headers: headerParameters,
            query: queryParameters,
        }, initOverrides);

        return new runtime.JSONApiResponse(response);
    }

    /**
     * Get Organization Billing Plan
     */
    async getOrganizationBillingPlan(requestParameters: IntegrationsGithubApiGetOrganizationBillingPlanRequest, initOverrides?: RequestInit | runtime.InitOverrideFunction): Promise<OrganizationBillingPlan> {
        const response = await this.getOrganizationBillingPlanRaw(requestParameters, initOverrides);
        return await response.value();
    }

    /**
     * Install
     */
    async installRaw(requestParameters: IntegrationsGithubApiInstallRequest, initOverrides?: RequestInit | runtime.InitOverrideFunction): Promise<runtime.ApiResponse<ExternalOrganization>> {
        if (requestParameters['body'] == null) {
            throw new runtime.RequiredError(
                'body',
                'Required parameter "body" was null or undefined when calling install().'
            );
        }

        const queryParameters: any = {};

        const headerParameters: runtime.HTTPHeaders = {};

        headerParameters['Content-Type'] = 'application/json';

        const response = await this.request({
            path: `/v1/integrations/github/installations`,
            method: 'POST',
            headers: headerParameters,
            query: queryParameters,
            body: requestParameters['body'],
        }, initOverrides);

        return new runtime.JSONApiResponse(response);
    }

    /**
     * Install
     */
    async install(requestParameters: IntegrationsGithubApiInstallRequest, initOverrides?: RequestInit | runtime.InitOverrideFunction): Promise<ExternalOrganization> {
        const response = await this.installRaw(requestParameters, initOverrides);
        return await response.value();
    }

    /**
     * Integrations.Github.Authorize
     */
    async integrationsGithubAuthorizeRaw(requestParameters: IntegrationsGithubApiIntegrationsGithubAuthorizeRequest, initOverrides?: RequestInit | runtime.InitOverrideFunction): Promise<runtime.ApiResponse<any>> {
        const queryParameters: any = {};

        if (requestParameters['paymentIntentId'] != null) {
            queryParameters['payment_intent_id'] = requestParameters['paymentIntentId'];
        }

        if (requestParameters['returnTo'] != null) {
            queryParameters['return_to'] = requestParameters['returnTo'];
        }

        if (requestParameters['attribution'] != null) {
            queryParameters['attribution'] = requestParameters['attribution'];
        }

        const headerParameters: runtime.HTTPHeaders = {};

        const response = await this.request({
            path: `/v1/integrations/github/authorize`,
            method: 'GET',
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
     * Integrations.Github.Authorize
     */
    async integrationsGithubAuthorize(requestParameters: IntegrationsGithubApiIntegrationsGithubAuthorizeRequest = {}, initOverrides?: RequestInit | runtime.InitOverrideFunction): Promise<any> {
        const response = await this.integrationsGithubAuthorizeRaw(requestParameters, initOverrides);
        return await response.value();
    }

    /**
     * Integrations.Github.Callback
     */
    async integrationsGithubCallbackRaw(requestParameters: IntegrationsGithubApiIntegrationsGithubCallbackRequest, initOverrides?: RequestInit | runtime.InitOverrideFunction): Promise<runtime.ApiResponse<any>> {
        const queryParameters: any = {};

        if (requestParameters['code'] != null) {
            queryParameters['code'] = requestParameters['code'];
        }

        if (requestParameters['codeVerifier'] != null) {
            queryParameters['code_verifier'] = requestParameters['codeVerifier'];
        }

        if (requestParameters['state'] != null) {
            queryParameters['state'] = requestParameters['state'];
        }

        if (requestParameters['error'] != null) {
            queryParameters['error'] = requestParameters['error'];
        }

        const headerParameters: runtime.HTTPHeaders = {};

        const response = await this.request({
            path: `/v1/integrations/github/callback`,
            method: 'GET',
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
     * Integrations.Github.Callback
     */
    async integrationsGithubCallback(requestParameters: IntegrationsGithubApiIntegrationsGithubCallbackRequest = {}, initOverrides?: RequestInit | runtime.InitOverrideFunction): Promise<any> {
        const response = await this.integrationsGithubCallbackRaw(requestParameters, initOverrides);
        return await response.value();
    }

    /**
     * Lookup User
     */
    async lookupUserRaw(requestParameters: IntegrationsGithubApiLookupUserOperationRequest, initOverrides?: RequestInit | runtime.InitOverrideFunction): Promise<runtime.ApiResponse<GithubUser>> {
        if (requestParameters['body'] == null) {
            throw new runtime.RequiredError(
                'body',
                'Required parameter "body" was null or undefined when calling lookupUser().'
            );
        }

        const queryParameters: any = {};

        const headerParameters: runtime.HTTPHeaders = {};

        headerParameters['Content-Type'] = 'application/json';

        const response = await this.request({
            path: `/v1/integrations/github/lookup_user`,
            method: 'POST',
            headers: headerParameters,
            query: queryParameters,
            body: requestParameters['body'],
        }, initOverrides);

        return new runtime.JSONApiResponse(response);
    }

    /**
     * Lookup User
     */
    async lookupUser(requestParameters: IntegrationsGithubApiLookupUserOperationRequest, initOverrides?: RequestInit | runtime.InitOverrideFunction): Promise<GithubUser> {
        const response = await this.lookupUserRaw(requestParameters, initOverrides);
        return await response.value();
    }

    /**
     * Redirect To Organization Installation
     */
    async redirectToOrganizationInstallationRaw(requestParameters: IntegrationsGithubApiRedirectToOrganizationInstallationRequest, initOverrides?: RequestInit | runtime.InitOverrideFunction): Promise<runtime.ApiResponse<any>> {
        if (requestParameters['id'] == null) {
            throw new runtime.RequiredError(
                'id',
                'Required parameter "id" was null or undefined when calling redirectToOrganizationInstallation().'
            );
        }

        const queryParameters: any = {};

        if (requestParameters['returnTo'] != null) {
            queryParameters['return_to'] = requestParameters['returnTo'];
        }

        const headerParameters: runtime.HTTPHeaders = {};

        const response = await this.request({
            path: `/v1/integrations/github/organizations/{id}/installation`.replace(`{${"id"}}`, encodeURIComponent(String(requestParameters['id']))),
            method: 'GET',
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
     * Redirect To Organization Installation
     */
    async redirectToOrganizationInstallation(requestParameters: IntegrationsGithubApiRedirectToOrganizationInstallationRequest, initOverrides?: RequestInit | runtime.InitOverrideFunction): Promise<any> {
        const response = await this.redirectToOrganizationInstallationRaw(requestParameters, initOverrides);
        return await response.value();
    }

    /**
     * Webhook
     */
    async webhookRaw(initOverrides?: RequestInit | runtime.InitOverrideFunction): Promise<runtime.ApiResponse<WebhookResponse>> {
        const queryParameters: any = {};

        const headerParameters: runtime.HTTPHeaders = {};

        const response = await this.request({
            path: `/v1/integrations/github/webhook`,
            method: 'POST',
            headers: headerParameters,
            query: queryParameters,
        }, initOverrides);

        return new runtime.JSONApiResponse(response);
    }

    /**
     * Webhook
     */
    async webhook(initOverrides?: RequestInit | runtime.InitOverrideFunction): Promise<WebhookResponse> {
        const response = await this.webhookRaw(initOverrides);
        return await response.value();
    }

}
