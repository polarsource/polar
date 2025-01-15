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
  CustomerSession,
  CustomerSessionCreate,
  HTTPValidationError,
} from '../models/index';

export interface CustomerSessionsApiCreateRequest {
    body: CustomerSessionCreate;
}

/**
 * 
 */
export class CustomerSessionsApi extends runtime.BaseAPI {

    /**
     * Create a customer session.
     * Create Customer Session
     */
    async createRaw(requestParameters: CustomerSessionsApiCreateRequest, initOverrides?: RequestInit | runtime.InitOverrideFunction): Promise<runtime.ApiResponse<CustomerSession>> {
        if (requestParameters['body'] == null) {
            throw new runtime.RequiredError(
                'body',
                'Required parameter "body" was null or undefined when calling create().'
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
            path: `/v1/customer-sessions/`,
            method: 'POST',
            headers: headerParameters,
            query: queryParameters,
            body: requestParameters['body'],
        }, initOverrides);

        return new runtime.JSONApiResponse(response);
    }

    /**
     * Create a customer session.
     * Create Customer Session
     */
    async create(requestParameters: CustomerSessionsApiCreateRequest, initOverrides?: RequestInit | runtime.InitOverrideFunction): Promise<CustomerSession> {
        const response = await this.createRaw(requestParameters, initOverrides);
        return await response.value();
    }

}
