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
  CreatePersonalAccessToken,
  CreatePersonalAccessTokenResponse,
  HTTPValidationError,
  ListResourcePersonalAccessToken,
  PersonalAccessToken,
} from '../models/index';

export interface PersonalAccessTokenApiDeleteRequest {
    id: string;
}

export interface PersonalAccessTokenApiCreateRequest {
    createPersonalAccessToken: CreatePersonalAccessToken;
}

/**
 * 
 */
export class PersonalAccessTokenApi extends runtime.BaseAPI {

    /**
     * Delete a personal access tokens. Requires authentication.
     * Delete a personal access tokens (Public API)
     */
    async _deleteRaw(requestParameters: PersonalAccessTokenApiDeleteRequest, initOverrides?: RequestInit | runtime.InitOverrideFunction): Promise<runtime.ApiResponse<PersonalAccessToken>> {
        if (requestParameters.id === null || requestParameters.id === undefined) {
            throw new runtime.RequiredError('id','Required parameter requestParameters.id was null or undefined when calling _delete.');
        }

        const queryParameters: any = {};

        const headerParameters: runtime.HTTPHeaders = {};

        if (this.configuration && this.configuration.accessToken) {
            const token = this.configuration.accessToken;
            const tokenString = await token("HTTPBearer", []);

            if (tokenString) {
                headerParameters["Authorization"] = `Bearer ${tokenString}`;
            }
        }
        const response = await this.request({
            path: `/api/v1/personal_access_tokens/{id}`.replace(`{${"id"}}`, encodeURIComponent(String(requestParameters.id))),
            method: 'DELETE',
            headers: headerParameters,
            query: queryParameters,
        }, initOverrides);

        return new runtime.JSONApiResponse(response);
    }

    /**
     * Delete a personal access tokens. Requires authentication.
     * Delete a personal access tokens (Public API)
     */
    async _delete(requestParameters: PersonalAccessTokenApiDeleteRequest, initOverrides?: RequestInit | runtime.InitOverrideFunction): Promise<PersonalAccessToken> {
        const response = await this._deleteRaw(requestParameters, initOverrides);
        return await response.value();
    }

    /**
     * Create a new personal access token. Requires authentication.
     * Create a new personal access token (Public API)
     */
    async createRaw(requestParameters: PersonalAccessTokenApiCreateRequest, initOverrides?: RequestInit | runtime.InitOverrideFunction): Promise<runtime.ApiResponse<CreatePersonalAccessTokenResponse>> {
        if (requestParameters.createPersonalAccessToken === null || requestParameters.createPersonalAccessToken === undefined) {
            throw new runtime.RequiredError('createPersonalAccessToken','Required parameter requestParameters.createPersonalAccessToken was null or undefined when calling create.');
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
            path: `/api/v1/personal_access_tokens`,
            method: 'POST',
            headers: headerParameters,
            query: queryParameters,
            body: requestParameters.createPersonalAccessToken,
        }, initOverrides);

        return new runtime.JSONApiResponse(response);
    }

    /**
     * Create a new personal access token. Requires authentication.
     * Create a new personal access token (Public API)
     */
    async create(requestParameters: PersonalAccessTokenApiCreateRequest, initOverrides?: RequestInit | runtime.InitOverrideFunction): Promise<CreatePersonalAccessTokenResponse> {
        const response = await this.createRaw(requestParameters, initOverrides);
        return await response.value();
    }

    /**
     * List personal access tokens. Requires authentication.
     * List personal access tokens (Public API)
     */
    async listRaw(initOverrides?: RequestInit | runtime.InitOverrideFunction): Promise<runtime.ApiResponse<ListResourcePersonalAccessToken>> {
        const queryParameters: any = {};

        const headerParameters: runtime.HTTPHeaders = {};

        if (this.configuration && this.configuration.accessToken) {
            const token = this.configuration.accessToken;
            const tokenString = await token("HTTPBearer", []);

            if (tokenString) {
                headerParameters["Authorization"] = `Bearer ${tokenString}`;
            }
        }
        const response = await this.request({
            path: `/api/v1/personal_access_tokens`,
            method: 'GET',
            headers: headerParameters,
            query: queryParameters,
        }, initOverrides);

        return new runtime.JSONApiResponse(response);
    }

    /**
     * List personal access tokens. Requires authentication.
     * List personal access tokens (Public API)
     */
    async list(initOverrides?: RequestInit | runtime.InitOverrideFunction): Promise<ListResourcePersonalAccessToken> {
        const response = await this.listRaw(initOverrides);
        return await response.value();
    }

}
