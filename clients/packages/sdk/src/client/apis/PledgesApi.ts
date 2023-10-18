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
  CreatePledgeFromPaymentIntent,
  CreatePledgePayLater,
  HTTPValidationError,
  ListResourcePledge,
  Platforms,
  Pledge,
  PledgePledgesSummary,
  PledgeStripePaymentIntentCreate,
  PledgeStripePaymentIntentMutationResponse,
  PledgeStripePaymentIntentUpdate,
} from '../models/index';

export interface PledgesApiCreateRequest {
    createPledgeFromPaymentIntent: CreatePledgeFromPaymentIntent;
}

export interface PledgesApiCreateInvoiceRequest {
    id: string;
}

export interface PledgesApiCreatePayOnCompletionRequest {
    createPledgePayLater: CreatePledgePayLater;
}

export interface PledgesApiCreatePaymentIntentRequest {
    pledgeStripePaymentIntentCreate: PledgeStripePaymentIntentCreate;
}

export interface PledgesApiDisputePledgeRequest {
    pledgeId: string;
    reason: string;
}

export interface PledgesApiGetRequest {
    id: string;
}

export interface PledgesApiSearchRequest {
    platform?: Platforms;
    organizationName?: string;
    repositoryName?: string;
    issueId?: string;
    byOrganizationId?: string;
}

export interface PledgesApiSummaryRequest {
    issueId: string;
}

export interface PledgesApiUpdatePaymentIntentRequest {
    id: string;
    pledgeStripePaymentIntentUpdate: PledgeStripePaymentIntentUpdate;
}

/**
 * 
 */
export class PledgesApi extends runtime.BaseAPI {

    /**
     * Creates a pledge from a payment intent
     * Create
     */
    async createRaw(requestParameters: PledgesApiCreateRequest, initOverrides?: RequestInit | runtime.InitOverrideFunction): Promise<runtime.ApiResponse<Pledge>> {
        if (requestParameters.createPledgeFromPaymentIntent === null || requestParameters.createPledgeFromPaymentIntent === undefined) {
            throw new runtime.RequiredError('createPledgeFromPaymentIntent','Required parameter requestParameters.createPledgeFromPaymentIntent was null or undefined when calling create.');
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
            path: `/api/v1/pledges`,
            method: 'POST',
            headers: headerParameters,
            query: queryParameters,
            body: requestParameters.createPledgeFromPaymentIntent,
        }, initOverrides);

