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
  ListResourceReward,
  RewardsSummary,
} from '../models/index';

export interface RewardsApiSearchRequest {
    pledgesToOrganization?: string;
    rewardsToUser?: string;
    rewardsToOrg?: string;
}

export interface RewardsApiSummaryRequest {
    issueId: string;
}

/**
 * 
 */
export class RewardsApi extends runtime.BaseAPI {

    /**
     * Search rewards.
     * Search rewards (Public API)
     */
    async searchRaw(requestParameters: RewardsApiSearchRequest, initOverrides?: RequestInit | runtime.InitOverrideFunction): Promise<runtime.ApiResponse<ListResourceReward>> {
        const queryParameters: any = {};

        if (requestParameters['pledgesToOrganization'] != null) {
            queryParameters['pledges_to_organization'] = requestParameters['pledgesToOrganization'];
        }

        if (requestParameters['rewardsToUser'] != null) {
            queryParameters['rewards_to_user'] = requestParameters['rewardsToUser'];
        }

        if (requestParameters['rewardsToOrg'] != null) {
            queryParameters['rewards_to_org'] = requestParameters['rewardsToOrg'];
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
            path: `/api/v1/rewards/search`,
            method: 'GET',
            headers: headerParameters,
            query: queryParameters,
        }, initOverrides);

        return new runtime.JSONApiResponse(response);
    }

    /**
     * Search rewards.
     * Search rewards (Public API)
     */
    async search(requestParameters: RewardsApiSearchRequest = {}, initOverrides?: RequestInit | runtime.InitOverrideFunction): Promise<ListResourceReward> {
        const response = await this.searchRaw(requestParameters, initOverrides);
        return await response.value();
    }

    /**
     * Get summary of rewards for resource.
     * Get rewards summary (Public API)
     */
    async summaryRaw(requestParameters: RewardsApiSummaryRequest, initOverrides?: RequestInit | runtime.InitOverrideFunction): Promise<runtime.ApiResponse<RewardsSummary>> {
        if (requestParameters['issueId'] == null) {
            throw new runtime.RequiredError(
                'issueId',
                'Required parameter "issueId" was null or undefined when calling summary().'
            );
        }

        const queryParameters: any = {};

        if (requestParameters['issueId'] != null) {
            queryParameters['issue_id'] = requestParameters['issueId'];
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
            path: `/api/v1/rewards/summary`,
            method: 'GET',
            headers: headerParameters,
            query: queryParameters,
        }, initOverrides);

        return new runtime.JSONApiResponse(response);
    }

    /**
     * Get summary of rewards for resource.
     * Get rewards summary (Public API)
     */
    async summary(requestParameters: RewardsApiSummaryRequest, initOverrides?: RequestInit | runtime.InitOverrideFunction): Promise<RewardsSummary> {
        const response = await this.summaryRaw(requestParameters, initOverrides);
        return await response.value();
    }

}
