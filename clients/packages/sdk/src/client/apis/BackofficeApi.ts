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
  BackofficeBadge,
  BackofficeBadgeResponse,
  BackofficePledge,
  BackofficeReward,
  HTTPValidationError,
  Issue,
  ListResourceBackofficeReward,
  PledgeRewardTransfer,
} from '../models/index';

export interface BackofficeApiIssueRequest {
    id: string;
}

export interface BackofficeApiManageBadgeRequest {
    body: BackofficeBadge;
}

export interface BackofficeApiPledgeCreateInvoiceRequest {
    pledgeId: string;
}

export interface BackofficeApiPledgeMarkDisputedRequest {
    pledgeId: string;
}

export interface BackofficeApiPledgeRewardTransferRequest {
    body: PledgeRewardTransfer;
}

export interface BackofficeApiRewardsRequest {
    issueId?: string;
}

export interface BackofficeApiUpdateBadgeContentsRequest {
    orgSlug: string;
    repoSlug: string;
}

/**
 * 
 */
export class BackofficeApi extends runtime.BaseAPI {

    /**
     * Issue
     */
    async issueRaw(requestParameters: BackofficeApiIssueRequest, initOverrides?: RequestInit | runtime.InitOverrideFunction): Promise<runtime.ApiResponse<Issue>> {
        if (requestParameters['id'] == null) {
            throw new runtime.RequiredError(
                'id',
                'Required parameter "id" was null or undefined when calling issue().'
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
        const response = await this.request({
            path: `/v1/backoffice/issue/{id}`.replace(`{${"id"}}`, encodeURIComponent(String(requestParameters['id']))),
            method: 'GET',
            headers: headerParameters,
            query: queryParameters,
        }, initOverrides);

        return new runtime.JSONApiResponse(response);
    }

    /**
     * Issue
     */
    async issue(requestParameters: BackofficeApiIssueRequest, initOverrides?: RequestInit | runtime.InitOverrideFunction): Promise<Issue> {
        const response = await this.issueRaw(requestParameters, initOverrides);
        return await response.value();
    }

    /**
     * Manage Badge
     */
    async manageBadgeRaw(requestParameters: BackofficeApiManageBadgeRequest, initOverrides?: RequestInit | runtime.InitOverrideFunction): Promise<runtime.ApiResponse<BackofficeBadgeResponse>> {
        if (requestParameters['body'] == null) {
            throw new runtime.RequiredError(
                'body',
                'Required parameter "body" was null or undefined when calling manageBadge().'
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
            path: `/v1/backoffice/badge`,
            method: 'POST',
            headers: headerParameters,
            query: queryParameters,
            body: requestParameters['body'],
        }, initOverrides);

        return new runtime.JSONApiResponse(response);
    }

    /**
     * Manage Badge
     */
    async manageBadge(requestParameters: BackofficeApiManageBadgeRequest, initOverrides?: RequestInit | runtime.InitOverrideFunction): Promise<BackofficeBadgeResponse> {
        const response = await this.manageBadgeRaw(requestParameters, initOverrides);
        return await response.value();
    }

    /**
     * Pledge Create Invoice
     */
    async pledgeCreateInvoiceRaw(requestParameters: BackofficeApiPledgeCreateInvoiceRequest, initOverrides?: RequestInit | runtime.InitOverrideFunction): Promise<runtime.ApiResponse<BackofficePledge>> {
        if (requestParameters['pledgeId'] == null) {
            throw new runtime.RequiredError(
                'pledgeId',
                'Required parameter "pledgeId" was null or undefined when calling pledgeCreateInvoice().'
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
        const response = await this.request({
            path: `/v1/backoffice/pledges/create_invoice/{pledge_id}`.replace(`{${"pledge_id"}}`, encodeURIComponent(String(requestParameters['pledgeId']))),
            method: 'POST',
            headers: headerParameters,
            query: queryParameters,
        }, initOverrides);

        return new runtime.JSONApiResponse(response);
    }

    /**
     * Pledge Create Invoice
     */
    async pledgeCreateInvoice(requestParameters: BackofficeApiPledgeCreateInvoiceRequest, initOverrides?: RequestInit | runtime.InitOverrideFunction): Promise<BackofficePledge> {
        const response = await this.pledgeCreateInvoiceRaw(requestParameters, initOverrides);
        return await response.value();
    }

    /**
     * Pledge Mark Disputed
     */
    async pledgeMarkDisputedRaw(requestParameters: BackofficeApiPledgeMarkDisputedRequest, initOverrides?: RequestInit | runtime.InitOverrideFunction): Promise<runtime.ApiResponse<BackofficePledge>> {
        if (requestParameters['pledgeId'] == null) {
            throw new runtime.RequiredError(
                'pledgeId',
                'Required parameter "pledgeId" was null or undefined when calling pledgeMarkDisputed().'
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
        const response = await this.request({
            path: `/v1/backoffice/pledges/mark_disputed/{pledge_id}`.replace(`{${"pledge_id"}}`, encodeURIComponent(String(requestParameters['pledgeId']))),
            method: 'POST',
            headers: headerParameters,
            query: queryParameters,
        }, initOverrides);

        return new runtime.JSONApiResponse(response);
    }

    /**
     * Pledge Mark Disputed
     */
    async pledgeMarkDisputed(requestParameters: BackofficeApiPledgeMarkDisputedRequest, initOverrides?: RequestInit | runtime.InitOverrideFunction): Promise<BackofficePledge> {
        const response = await this.pledgeMarkDisputedRaw(requestParameters, initOverrides);
        return await response.value();
    }

    /**
     * Pledge Reward Transfer
     */
    async pledgeRewardTransferRaw(requestParameters: BackofficeApiPledgeRewardTransferRequest, initOverrides?: RequestInit | runtime.InitOverrideFunction): Promise<runtime.ApiResponse<BackofficeReward>> {
        if (requestParameters['body'] == null) {
            throw new runtime.RequiredError(
                'body',
                'Required parameter "body" was null or undefined when calling pledgeRewardTransfer().'
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
            path: `/v1/backoffice/pledges/approve`,
            method: 'POST',
            headers: headerParameters,
            query: queryParameters,
            body: requestParameters['body'],
        }, initOverrides);

        return new runtime.JSONApiResponse(response);
    }

    /**
     * Pledge Reward Transfer
     */
    async pledgeRewardTransfer(requestParameters: BackofficeApiPledgeRewardTransferRequest, initOverrides?: RequestInit | runtime.InitOverrideFunction): Promise<BackofficeReward> {
        const response = await this.pledgeRewardTransferRaw(requestParameters, initOverrides);
        return await response.value();
    }

    /**
     * Pledges
     */
    async pledgesRaw(initOverrides?: RequestInit | runtime.InitOverrideFunction): Promise<runtime.ApiResponse<Array<BackofficePledge>>> {
        const queryParameters: any = {};

        const headerParameters: runtime.HTTPHeaders = {};

        if (this.configuration && this.configuration.accessToken) {
            const token = this.configuration.accessToken;
            const tokenString = await token("pat", []);

            if (tokenString) {
                headerParameters["Authorization"] = `Bearer ${tokenString}`;
            }
        }
        const response = await this.request({
            path: `/v1/backoffice/pledges`,
            method: 'GET',
            headers: headerParameters,
            query: queryParameters,
        }, initOverrides);

        return new runtime.JSONApiResponse(response);
    }

    /**
     * Pledges
     */
    async pledges(initOverrides?: RequestInit | runtime.InitOverrideFunction): Promise<Array<BackofficePledge>> {
        const response = await this.pledgesRaw(initOverrides);
        return await response.value();
    }

    /**
     * Rewards
     */
    async rewardsRaw(requestParameters: BackofficeApiRewardsRequest, initOverrides?: RequestInit | runtime.InitOverrideFunction): Promise<runtime.ApiResponse<ListResourceBackofficeReward>> {
        const queryParameters: any = {};

        if (requestParameters['issueId'] != null) {
            queryParameters['issue_id'] = requestParameters['issueId'];
        }

        const headerParameters: runtime.HTTPHeaders = {};

        if (this.configuration && this.configuration.accessToken) {
            const token = this.configuration.accessToken;
            const tokenString = await token("pat", []);

            if (tokenString) {
                headerParameters["Authorization"] = `Bearer ${tokenString}`;
            }
        }
        const response = await this.request({
            path: `/v1/backoffice/rewards/by_issue`,
            method: 'GET',
            headers: headerParameters,
            query: queryParameters,
        }, initOverrides);

        return new runtime.JSONApiResponse(response);
    }

    /**
     * Rewards
     */
    async rewards(requestParameters: BackofficeApiRewardsRequest = {}, initOverrides?: RequestInit | runtime.InitOverrideFunction): Promise<ListResourceBackofficeReward> {
        const response = await this.rewardsRaw(requestParameters, initOverrides);
        return await response.value();
    }

    /**
     * Rewards Pending
     */
    async rewardsPendingRaw(initOverrides?: RequestInit | runtime.InitOverrideFunction): Promise<runtime.ApiResponse<ListResourceBackofficeReward>> {
        const queryParameters: any = {};

        const headerParameters: runtime.HTTPHeaders = {};

        if (this.configuration && this.configuration.accessToken) {
            const token = this.configuration.accessToken;
            const tokenString = await token("pat", []);

            if (tokenString) {
                headerParameters["Authorization"] = `Bearer ${tokenString}`;
            }
        }
        const response = await this.request({
            path: `/v1/backoffice/rewards/pending`,
            method: 'GET',
            headers: headerParameters,
            query: queryParameters,
        }, initOverrides);

        return new runtime.JSONApiResponse(response);
    }

    /**
     * Rewards Pending
     */
    async rewardsPending(initOverrides?: RequestInit | runtime.InitOverrideFunction): Promise<ListResourceBackofficeReward> {
        const response = await this.rewardsPendingRaw(initOverrides);
        return await response.value();
    }

    /**
     * Update Badge Contents
     */
    async updateBadgeContentsRaw(requestParameters: BackofficeApiUpdateBadgeContentsRequest, initOverrides?: RequestInit | runtime.InitOverrideFunction): Promise<runtime.ApiResponse<object>> {
        if (requestParameters['orgSlug'] == null) {
            throw new runtime.RequiredError(
                'orgSlug',
                'Required parameter "orgSlug" was null or undefined when calling updateBadgeContents().'
            );
        }

        if (requestParameters['repoSlug'] == null) {
            throw new runtime.RequiredError(
                'repoSlug',
                'Required parameter "repoSlug" was null or undefined when calling updateBadgeContents().'
            );
        }

        const queryParameters: any = {};

        if (requestParameters['orgSlug'] != null) {
            queryParameters['org_slug'] = requestParameters['orgSlug'];
        }

        if (requestParameters['repoSlug'] != null) {
            queryParameters['repo_slug'] = requestParameters['repoSlug'];
        }

        const headerParameters: runtime.HTTPHeaders = {};

        if (this.configuration && this.configuration.accessToken) {
            const token = this.configuration.accessToken;
            const tokenString = await token("pat", []);

            if (tokenString) {
                headerParameters["Authorization"] = `Bearer ${tokenString}`;
            }
        }
        const response = await this.request({
            path: `/v1/backoffice/update_badge_contents`,
            method: 'POST',
            headers: headerParameters,
            query: queryParameters,
        }, initOverrides);

        return new runtime.JSONApiResponse<any>(response);
    }

    /**
     * Update Badge Contents
     */
    async updateBadgeContents(requestParameters: BackofficeApiUpdateBadgeContentsRequest, initOverrides?: RequestInit | runtime.InitOverrideFunction): Promise<object> {
        const response = await this.updateBadgeContentsRaw(requestParameters, initOverrides);
        return await response.value();
    }

}