        return new runtime.JSONApiResponse(response);
    }

    /**
     * Creates a pledge from a payment intent
     * Create
     */
    async create(requestParameters: PledgesApiCreateRequest, initOverrides?: RequestInit | runtime.InitOverrideFunction): Promise<Pledge> {
        const response = await this.createRaw(requestParameters, initOverrides);
        return await response.value();
    }

    /**
     * Creates an invoice for pay_on_completion pledges
     * Create Invoice
     */
    async createInvoiceRaw(requestParameters: PledgesApiCreateInvoiceRequest, initOverrides?: RequestInit | runtime.InitOverrideFunction): Promise<runtime.ApiResponse<Pledge>> {
        if (requestParameters.id === null || requestParameters.id === undefined) {
            throw new runtime.RequiredError('id','Required parameter requestParameters.id was null or undefined when calling createInvoice.');
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
            path: `/api/v1/pledges/{id}/create_invoice`.replace(`{${"id"}}`, encodeURIComponent(String(requestParameters.id))),
            method: 'POST',
            headers: headerParameters,
            query: queryParameters,
        }, initOverrides);

        return new runtime.JSONApiResponse(response);
    }

    /**
     * Creates an invoice for pay_on_completion pledges
     * Create Invoice
     */
    async createInvoice(requestParameters: PledgesApiCreateInvoiceRequest, initOverrides?: RequestInit | runtime.InitOverrideFunction): Promise<Pledge> {
        const response = await this.createInvoiceRaw(requestParameters, initOverrides);
        return await response.value();
    }

    /**
     * Creates a pay_on_completion type of pledge
     * Create Pay On Completion
     */
    async createPayOnCompletionRaw(requestParameters: PledgesApiCreatePayOnCompletionRequest, initOverrides?: RequestInit | runtime.InitOverrideFunction): Promise<runtime.ApiResponse<Pledge>> {
        if (requestParameters.createPledgePayLater === null || requestParameters.createPledgePayLater === undefined) {
            throw new runtime.RequiredError('createPledgePayLater','Required parameter requestParameters.createPledgePayLater was null or undefined when calling createPayOnCompletion.');
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
            path: `/api/v1/pledges/pay_on_completion`,
            method: 'POST',
            headers: headerParameters,
            query: queryParameters,
            body: requestParameters.createPledgePayLater,
        }, initOverrides);

        return new runtime.JSONApiResponse(response);
    }

    /**
     * Creates a pay_on_completion type of pledge
     * Create Pay On Completion
     */
    async createPayOnCompletion(requestParameters: PledgesApiCreatePayOnCompletionRequest, initOverrides?: RequestInit | runtime.InitOverrideFunction): Promise<Pledge> {
        const response = await this.createPayOnCompletionRaw(requestParameters, initOverrides);
        return await response.value();
    }

    /**
     * Create Payment Intent
     */
    async createPaymentIntentRaw(requestParameters: PledgesApiCreatePaymentIntentRequest, initOverrides?: RequestInit | runtime.InitOverrideFunction): Promise<runtime.ApiResponse<PledgeStripePaymentIntentMutationResponse>> {
        if (requestParameters.pledgeStripePaymentIntentCreate === null || requestParameters.pledgeStripePaymentIntentCreate === undefined) {
            throw new runtime.RequiredError('pledgeStripePaymentIntentCreate','Required parameter requestParameters.pledgeStripePaymentIntentCreate was null or undefined when calling createPaymentIntent.');
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
            path: `/api/v1/pledges/payment_intent`,
            method: 'POST',
            headers: headerParameters,
            query: queryParameters,
            body: requestParameters.pledgeStripePaymentIntentCreate,
        }, initOverrides);

        return new runtime.JSONApiResponse(response);
    }

    /**
     * Create Payment Intent
     */
    async createPaymentIntent(requestParameters: PledgesApiCreatePaymentIntentRequest, initOverrides?: RequestInit | runtime.InitOverrideFunction): Promise<PledgeStripePaymentIntentMutationResponse> {
        const response = await this.createPaymentIntentRaw(requestParameters, initOverrides);
        return await response.value();
    }

    /**
     * Dispute Pledge
     */
    async disputePledgeRaw(requestParameters: PledgesApiDisputePledgeRequest, initOverrides?: RequestInit | runtime.InitOverrideFunction): Promise<runtime.ApiResponse<Pledge>> {
        if (requestParameters.pledgeId === null || requestParameters.pledgeId === undefined) {
            throw new runtime.RequiredError('pledgeId','Required parameter requestParameters.pledgeId was null or undefined when calling disputePledge.');
        }

        if (requestParameters.reason === null || requestParameters.reason === undefined) {
            throw new runtime.RequiredError('reason','Required parameter requestParameters.reason was null or undefined when calling disputePledge.');
        }

        const queryParameters: any = {};

        if (requestParameters.reason !== undefined) {
            queryParameters['reason'] = requestParameters.reason;
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
            path: `/api/v1/pledges/{pledge_id}/dispute`.replace(`{${"pledge_id"}}`, encodeURIComponent(String(requestParameters.pledgeId))),
            method: 'POST',
            headers: headerParameters,
            query: queryParameters,
        }, initOverrides);

        return new runtime.JSONApiResponse(response);
    }

    /**
     * Dispute Pledge
     */
    async disputePledge(requestParameters: PledgesApiDisputePledgeRequest, initOverrides?: RequestInit | runtime.InitOverrideFunction): Promise<Pledge> {
        const response = await this.disputePledgeRaw(requestParameters, initOverrides);
        return await response.value();
    }

    /**
     * Get a pledge. Requires authentication.
     * Get pledge (Public API)
     */
    async getRaw(requestParameters: PledgesApiGetRequest, initOverrides?: RequestInit | runtime.InitOverrideFunction): Promise<runtime.ApiResponse<Pledge>> {
        if (requestParameters.id === null || requestParameters.id === undefined) {
            throw new runtime.RequiredError('id','Required parameter requestParameters.id was null or undefined when calling get.');
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
            path: `/api/v1/pledges/{id}`.replace(`{${"id"}}`, encodeURIComponent(String(requestParameters.id))),
            method: 'GET',
            headers: headerParameters,
            query: queryParameters,
        }, initOverrides);

        return new runtime.JSONApiResponse(response);
    }

    /**
     * Get a pledge. Requires authentication.
     * Get pledge (Public API)
     */
    async get(requestParameters: PledgesApiGetRequest, initOverrides?: RequestInit | runtime.InitOverrideFunction): Promise<Pledge> {
        const response = await this.getRaw(requestParameters, initOverrides);
        return await response.value();
    }

    /**
     * Search pledges. Requires authentication. The user can only read pledges that they have made (personally or via an organization) or received (to organizations that they are a member of).
     * Search pledges (Public API)
     */
    async searchRaw(requestParameters: PledgesApiSearchRequest, initOverrides?: RequestInit | runtime.InitOverrideFunction): Promise<runtime.ApiResponse<ListResourcePledge>> {
        const queryParameters: any = {};

        if (requestParameters.platform !== undefined) {
            queryParameters['platform'] = requestParameters.platform;
        }

        if (requestParameters.organizationName !== undefined) {
            queryParameters['organization_name'] = requestParameters.organizationName;
        }

        if (requestParameters.repositoryName !== undefined) {
            queryParameters['repository_name'] = requestParameters.repositoryName;
        }

        if (requestParameters.issueId !== undefined) {
            queryParameters['issue_id'] = requestParameters.issueId;
        }

        if (requestParameters.byOrganizationId !== undefined) {
            queryParameters['by_organization_id'] = requestParameters.byOrganizationId;
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
            path: `/api/v1/pledges/search`,
            method: 'GET',
            headers: headerParameters,
            query: queryParameters,
        }, initOverrides);

        return new runtime.JSONApiResponse(response);
    }

    /**
     * Search pledges. Requires authentication. The user can only read pledges that they have made (personally or via an organization) or received (to organizations that they are a member of).
     * Search pledges (Public API)
     */
    async search(requestParameters: PledgesApiSearchRequest = {}, initOverrides?: RequestInit | runtime.InitOverrideFunction): Promise<ListResourcePledge> {
        const response = await this.searchRaw(requestParameters, initOverrides);
        return await response.value();
    }

    /**
     * Get summary of pledges for resource.
     * Get pledges summary (Public API)
     */
    async summaryRaw(requestParameters: PledgesApiSummaryRequest, initOverrides?: RequestInit | runtime.InitOverrideFunction): Promise<runtime.ApiResponse<PledgePledgesSummary>> {
        if (requestParameters.issueId === null || requestParameters.issueId === undefined) {
            throw new runtime.RequiredError('issueId','Required parameter requestParameters.issueId was null or undefined when calling summary.');
        }

        const queryParameters: any = {};

        if (requestParameters.issueId !== undefined) {
            queryParameters['issue_id'] = requestParameters.issueId;
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
            path: `/api/v1/pledges/summary`,
            method: 'GET',
            headers: headerParameters,
            query: queryParameters,
        }, initOverrides);

        return new runtime.JSONApiResponse(response);
    }

    /**
     * Get summary of pledges for resource.
     * Get pledges summary (Public API)
     */
    async summary(requestParameters: PledgesApiSummaryRequest, initOverrides?: RequestInit | runtime.InitOverrideFunction): Promise<PledgePledgesSummary> {
        const response = await this.summaryRaw(requestParameters, initOverrides);
        return await response.value();
    }

    /**
     * Update Payment Intent
     */
    async updatePaymentIntentRaw(requestParameters: PledgesApiUpdatePaymentIntentRequest, initOverrides?: RequestInit | runtime.InitOverrideFunction): Promise<runtime.ApiResponse<PledgeStripePaymentIntentMutationResponse>> {
        if (requestParameters.id === null || requestParameters.id === undefined) {
            throw new runtime.RequiredError('id','Required parameter requestParameters.id was null or undefined when calling updatePaymentIntent.');
        }

        if (requestParameters.pledgeStripePaymentIntentUpdate === null || requestParameters.pledgeStripePaymentIntentUpdate === undefined) {
            throw new runtime.RequiredError('pledgeStripePaymentIntentUpdate','Required parameter requestParameters.pledgeStripePaymentIntentUpdate was null or undefined when calling updatePaymentIntent.');
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
            path: `/api/v1/pledges/payment_intent/{id}`.replace(`{${"id"}}`, encodeURIComponent(String(requestParameters.id))),
            method: 'PATCH',
            headers: headerParameters,
            query: queryParameters,
            body: requestParameters.pledgeStripePaymentIntentUpdate,
        }, initOverrides);

        return new runtime.JSONApiResponse(response);
    }

    /**
     * Update Payment Intent
     */
    async updatePaymentIntent(requestParameters: PledgesApiUpdatePaymentIntentRequest, initOverrides?: RequestInit | runtime.InitOverrideFunction): Promise<PledgeStripePaymentIntentMutationResponse> {
        const response = await this.updatePaymentIntentRaw(requestParameters, initOverrides);
        return await response.value();
    }

}
