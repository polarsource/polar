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
} from '../models/index';

export interface AuthApiLogoutRequest {
    organizationId?: string;
}

/**
 * 
 */
export class AuthApi extends runtime.BaseAPI {

    /**
     * Logout
     */
    async logoutRaw(requestParameters: AuthApiLogoutRequest, initOverrides?: RequestInit | runtime.InitOverrideFunction): Promise<runtime.ApiResponse<any>> {
        const queryParameters: any = {};

        if (requestParameters['organizationId'] != null) {
            queryParameters['organization_id'] = requestParameters['organizationId'];
        }

        const headerParameters: runtime.HTTPHeaders = {};

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
