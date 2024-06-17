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
  ListResourceSubscription,
  Subscription,
  SubscriptionCreateEmail,
  SubscriptionTierType,
  SubscriptionsImported,
} from '../models/index';

export interface SubscriptionsApiCreateSubscriptionRequest {
    subscriptionCreateEmail: SubscriptionCreateEmail;
}

export interface SubscriptionsApiListSubscriptionsRequest {
    organizationId?: string;
    productId?: string;
    type?: SubscriptionTierType;
    active?: boolean;
    page?: number;
    limit?: number;
    sorting?: Array<string>;
}

export interface SubscriptionsApiSubscriptionsExportRequest {
    organizationId?: string;
}

export interface SubscriptionsApiSubscriptionsImportRequest {
    file: Blob;
    organizationId: string;
}

/**
 * 
 */
export class SubscriptionsApi extends runtime.BaseAPI {

    /**
     * Create a subscription on the free tier for a given email.
     * Create Subscription
     */
    async createSubscriptionRaw(requestParameters: SubscriptionsApiCreateSubscriptionRequest, initOverrides?: RequestInit | runtime.InitOverrideFunction): Promise<runtime.ApiResponse<Subscription>> {
        if (requestParameters['subscriptionCreateEmail'] == null) {
            throw new runtime.RequiredError(
                'subscriptionCreateEmail',
                'Required parameter "subscriptionCreateEmail" was null or undefined when calling createSubscription().'
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
            path: `/api/v1/subscriptions/`,
            method: 'POST',
            headers: headerParameters,
            query: queryParameters,
            body: requestParameters['subscriptionCreateEmail'],
        }, initOverrides);

        return new runtime.JSONApiResponse(response);
    }

    /**
     * Create a subscription on the free tier for a given email.
     * Create Subscription
     */
    async createSubscription(requestParameters: SubscriptionsApiCreateSubscriptionRequest, initOverrides?: RequestInit | runtime.InitOverrideFunction): Promise<Subscription> {
        const response = await this.createSubscriptionRaw(requestParameters, initOverrides);
        return await response.value();
    }

    /**
     * List subscriptions.
     * List Subscriptions
     */
    async listSubscriptionsRaw(requestParameters: SubscriptionsApiListSubscriptionsRequest, initOverrides?: RequestInit | runtime.InitOverrideFunction): Promise<runtime.ApiResponse<ListResourceSubscription>> {
        const queryParameters: any = {};

        if (requestParameters['organizationId'] != null) {
            queryParameters['organization_id'] = requestParameters['organizationId'];
        }

        if (requestParameters['productId'] != null) {
            queryParameters['product_id'] = requestParameters['productId'];
        }

        if (requestParameters['type'] != null) {
            queryParameters['type'] = requestParameters['type'];
        }

        if (requestParameters['active'] != null) {
            queryParameters['active'] = requestParameters['active'];
        }

        if (requestParameters['page'] != null) {
            queryParameters['page'] = requestParameters['page'];
        }

        if (requestParameters['limit'] != null) {
            queryParameters['limit'] = requestParameters['limit'];
        }

        if (requestParameters['sorting'] != null) {
            queryParameters['sorting'] = requestParameters['sorting'];
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
            path: `/api/v1/subscriptions/`,
            method: 'GET',
            headers: headerParameters,
            query: queryParameters,
        }, initOverrides);

        return new runtime.JSONApiResponse(response);
    }

    /**
     * List subscriptions.
     * List Subscriptions
     */
    async listSubscriptions(requestParameters: SubscriptionsApiListSubscriptionsRequest = {}, initOverrides?: RequestInit | runtime.InitOverrideFunction): Promise<ListResourceSubscription> {
        const response = await this.listSubscriptionsRaw(requestParameters, initOverrides);
        return await response.value();
    }

    /**
     * Export subscriptions as a CSV file.
     * Subscriptions Export
     */
    async subscriptionsExportRaw(requestParameters: SubscriptionsApiSubscriptionsExportRequest, initOverrides?: RequestInit | runtime.InitOverrideFunction): Promise<runtime.ApiResponse<any>> {
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
            path: `/api/v1/subscriptions/export`,
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
     * Export subscriptions as a CSV file.
     * Subscriptions Export
     */
    async subscriptionsExport(requestParameters: SubscriptionsApiSubscriptionsExportRequest = {}, initOverrides?: RequestInit | runtime.InitOverrideFunction): Promise<any> {
        const response = await this.subscriptionsExportRaw(requestParameters, initOverrides);
        return await response.value();
    }

    /**
     * Import subscriptions from a CSV file.
     * Subscriptions Import
     */
    async subscriptionsImportRaw(requestParameters: SubscriptionsApiSubscriptionsImportRequest, initOverrides?: RequestInit | runtime.InitOverrideFunction): Promise<runtime.ApiResponse<SubscriptionsImported>> {
        if (requestParameters['file'] == null) {
            throw new runtime.RequiredError(
                'file',
                'Required parameter "file" was null or undefined when calling subscriptionsImport().'
            );
        }

        if (requestParameters['organizationId'] == null) {
            throw new runtime.RequiredError(
                'organizationId',
                'Required parameter "organizationId" was null or undefined when calling subscriptionsImport().'
            );
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
        const consumes: runtime.Consume[] = [
            { contentType: 'multipart/form-data' },
        ];
        // @ts-ignore: canConsumeForm may be unused
        const canConsumeForm = runtime.canConsumeForm(consumes);

        let formParams: { append(param: string, value: any): any };
        let useForm = false;
        // use FormData to transmit files using content-type "multipart/form-data"
        useForm = canConsumeForm;
        if (useForm) {
            formParams = new FormData();
        } else {
            formParams = new URLSearchParams();
        }

        if (requestParameters['file'] != null) {
            formParams.append('file', requestParameters['file'] as any);
        }

        if (requestParameters['organizationId'] != null) {
            formParams.append('organization_id', requestParameters['organizationId'] as any);
        }

        const response = await this.request({
            path: `/api/v1/subscriptions/import`,
            method: 'POST',
            headers: headerParameters,
            query: queryParameters,
            body: formParams,
        }, initOverrides);

        return new runtime.JSONApiResponse(response);
    }

    /**
     * Import subscriptions from a CSV file.
     * Subscriptions Import
     */
    async subscriptionsImport(requestParameters: SubscriptionsApiSubscriptionsImportRequest, initOverrides?: RequestInit | runtime.InitOverrideFunction): Promise<SubscriptionsImported> {
        const response = await this.subscriptionsImportRaw(requestParameters, initOverrides);
        return await response.value();
    }

}
