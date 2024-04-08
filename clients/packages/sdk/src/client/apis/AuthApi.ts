/* tslint:disable */
/* eslint-disable */
/**
 * Polar API
 *  Welcome to the **Polar API** for [polar.sh](https://polar.sh).  The Public API is currently a [work in progress](https://github.com/polarsource/polar/issues/834) and is in active development. 🚀  #### Authentication  Use a [Personal Access Token](https://polar.sh/settings) and send it in the `Authorization` header on the format `Bearer [YOUR_TOKEN]`.  #### Feedback  If you have any feedback or comments, reach out in the [Polar API-issue](https://github.com/polarsource/polar/issues/834), or reach out on the Polar Discord server.  We\'d love to see what you\'ve built with the API and to get your thoughts on how we can make the API better!  #### Connecting  The Polar API is online at `https://api.polar.sh`. 
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
  CustomDomainExchangeRequest,
  CustomDomainExchangeResponse,
  CustomDomainForwardResponse,
  HTTPValidationError,
} from '../models/index';

export interface AuthApiCustomDomainExchangeOperationRequest {
    customDomainExchangeRequest: CustomDomainExchangeRequest;
}

export interface AuthApiCustomDomainForwardRequest {
    organizationId: string;
}

export interface AuthApiLogoutRequest {
    organizationId?: string;
}

/**
 * 
 */
export class AuthApi extends runtime.BaseAPI {

    /**
     * Custom Domain Exchange
     */
    async customDomainExchangeRaw(requestParameters: AuthApiCustomDomainExchangeOperationRequest, initOverrides?: RequestInit | runtime.InitOverrideFunction): Promise<runtime.ApiResponse<CustomDomainExchangeResponse>> {
        if (requestParameters['customDomainExchangeRequest'] == null) {
            throw new runtime.RequiredError(
                'customDomainExchangeRequest',
                'Required parameter "customDomainExchangeRequest" was null or undefined when calling customDomainExchange().'
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
            path: `/api/v1/auth/custom_domain_exchange`,
            method: 'POST',
            headers: headerParameters,
            query: queryParameters,
            body: requestParameters['customDomainExchangeRequest'],
        }, initOverrides);

        return new runtime.JSONApiResponse(response);
    }

    /**
     * Custom Domain Exchange
     */
    async customDomainExchange(requestParameters: AuthApiCustomDomainExchangeOperationRequest, initOverrides?: RequestInit | runtime.InitOverrideFunction): Promise<CustomDomainExchangeResponse> {
        const response = await this.customDomainExchangeRaw(requestParameters, initOverrides);
        return await response.value();
    }

    /**
     * Custom Domain Forward
     */
    async customDomainForwardRaw(requestParameters: AuthApiCustomDomainForwardRequest, initOverrides?: RequestInit | runtime.InitOverrideFunction): Promise<runtime.ApiResponse<CustomDomainForwardResponse>> {
        if (requestParameters['organizationId'] == null) {
            throw new runtime.RequiredError(
                'organizationId',
                'Required parameter "organizationId" was null or undefined when calling customDomainForward().'
            );
        }

        const queryParameters: any = {};

        if (requestParameters['organizationId'] != null) {
            queryParameters['organization_id'] = requestParameters['organizationId'];
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
            path: `/api/v1/auth/custom_domain_forward`,
            method: 'GET',
            headers: headerParameters,
            query: queryParameters,
        }, initOverrides);

        return new runtime.JSONApiResponse(response);
    }

    /**
     * Custom Domain Forward
     */
    async customDomainForward(requestParameters: AuthApiCustomDomainForwardRequest, initOverrides?: RequestInit | runtime.InitOverrideFunction): Promise<CustomDomainForwardResponse> {
        const response = await this.customDomainForwardRaw(requestParameters, initOverrides);
        return await response.value();
    }

    /**
     * Logout
     */
    async logoutRaw(requestParameters: AuthApiLogoutRequest, initOverrides?: RequestInit | runtime.InitOverrideFunction): Promise<runtime.ApiResponse<any>> {
        const queryParameters: any = {};

        if (requestParameters['organizationId'] != null) {
            queryParameters['organization_id'] = requestParameters['organizationId'];
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
            path: `/api/v1/auth/logout`,
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
     * Logout
     */
    async logout(requestParameters: AuthApiLogoutRequest = {}, initOverrides?: RequestInit | runtime.InitOverrideFunction): Promise<any> {
        const response = await this.logoutRaw(requestParameters, initOverrides);
        return await response.value();
    }

}
