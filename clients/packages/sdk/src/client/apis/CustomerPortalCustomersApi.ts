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
  CustomerPortalCustomer,
  HTTPValidationError,
  ResourceNotFound,
} from '../models/index';

export interface CustomerPortalCustomersApiGetRequest {
    id: string;
}

/**
 * 
 */
export class CustomerPortalCustomersApi extends runtime.BaseAPI {

    /**
     * Get a customer by ID for the authenticated customer or user.
     * Get Customer
     */
    async getRaw(requestParameters: CustomerPortalCustomersApiGetRequest, initOverrides?: RequestInit | runtime.InitOverrideFunction): Promise<runtime.ApiResponse<CustomerPortalCustomer>> {
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
        if (this.configuration && this.configuration.accessToken) {
            const token = this.configuration.accessToken;
            const tokenString = await token("customer_session", []);

            if (tokenString) {
                headerParameters["Authorization"] = `Bearer ${tokenString}`;
            }
        }
        const response = await this.request({
            path: `/v1/customer-portal/customers/{id}`.replace(`{${"id"}}`, encodeURIComponent(String(requestParameters['id']))),
            method: 'GET',
            headers: headerParameters,
            query: queryParameters,
        }, initOverrides);

        return new runtime.JSONApiResponse(response);
    }

    /**
     * Get a customer by ID for the authenticated customer or user.
     * Get Customer
     */
    async get(requestParameters: CustomerPortalCustomersApiGetRequest, initOverrides?: RequestInit | runtime.InitOverrideFunction): Promise<CustomerPortalCustomer> {
        const response = await this.getRaw(requestParameters, initOverrides);
        return await response.value();
    }

}