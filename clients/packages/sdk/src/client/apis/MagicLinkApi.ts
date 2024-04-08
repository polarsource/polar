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
  HTTPValidationError,
  MagicLinkRequest,
} from '../models/index';

export interface MagicLinkApiMagicLinkAuthenticateRequest {
    token: string;
    returnTo?: string;
}

export interface MagicLinkApiMagicLinkRequestRequest {
    magicLinkRequest: MagicLinkRequest;
}

/**
 * 
 */
export class MagicLinkApi extends runtime.BaseAPI {

    /**
     * Magic Link.Authenticate
     */
    async magicLinkAuthenticateRaw(requestParameters: MagicLinkApiMagicLinkAuthenticateRequest, initOverrides?: RequestInit | runtime.InitOverrideFunction): Promise<runtime.ApiResponse<any>> {
        if (requestParameters['token'] == null) {
            throw new runtime.RequiredError(
                'token',
                'Required parameter "token" was null or undefined when calling magicLinkAuthenticate().'
            );
        }

        const queryParameters: any = {};

        if (requestParameters['token'] != null) {
            queryParameters['token'] = requestParameters['token'];
        }

        if (requestParameters['returnTo'] != null) {
            queryParameters['return_to'] = requestParameters['returnTo'];
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
            path: `/api/v1/magic_link/authenticate`,
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
     * Magic Link.Authenticate
     */
    async magicLinkAuthenticate(requestParameters: MagicLinkApiMagicLinkAuthenticateRequest, initOverrides?: RequestInit | runtime.InitOverrideFunction): Promise<any> {
        const response = await this.magicLinkAuthenticateRaw(requestParameters, initOverrides);
        return await response.value();
    }

    /**
     * Magic Link.Request
     */
    async magicLinkRequestRaw(requestParameters: MagicLinkApiMagicLinkRequestRequest, initOverrides?: RequestInit | runtime.InitOverrideFunction): Promise<runtime.ApiResponse<any>> {
        if (requestParameters['magicLinkRequest'] == null) {
            throw new runtime.RequiredError(
                'magicLinkRequest',
                'Required parameter "magicLinkRequest" was null or undefined when calling magicLinkRequest().'
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
            path: `/api/v1/magic_link/request`,
            method: 'POST',
            headers: headerParameters,
            query: queryParameters,
            body: requestParameters['magicLinkRequest'],
        }, initOverrides);

        if (this.isJsonMime(response.headers.get('content-type'))) {
            return new runtime.JSONApiResponse<any>(response);
        } else {
            return new runtime.TextApiResponse(response) as any;
        }
    }

    /**
     * Magic Link.Request
     */
    async magicLinkRequest(requestParameters: MagicLinkApiMagicLinkRequestRequest, initOverrides?: RequestInit | runtime.InitOverrideFunction): Promise<any> {
        const response = await this.magicLinkRequestRaw(requestParameters, initOverrides);
        return await response.value();
    }

}
