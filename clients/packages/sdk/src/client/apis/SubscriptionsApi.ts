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
  ListResourceSubscription,
  ListResourceSubscriptionTier,
  ListResourceUnionSubscriptionBenefitBuiltinSubscriptionBenefitCustom,
  Platforms,
  ResponseSubscriptionsCreateSubscriptionBenefit,
  ResponseSubscriptionsLookupSubscriptionBenefit,
  ResponseSubscriptionsUpdateSubscriptionBenefit,
  SubscribeSession,
  SubscribeSessionCreate,
  SubscriptionBenefitCreate,
  SubscriptionBenefitType,
  SubscriptionBenefitUpdate,
  SubscriptionTier,
  SubscriptionTierBenefitsUpdate,
  SubscriptionTierCreate,
  SubscriptionTierType,
  SubscriptionTierUpdate,
  SubscriptionsSummary,
} from '../models/index';

export interface SubscriptionsApiArchiveSubscriptionTierRequest {
    id: string;
}

export interface SubscriptionsApiCreateSubscribeSessionRequest {
    subscribeSessionCreate: SubscribeSessionCreate;
}

export interface SubscriptionsApiCreateSubscriptionBenefitRequest {
    subscriptionBenefitCreate: SubscriptionBenefitCreate;
}

export interface SubscriptionsApiCreateSubscriptionTierRequest {
    subscriptionTierCreate: SubscriptionTierCreate;
}

export interface SubscriptionsApiGetSubscribeSessionRequest {
    id: string;
}

export interface SubscriptionsApiGetSubscriptionsSummaryRequest {
    organizationName: string;
    platform: Platforms;
    startDate: string;
    endDate: string;
    repositoryName?: string;
    directOrganization?: boolean;
    type?: SubscriptionTierType;
    subscriptionTierId?: string;
}

export interface SubscriptionsApiLookupSubscriptionBenefitRequest {
    subscriptionBenefitId: string;
}

export interface SubscriptionsApiLookupSubscriptionTierRequest {
    subscriptionTierId: string;
}

export interface SubscriptionsApiSearchSubscriptionBenefitsRequest {
    organizationName: string;
    platform: Platforms;
    repositoryName?: string;
    directOrganization?: boolean;
    type?: SubscriptionBenefitType;
    page?: number;
    limit?: number;
}

export interface SubscriptionsApiSearchSubscriptionTiersRequest {
    organizationName: string;
    platform: Platforms;
    repositoryName?: string;
    directOrganization?: boolean;
    showArchived?: boolean;
    type?: SubscriptionTierType;
    page?: number;
    limit?: number;
}

export interface SubscriptionsApiSearchSubscriptionsRequest {
    organizationName: string;
    platform: Platforms;
    repositoryName?: string;
    directOrganization?: boolean;
    type?: SubscriptionTierType;
    subscriptionTierId?: string;
    page?: number;
    limit?: number;
    sorting?: Array<string>;
}

export interface SubscriptionsApiUpdateSubscriptionBenefitRequest {
    id: string;
    subscriptionBenefitUpdate: SubscriptionBenefitUpdate;
}

export interface SubscriptionsApiUpdateSubscriptionTierRequest {
    id: string;
    subscriptionTierUpdate: SubscriptionTierUpdate;
}

export interface SubscriptionsApiUpdateSubscriptionTierBenefitsRequest {
    id: string;
    subscriptionTierBenefitsUpdate: SubscriptionTierBenefitsUpdate;
}

/**
 * 
 */
export class SubscriptionsApi extends runtime.BaseAPI {

    /**
     * Archive Subscription Tier
     */
    async archiveSubscriptionTierRaw(requestParameters: SubscriptionsApiArchiveSubscriptionTierRequest, initOverrides?: RequestInit | runtime.InitOverrideFunction): Promise<runtime.ApiResponse<SubscriptionTier>> {
        if (requestParameters.id === null || requestParameters.id === undefined) {
            throw new runtime.RequiredError('id','Required parameter requestParameters.id was null or undefined when calling archiveSubscriptionTier.');
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
            path: `/api/v1/subscriptions/tiers/{id}/archive`.replace(`{${"id"}}`, encodeURIComponent(String(requestParameters.id))),
            method: 'POST',
            headers: headerParameters,
            query: queryParameters,
        }, initOverrides);

