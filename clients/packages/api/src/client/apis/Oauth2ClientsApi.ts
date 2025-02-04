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
  HTTPValidationError,
  ListResourceOAuth2Client,
  OAuth2ClientConfiguration,
  OAuth2ClientConfigurationUpdate,
} from '../models/index';

export interface Oauth2ClientsApiCreateClientRequest {
    body: OAuth2ClientConfiguration;
}

export interface Oauth2ClientsApiDeleteClientRequest {
    clientId: string;
}

export interface Oauth2ClientsApiGetClientRequest {
    clientId: string;
}

export interface Oauth2ClientsApiListRequest {
    page?: number;
    limit?: number;
}

export interface Oauth2ClientsApiUpdateClientRequest {
    clientId: string;
    body: OAuth2ClientConfigurationUpdate;
}

/**
 * 
 */
export class Oauth2ClientsApi extends runtime.BaseAPI {

    /**
     * Create an OAuth2 client.
     * Create Client
     */
    async createClientRaw(requestParameters: Oauth2ClientsApiCreateClientRequest, initOverrides?: RequestInit | runtime.InitOverrideFunction): Promise<runtime.ApiResponse<any>> {
        if (requestParameters['body'] == null) {
            throw new runtime.RequiredError(
                'body',
                'Required parameter "body" was null or undefined when calling createClient().'
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
        if (this.configuration && this.configuration.accessToken) {
            const token = this.configuration.accessToken;
            const tokenString = await token("oat", []);

            if (tokenString) {
                headerParameters["Authorization"] = `Bearer ${tokenString}`;
            }
        }
        const response = await this.request({
            path: `/v1/oauth2/register`,
            method: 'POST',
            headers: headerParameters,
            query: queryParameters,
            body: requestParameters['body'],
        }, initOverrides);

        if (this.isJsonMime(response.headers.get('content-type'))) {
            return new runtime.JSONApiResponse<any>(response);
        } else {
            return new runtime.TextApiResponse(response) as any;
        }
    }

    /**
     * Create an OAuth2 client.
     * Create Client
     */
    async createClient(requestParameters: Oauth2ClientsApiCreateClientRequest, initOverrides?: RequestInit | runtime.InitOverrideFunction): Promise<any> {
        const response = await this.createClientRaw(requestParameters, initOverrides);
        return await response.value();
    }

    /**
     * Delete an OAuth2 client.
     * Delete Client
     */
    async deleteClientRaw(requestParameters: Oauth2ClientsApiDeleteClientRequest, initOverrides?: RequestInit | runtime.InitOverrideFunction): Promise<runtime.ApiResponse<any>> {
        if (requestParameters['clientId'] == null) {
            throw new runtime.RequiredError(
                'clientId',
                'Required parameter "clientId" was null or undefined when calling deleteClient().'
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
            const tokenString = await token("oat", []);

            if (tokenString) {
                headerParameters["Authorization"] = `Bearer ${tokenString}`;
            }
        }
        const response = await this.request({
            path: `/v1/oauth2/register/{client_id}`.replace(`{${"client_id"}}`, encodeURIComponent(String(requestParameters['clientId']))),
            method: 'DELETE',
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
     * Delete an OAuth2 client.
     * Delete Client
     */
    async deleteClient(requestParameters: Oauth2ClientsApiDeleteClientRequest, initOverrides?: RequestInit | runtime.InitOverrideFunction): Promise<any> {
        const response = await this.deleteClientRaw(requestParameters, initOverrides);
        return await response.value();
    }

    /**
     * Get an OAuth2 client by Client ID.
     * Get Client
     */
    async getClientRaw(requestParameters: Oauth2ClientsApiGetClientRequest, initOverrides?: RequestInit | runtime.InitOverrideFunction): Promise<runtime.ApiResponse<any>> {
        if (requestParameters['clientId'] == null) {
            throw new runtime.RequiredError(
                'clientId',
                'Required parameter "clientId" was null or undefined when calling getClient().'
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
            const tokenString = await token("oat", []);

            if (tokenString) {
                headerParameters["Authorization"] = `Bearer ${tokenString}`;
            }
        }
        const response = await this.request({
            path: `/v1/oauth2/register/{client_id}`.replace(`{${"client_id"}}`, encodeURIComponent(String(requestParameters['clientId']))),
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
     * Get an OAuth2 client by Client ID.
     * Get Client
     */
    async getClient(requestParameters: Oauth2ClientsApiGetClientRequest, initOverrides?: RequestInit | runtime.InitOverrideFunction): Promise<any> {
        const response = await this.getClientRaw(requestParameters, initOverrides);
        return await response.value();
    }

    /**
     * List OAuth2 clients.
     * List Clients
     */
    async listRaw(requestParameters: Oauth2ClientsApiListRequest, initOverrides?: RequestInit | runtime.InitOverrideFunction): Promise<runtime.ApiResponse<ListResourceOAuth2Client>> {
        const queryParameters: any = {};

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
        if (this.configuration && this.configuration.accessToken) {
            const token = this.configuration.accessToken;
            const tokenString = await token("oat", []);

            if (tokenString) {
                headerParameters["Authorization"] = `Bearer ${tokenString}`;
            }
        }
        const response = await this.request({
            path: `/v1/oauth2/`,
            method: 'GET',
            headers: headerParameters,
            query: queryParameters,
        }, initOverrides);

        return new runtime.JSONApiResponse(response);
    }

    /**
     * List OAuth2 clients.
     * List Clients
     */
    async list(requestParameters: Oauth2ClientsApiListRequest = {}, initOverrides?: RequestInit | runtime.InitOverrideFunction): Promise<ListResourceOAuth2Client> {
        const response = await this.listRaw(requestParameters, initOverrides);
        return await response.value();
    }

    /**
     * Update an OAuth2 client.
     * Update Client
     */
    async updateClientRaw(requestParameters: Oauth2ClientsApiUpdateClientRequest, initOverrides?: RequestInit | runtime.InitOverrideFunction): Promise<runtime.ApiResponse<any>> {
        if (requestParameters['clientId'] == null) {
            throw new runtime.RequiredError(
                'clientId',
                'Required parameter "clientId" was null or undefined when calling updateClient().'
            );
        }

        if (requestParameters['body'] == null) {
            throw new runtime.RequiredError(
                'body',
                'Required parameter "body" was null or undefined when calling updateClient().'
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
        if (this.configuration && this.configuration.accessToken) {
            const token = this.configuration.accessToken;
            const tokenString = await token("oat", []);

            if (tokenString) {
                headerParameters["Authorization"] = `Bearer ${tokenString}`;
            }
        }
        const response = await this.request({
            path: `/v1/oauth2/register/{client_id}`.replace(`{${"client_id"}}`, encodeURIComponent(String(requestParameters['clientId']))),
            method: 'PUT',
            headers: headerParameters,
            query: queryParameters,
            body: requestParameters['body'],
        }, initOverrides);

        if (this.isJsonMime(response.headers.get('content-type'))) {
            return new runtime.JSONApiResponse<any>(response);
        } else {
            return new runtime.TextApiResponse(response) as any;
        }
    }

    /**
     * Update an OAuth2 client.
     * Update Client
     */
    async updateClient(requestParameters: Oauth2ClientsApiUpdateClientRequest, initOverrides?: RequestInit | runtime.InitOverrideFunction): Promise<any> {
        const response = await this.updateClientRaw(requestParameters, initOverrides);
        return await response.value();
    }

}
