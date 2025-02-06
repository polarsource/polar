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
  AuthorizeResponse,
  CustomerOAuthPlatform,
  HTTPValidationError,
} from '../models/index';

export interface CustomerPortalOauthAccountsApiCustomerPortalOauthAccountsAuthorizeRequest {
    platform: CustomerOAuthPlatform;
    customerId: string;
    returnTo?: string | null;
}

export interface CustomerPortalOauthAccountsApiCustomerPortalOauthAccountsCallbackRequest {
    state: string;
    code?: string | null;
    error?: string | null;
}

/**
 * 
 */
export class CustomerPortalOauthAccountsApi extends runtime.BaseAPI {

    /**
     * Customer Portal.Oauth Accounts.Authorize
     */
    async customerPortalOauthAccountsAuthorizeRaw(requestParameters: CustomerPortalOauthAccountsApiCustomerPortalOauthAccountsAuthorizeRequest, initOverrides?: RequestInit | runtime.InitOverrideFunction): Promise<runtime.ApiResponse<AuthorizeResponse>> {
        if (requestParameters['platform'] == null) {
            throw new runtime.RequiredError(
                'platform',
                'Required parameter "platform" was null or undefined when calling customerPortalOauthAccountsAuthorize().'
            );
        }

        if (requestParameters['customerId'] == null) {
            throw new runtime.RequiredError(
                'customerId',
                'Required parameter "customerId" was null or undefined when calling customerPortalOauthAccountsAuthorize().'
            );
        }

        const queryParameters: any = {};

        if (requestParameters['platform'] != null) {
            queryParameters['platform'] = requestParameters['platform'];
        }

        if (requestParameters['customerId'] != null) {
            queryParameters['customer_id'] = requestParameters['customerId'];
        }

        if (requestParameters['returnTo'] != null) {
            queryParameters['return_to'] = requestParameters['returnTo'];
        }

        const headerParameters: runtime.HTTPHeaders = {};

        if (this.configuration && this.configuration.accessToken) {
            const token = this.configuration.accessToken;
            const tokenString = await token("customer_session", []);

            if (tokenString) {
                headerParameters["Authorization"] = `Bearer ${tokenString}`;
            }
        }
        const response = await this.request({
            path: `/v1/customer-portal/oauth-accounts/authorize`,
            method: 'GET',
            headers: headerParameters,
            query: queryParameters,
        }, initOverrides);

        return new runtime.JSONApiResponse(response);
    }

    /**
     * Customer Portal.Oauth Accounts.Authorize
     */
    async customerPortalOauthAccountsAuthorize(requestParameters: CustomerPortalOauthAccountsApiCustomerPortalOauthAccountsAuthorizeRequest, initOverrides?: RequestInit | runtime.InitOverrideFunction): Promise<AuthorizeResponse> {
        const response = await this.customerPortalOauthAccountsAuthorizeRaw(requestParameters, initOverrides);
        return await response.value();
    }

    /**
     * Customer Portal.Oauth Accounts.Callback
     */
    async customerPortalOauthAccountsCallbackRaw(requestParameters: CustomerPortalOauthAccountsApiCustomerPortalOauthAccountsCallbackRequest, initOverrides?: RequestInit | runtime.InitOverrideFunction): Promise<runtime.ApiResponse<any>> {
        if (requestParameters['state'] == null) {
            throw new runtime.RequiredError(
                'state',
                'Required parameter "state" was null or undefined when calling customerPortalOauthAccountsCallback().'
            );
        }

        const queryParameters: any = {};

        if (requestParameters['state'] != null) {
            queryParameters['state'] = requestParameters['state'];
        }

        if (requestParameters['code'] != null) {
            queryParameters['code'] = requestParameters['code'];
        }

        if (requestParameters['error'] != null) {
            queryParameters['error'] = requestParameters['error'];
        }

        const headerParameters: runtime.HTTPHeaders = {};

        const response = await this.request({
            path: `/v1/customer-portal/oauth-accounts/callback`,
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
     * Customer Portal.Oauth Accounts.Callback
     */
    async customerPortalOauthAccountsCallback(requestParameters: CustomerPortalOauthAccountsApiCustomerPortalOauthAccountsCallbackRequest, initOverrides?: RequestInit | runtime.InitOverrideFunction): Promise<any> {
        const response = await this.customerPortalOauthAccountsCallbackRaw(requestParameters, initOverrides);
        return await response.value();
    }

}