        return new runtime.JSONApiResponse(response);
    }

    /**
     * Archive Subscription Tier
     */
    async archiveSubscriptionTier(requestParameters: SubscriptionsApiArchiveSubscriptionTierRequest, initOverrides?: RequestInit | runtime.InitOverrideFunction): Promise<SubscriptionTier> {
        const response = await this.archiveSubscriptionTierRaw(requestParameters, initOverrides);
        return await response.value();
    }

    /**
     * Create Subscribe Session
     */
    async createSubscribeSessionRaw(requestParameters: SubscriptionsApiCreateSubscribeSessionRequest, initOverrides?: RequestInit | runtime.InitOverrideFunction): Promise<runtime.ApiResponse<SubscribeSession>> {
        if (requestParameters.subscribeSessionCreate === null || requestParameters.subscribeSessionCreate === undefined) {
            throw new runtime.RequiredError('subscribeSessionCreate','Required parameter requestParameters.subscribeSessionCreate was null or undefined when calling createSubscribeSession.');
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
            path: `/api/v1/subscriptions/subscribe-sessions/`,
            method: 'POST',
            headers: headerParameters,
            query: queryParameters,
            body: requestParameters.subscribeSessionCreate,
        }, initOverrides);

        return new runtime.JSONApiResponse(response);
    }

    /**
     * Create Subscribe Session
     */
    async createSubscribeSession(requestParameters: SubscriptionsApiCreateSubscribeSessionRequest, initOverrides?: RequestInit | runtime.InitOverrideFunction): Promise<SubscribeSession> {
        const response = await this.createSubscribeSessionRaw(requestParameters, initOverrides);
        return await response.value();
    }

    /**
     * Create Subscription Benefit
     */
    async createSubscriptionBenefitRaw(requestParameters: SubscriptionsApiCreateSubscriptionBenefitRequest, initOverrides?: RequestInit | runtime.InitOverrideFunction): Promise<runtime.ApiResponse<ResponseSubscriptionsCreateSubscriptionBenefit>> {
        if (requestParameters.subscriptionBenefitCreate === null || requestParameters.subscriptionBenefitCreate === undefined) {
            throw new runtime.RequiredError('subscriptionBenefitCreate','Required parameter requestParameters.subscriptionBenefitCreate was null or undefined when calling createSubscriptionBenefit.');
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
            path: `/api/v1/subscriptions/benefits/`,
            method: 'POST',
            headers: headerParameters,
            query: queryParameters,
            body: requestParameters.subscriptionBenefitCreate,
        }, initOverrides);

        return new runtime.JSONApiResponse(response);
    }

    /**
     * Create Subscription Benefit
     */
    async createSubscriptionBenefit(requestParameters: SubscriptionsApiCreateSubscriptionBenefitRequest, initOverrides?: RequestInit | runtime.InitOverrideFunction): Promise<ResponseSubscriptionsCreateSubscriptionBenefit> {
        const response = await this.createSubscriptionBenefitRaw(requestParameters, initOverrides);
        return await response.value();
    }

    /**
     * Create Subscription Tier
     */
    async createSubscriptionTierRaw(requestParameters: SubscriptionsApiCreateSubscriptionTierRequest, initOverrides?: RequestInit | runtime.InitOverrideFunction): Promise<runtime.ApiResponse<SubscriptionTier>> {
        if (requestParameters.subscriptionTierCreate === null || requestParameters.subscriptionTierCreate === undefined) {
            throw new runtime.RequiredError('subscriptionTierCreate','Required parameter requestParameters.subscriptionTierCreate was null or undefined when calling createSubscriptionTier.');
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
            path: `/api/v1/subscriptions/tiers/`,
            method: 'POST',
            headers: headerParameters,
            query: queryParameters,
            body: requestParameters.subscriptionTierCreate,
        }, initOverrides);

        return new runtime.JSONApiResponse(response);
    }

    /**
     * Create Subscription Tier
     */
    async createSubscriptionTier(requestParameters: SubscriptionsApiCreateSubscriptionTierRequest, initOverrides?: RequestInit | runtime.InitOverrideFunction): Promise<SubscriptionTier> {
        const response = await this.createSubscriptionTierRaw(requestParameters, initOverrides);
        return await response.value();
    }

    /**
     * Get Subscribe Session
     */
    async getSubscribeSessionRaw(requestParameters: SubscriptionsApiGetSubscribeSessionRequest, initOverrides?: RequestInit | runtime.InitOverrideFunction): Promise<runtime.ApiResponse<SubscribeSession>> {
        if (requestParameters.id === null || requestParameters.id === undefined) {
            throw new runtime.RequiredError('id','Required parameter requestParameters.id was null or undefined when calling getSubscribeSession.');
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
            path: `/api/v1/subscriptions/subscribe-sessions/{id}`.replace(`{${"id"}}`, encodeURIComponent(String(requestParameters.id))),
            method: 'GET',
            headers: headerParameters,
            query: queryParameters,
        }, initOverrides);

        return new runtime.JSONApiResponse(response);
    }

    /**
     * Get Subscribe Session
     */
    async getSubscribeSession(requestParameters: SubscriptionsApiGetSubscribeSessionRequest, initOverrides?: RequestInit | runtime.InitOverrideFunction): Promise<SubscribeSession> {
        const response = await this.getSubscribeSessionRaw(requestParameters, initOverrides);
        return await response.value();
    }

    /**
     * Get Subscriptions Summary
     */
    async getSubscriptionsSummaryRaw(requestParameters: SubscriptionsApiGetSubscriptionsSummaryRequest, initOverrides?: RequestInit | runtime.InitOverrideFunction): Promise<runtime.ApiResponse<SubscriptionsSummary>> {
        if (requestParameters.organizationName === null || requestParameters.organizationName === undefined) {
            throw new runtime.RequiredError('organizationName','Required parameter requestParameters.organizationName was null or undefined when calling getSubscriptionsSummary.');
        }

        if (requestParameters.platform === null || requestParameters.platform === undefined) {
            throw new runtime.RequiredError('platform','Required parameter requestParameters.platform was null or undefined when calling getSubscriptionsSummary.');
        }

        if (requestParameters.startDate === null || requestParameters.startDate === undefined) {
            throw new runtime.RequiredError('startDate','Required parameter requestParameters.startDate was null or undefined when calling getSubscriptionsSummary.');
        }

        if (requestParameters.endDate === null || requestParameters.endDate === undefined) {
            throw new runtime.RequiredError('endDate','Required parameter requestParameters.endDate was null or undefined when calling getSubscriptionsSummary.');
        }

        const queryParameters: any = {};

        if (requestParameters.organizationName !== undefined) {
            queryParameters['organization_name'] = requestParameters.organizationName;
        }

        if (requestParameters.repositoryName !== undefined) {
            queryParameters['repository_name'] = requestParameters.repositoryName;
        }

        if (requestParameters.platform !== undefined) {
            queryParameters['platform'] = requestParameters.platform;
        }

        if (requestParameters.startDate !== undefined) {
            queryParameters['start_date'] = requestParameters.startDate;
        }

        if (requestParameters.endDate !== undefined) {
            queryParameters['end_date'] = requestParameters.endDate;
        }

        if (requestParameters.directOrganization !== undefined) {
            queryParameters['direct_organization'] = requestParameters.directOrganization;
        }

        if (requestParameters.type !== undefined) {
            queryParameters['type'] = requestParameters.type;
        }

        if (requestParameters.subscriptionTierId !== undefined) {
            queryParameters['subscription_tier_id'] = requestParameters.subscriptionTierId;
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
            path: `/api/v1/subscriptions/subscriptions/summary`,
            method: 'GET',
            headers: headerParameters,
            query: queryParameters,
        }, initOverrides);

        return new runtime.JSONApiResponse(response);
    }

    /**
     * Get Subscriptions Summary
     */
    async getSubscriptionsSummary(requestParameters: SubscriptionsApiGetSubscriptionsSummaryRequest, initOverrides?: RequestInit | runtime.InitOverrideFunction): Promise<SubscriptionsSummary> {
        const response = await this.getSubscriptionsSummaryRaw(requestParameters, initOverrides);
        return await response.value();
    }

    /**
     * Lookup Subscription Benefit
     */
    async lookupSubscriptionBenefitRaw(requestParameters: SubscriptionsApiLookupSubscriptionBenefitRequest, initOverrides?: RequestInit | runtime.InitOverrideFunction): Promise<runtime.ApiResponse<ResponseSubscriptionsLookupSubscriptionBenefit>> {
        if (requestParameters.subscriptionBenefitId === null || requestParameters.subscriptionBenefitId === undefined) {
            throw new runtime.RequiredError('subscriptionBenefitId','Required parameter requestParameters.subscriptionBenefitId was null or undefined when calling lookupSubscriptionBenefit.');
        }

        const queryParameters: any = {};

        if (requestParameters.subscriptionBenefitId !== undefined) {
            queryParameters['subscription_benefit_id'] = requestParameters.subscriptionBenefitId;
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
            path: `/api/v1/subscriptions/benefits/lookup`,
            method: 'GET',
            headers: headerParameters,
            query: queryParameters,
        }, initOverrides);

        return new runtime.JSONApiResponse(response);
    }

    /**
     * Lookup Subscription Benefit
     */
    async lookupSubscriptionBenefit(requestParameters: SubscriptionsApiLookupSubscriptionBenefitRequest, initOverrides?: RequestInit | runtime.InitOverrideFunction): Promise<ResponseSubscriptionsLookupSubscriptionBenefit> {
        const response = await this.lookupSubscriptionBenefitRaw(requestParameters, initOverrides);
        return await response.value();
    }

    /**
     * Lookup Subscription Tier
     */
    async lookupSubscriptionTierRaw(requestParameters: SubscriptionsApiLookupSubscriptionTierRequest, initOverrides?: RequestInit | runtime.InitOverrideFunction): Promise<runtime.ApiResponse<SubscriptionTier>> {
        if (requestParameters.subscriptionTierId === null || requestParameters.subscriptionTierId === undefined) {
            throw new runtime.RequiredError('subscriptionTierId','Required parameter requestParameters.subscriptionTierId was null or undefined when calling lookupSubscriptionTier.');
        }

        const queryParameters: any = {};

        if (requestParameters.subscriptionTierId !== undefined) {
            queryParameters['subscription_tier_id'] = requestParameters.subscriptionTierId;
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
            path: `/api/v1/subscriptions/tiers/lookup`,
            method: 'GET',
            headers: headerParameters,
            query: queryParameters,
        }, initOverrides);

        return new runtime.JSONApiResponse(response);
    }

    /**
     * Lookup Subscription Tier
     */
    async lookupSubscriptionTier(requestParameters: SubscriptionsApiLookupSubscriptionTierRequest, initOverrides?: RequestInit | runtime.InitOverrideFunction): Promise<SubscriptionTier> {
        const response = await this.lookupSubscriptionTierRaw(requestParameters, initOverrides);
        return await response.value();
    }

    /**
     * Search Subscription Benefits
     */
    async searchSubscriptionBenefitsRaw(requestParameters: SubscriptionsApiSearchSubscriptionBenefitsRequest, initOverrides?: RequestInit | runtime.InitOverrideFunction): Promise<runtime.ApiResponse<ListResourceUnionSubscriptionBenefitBuiltinSubscriptionBenefitCustom>> {
        if (requestParameters.organizationName === null || requestParameters.organizationName === undefined) {
            throw new runtime.RequiredError('organizationName','Required parameter requestParameters.organizationName was null or undefined when calling searchSubscriptionBenefits.');
        }

        if (requestParameters.platform === null || requestParameters.platform === undefined) {
            throw new runtime.RequiredError('platform','Required parameter requestParameters.platform was null or undefined when calling searchSubscriptionBenefits.');
        }

        const queryParameters: any = {};

        if (requestParameters.organizationName !== undefined) {
            queryParameters['organization_name'] = requestParameters.organizationName;
        }

        if (requestParameters.repositoryName !== undefined) {
            queryParameters['repository_name'] = requestParameters.repositoryName;
        }

        if (requestParameters.directOrganization !== undefined) {
            queryParameters['direct_organization'] = requestParameters.directOrganization;
        }

        if (requestParameters.type !== undefined) {
            queryParameters['type'] = requestParameters.type;
        }

        if (requestParameters.platform !== undefined) {
            queryParameters['platform'] = requestParameters.platform;
        }

        if (requestParameters.page !== undefined) {
            queryParameters['page'] = requestParameters.page;
        }

        if (requestParameters.limit !== undefined) {
            queryParameters['limit'] = requestParameters.limit;
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
            path: `/api/v1/subscriptions/benefits/search`,
            method: 'GET',
            headers: headerParameters,
            query: queryParameters,
        }, initOverrides);

        return new runtime.JSONApiResponse(response);
    }

    /**
     * Search Subscription Benefits
     */
    async searchSubscriptionBenefits(requestParameters: SubscriptionsApiSearchSubscriptionBenefitsRequest, initOverrides?: RequestInit | runtime.InitOverrideFunction): Promise<ListResourceUnionSubscriptionBenefitBuiltinSubscriptionBenefitCustom> {
        const response = await this.searchSubscriptionBenefitsRaw(requestParameters, initOverrides);
        return await response.value();
    }

    /**
     * Search Subscription Tiers
     */
    async searchSubscriptionTiersRaw(requestParameters: SubscriptionsApiSearchSubscriptionTiersRequest, initOverrides?: RequestInit | runtime.InitOverrideFunction): Promise<runtime.ApiResponse<ListResourceSubscriptionTier>> {
        if (requestParameters.organizationName === null || requestParameters.organizationName === undefined) {
            throw new runtime.RequiredError('organizationName','Required parameter requestParameters.organizationName was null or undefined when calling searchSubscriptionTiers.');
        }

        if (requestParameters.platform === null || requestParameters.platform === undefined) {
            throw new runtime.RequiredError('platform','Required parameter requestParameters.platform was null or undefined when calling searchSubscriptionTiers.');
        }

        const queryParameters: any = {};

        if (requestParameters.organizationName !== undefined) {
            queryParameters['organization_name'] = requestParameters.organizationName;
        }

        if (requestParameters.repositoryName !== undefined) {
            queryParameters['repository_name'] = requestParameters.repositoryName;
        }

        if (requestParameters.directOrganization !== undefined) {
            queryParameters['direct_organization'] = requestParameters.directOrganization;
        }

        if (requestParameters.showArchived !== undefined) {
            queryParameters['show_archived'] = requestParameters.showArchived;
        }

        if (requestParameters.type !== undefined) {
            queryParameters['type'] = requestParameters.type;
        }

        if (requestParameters.platform !== undefined) {
            queryParameters['platform'] = requestParameters.platform;
        }

        if (requestParameters.page !== undefined) {
            queryParameters['page'] = requestParameters.page;
        }

        if (requestParameters.limit !== undefined) {
            queryParameters['limit'] = requestParameters.limit;
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
            path: `/api/v1/subscriptions/tiers/search`,
            method: 'GET',
            headers: headerParameters,
            query: queryParameters,
        }, initOverrides);

        return new runtime.JSONApiResponse(response);
    }

    /**
     * Search Subscription Tiers
     */
    async searchSubscriptionTiers(requestParameters: SubscriptionsApiSearchSubscriptionTiersRequest, initOverrides?: RequestInit | runtime.InitOverrideFunction): Promise<ListResourceSubscriptionTier> {
        const response = await this.searchSubscriptionTiersRaw(requestParameters, initOverrides);
        return await response.value();
    }

    /**
     * Search Subscriptions
     */
    async searchSubscriptionsRaw(requestParameters: SubscriptionsApiSearchSubscriptionsRequest, initOverrides?: RequestInit | runtime.InitOverrideFunction): Promise<runtime.ApiResponse<ListResourceSubscription>> {
        if (requestParameters.organizationName === null || requestParameters.organizationName === undefined) {
            throw new runtime.RequiredError('organizationName','Required parameter requestParameters.organizationName was null or undefined when calling searchSubscriptions.');
        }

        if (requestParameters.platform === null || requestParameters.platform === undefined) {
            throw new runtime.RequiredError('platform','Required parameter requestParameters.platform was null or undefined when calling searchSubscriptions.');
        }

        const queryParameters: any = {};

        if (requestParameters.organizationName !== undefined) {
            queryParameters['organization_name'] = requestParameters.organizationName;
        }

        if (requestParameters.repositoryName !== undefined) {
            queryParameters['repository_name'] = requestParameters.repositoryName;
        }

        if (requestParameters.directOrganization !== undefined) {
            queryParameters['direct_organization'] = requestParameters.directOrganization;
        }

        if (requestParameters.type !== undefined) {
            queryParameters['type'] = requestParameters.type;
        }

        if (requestParameters.subscriptionTierId !== undefined) {
            queryParameters['subscription_tier_id'] = requestParameters.subscriptionTierId;
        }

        if (requestParameters.platform !== undefined) {
            queryParameters['platform'] = requestParameters.platform;
        }

        if (requestParameters.page !== undefined) {
            queryParameters['page'] = requestParameters.page;
        }

        if (requestParameters.limit !== undefined) {
            queryParameters['limit'] = requestParameters.limit;
        }

        if (requestParameters.sorting) {
            queryParameters['sorting'] = requestParameters.sorting;
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
            path: `/api/v1/subscriptions/subscriptions/search`,
            method: 'GET',
            headers: headerParameters,
            query: queryParameters,
        }, initOverrides);

        return new runtime.JSONApiResponse(response);
    }

    /**
     * Search Subscriptions
     */
    async searchSubscriptions(requestParameters: SubscriptionsApiSearchSubscriptionsRequest, initOverrides?: RequestInit | runtime.InitOverrideFunction): Promise<ListResourceSubscription> {
        const response = await this.searchSubscriptionsRaw(requestParameters, initOverrides);
        return await response.value();
    }

    /**
     * Update Subscription Benefit
     */
    async updateSubscriptionBenefitRaw(requestParameters: SubscriptionsApiUpdateSubscriptionBenefitRequest, initOverrides?: RequestInit | runtime.InitOverrideFunction): Promise<runtime.ApiResponse<ResponseSubscriptionsUpdateSubscriptionBenefit>> {
        if (requestParameters.id === null || requestParameters.id === undefined) {
            throw new runtime.RequiredError('id','Required parameter requestParameters.id was null or undefined when calling updateSubscriptionBenefit.');
        }

        if (requestParameters.subscriptionBenefitUpdate === null || requestParameters.subscriptionBenefitUpdate === undefined) {
            throw new runtime.RequiredError('subscriptionBenefitUpdate','Required parameter requestParameters.subscriptionBenefitUpdate was null or undefined when calling updateSubscriptionBenefit.');
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
            path: `/api/v1/subscriptions/benefits/{id}`.replace(`{${"id"}}`, encodeURIComponent(String(requestParameters.id))),
            method: 'POST',
            headers: headerParameters,
            query: queryParameters,
            body: requestParameters.subscriptionBenefitUpdate,
        }, initOverrides);

        return new runtime.JSONApiResponse(response);
    }

    /**
     * Update Subscription Benefit
     */
    async updateSubscriptionBenefit(requestParameters: SubscriptionsApiUpdateSubscriptionBenefitRequest, initOverrides?: RequestInit | runtime.InitOverrideFunction): Promise<ResponseSubscriptionsUpdateSubscriptionBenefit> {
        const response = await this.updateSubscriptionBenefitRaw(requestParameters, initOverrides);
        return await response.value();
    }

    /**
     * Update Subscription Tier
     */
    async updateSubscriptionTierRaw(requestParameters: SubscriptionsApiUpdateSubscriptionTierRequest, initOverrides?: RequestInit | runtime.InitOverrideFunction): Promise<runtime.ApiResponse<SubscriptionTier>> {
        if (requestParameters.id === null || requestParameters.id === undefined) {
            throw new runtime.RequiredError('id','Required parameter requestParameters.id was null or undefined when calling updateSubscriptionTier.');
        }

        if (requestParameters.subscriptionTierUpdate === null || requestParameters.subscriptionTierUpdate === undefined) {
            throw new runtime.RequiredError('subscriptionTierUpdate','Required parameter requestParameters.subscriptionTierUpdate was null or undefined when calling updateSubscriptionTier.');
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
            path: `/api/v1/subscriptions/tiers/{id}`.replace(`{${"id"}}`, encodeURIComponent(String(requestParameters.id))),
            method: 'POST',
            headers: headerParameters,
            query: queryParameters,
            body: requestParameters.subscriptionTierUpdate,
        }, initOverrides);

        return new runtime.JSONApiResponse(response);
    }

    /**
     * Update Subscription Tier
     */
    async updateSubscriptionTier(requestParameters: SubscriptionsApiUpdateSubscriptionTierRequest, initOverrides?: RequestInit | runtime.InitOverrideFunction): Promise<SubscriptionTier> {
        const response = await this.updateSubscriptionTierRaw(requestParameters, initOverrides);
        return await response.value();
    }

    /**
     * Update Subscription Tier Benefits
     */
    async updateSubscriptionTierBenefitsRaw(requestParameters: SubscriptionsApiUpdateSubscriptionTierBenefitsRequest, initOverrides?: RequestInit | runtime.InitOverrideFunction): Promise<runtime.ApiResponse<SubscriptionTier>> {
        if (requestParameters.id === null || requestParameters.id === undefined) {
            throw new runtime.RequiredError('id','Required parameter requestParameters.id was null or undefined when calling updateSubscriptionTierBenefits.');
        }

        if (requestParameters.subscriptionTierBenefitsUpdate === null || requestParameters.subscriptionTierBenefitsUpdate === undefined) {
            throw new runtime.RequiredError('subscriptionTierBenefitsUpdate','Required parameter requestParameters.subscriptionTierBenefitsUpdate was null or undefined when calling updateSubscriptionTierBenefits.');
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
            path: `/api/v1/subscriptions/tiers/{id}/benefits`.replace(`{${"id"}}`, encodeURIComponent(String(requestParameters.id))),
            method: 'POST',
            headers: headerParameters,
            query: queryParameters,
            body: requestParameters.subscriptionTierBenefitsUpdate,
        }, initOverrides);

        return new runtime.JSONApiResponse(response);
    }

    /**
     * Update Subscription Tier Benefits
     */
    async updateSubscriptionTierBenefits(requestParameters: SubscriptionsApiUpdateSubscriptionTierBenefitsRequest, initOverrides?: RequestInit | runtime.InitOverrideFunction): Promise<SubscriptionTier> {
        const response = await this.updateSubscriptionTierBenefitsRaw(requestParameters, initOverrides);
        return await response.value();
    }

}
