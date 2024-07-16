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
  HTTPValidationError,
  ListResourceTrafficReferrer,
  TrackPageView,
  TrackPageViewResponse,
  TrafficStatistics,
} from '../models/index';

export interface TrafficApiReferrersRequest {
    organizationId: string;
    startDate: string;
    endDate: string;
    page?: number;
    limit?: number;
}

export interface TrafficApiStatisticsRequest {
    startDate: string;
    endDate: string;
    trafficInterval: StatisticsTrafficIntervalEnum;
    organizationId?: string;
    articleId?: string;
    groupByArticle?: boolean;
}

export interface TrafficApiTrackPageViewRequest {
    body: TrackPageView;
}

/**
 * 
 */
export class TrafficApi extends runtime.BaseAPI {

    /**
     * Referrers
     */
    async referrersRaw(requestParameters: TrafficApiReferrersRequest, initOverrides?: RequestInit | runtime.InitOverrideFunction): Promise<runtime.ApiResponse<ListResourceTrafficReferrer>> {
        if (requestParameters['organizationId'] == null) {
            throw new runtime.RequiredError(
                'organizationId',
                'Required parameter "organizationId" was null or undefined when calling referrers().'
            );
        }

        if (requestParameters['startDate'] == null) {
            throw new runtime.RequiredError(
                'startDate',
                'Required parameter "startDate" was null or undefined when calling referrers().'
            );
        }

        if (requestParameters['endDate'] == null) {
            throw new runtime.RequiredError(
                'endDate',
                'Required parameter "endDate" was null or undefined when calling referrers().'
            );
        }

        const queryParameters: any = {};

        if (requestParameters['organizationId'] != null) {
            queryParameters['organization_id'] = requestParameters['organizationId'];
        }

        if (requestParameters['startDate'] != null) {
            queryParameters['start_date'] = requestParameters['startDate'];
        }

        if (requestParameters['endDate'] != null) {
            queryParameters['end_date'] = requestParameters['endDate'];
        }

        if (requestParameters['page'] != null) {
            queryParameters['page'] = requestParameters['page'];
        }

        if (requestParameters['limit'] != null) {
            queryParameters['limit'] = requestParameters['limit'];
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
            path: `/v1/traffic/referrers`,
            method: 'GET',
            headers: headerParameters,
            query: queryParameters,
        }, initOverrides);

        return new runtime.JSONApiResponse(response);
    }

    /**
     * Referrers
     */
    async referrers(requestParameters: TrafficApiReferrersRequest, initOverrides?: RequestInit | runtime.InitOverrideFunction): Promise<ListResourceTrafficReferrer> {
        const response = await this.referrersRaw(requestParameters, initOverrides);
        return await response.value();
    }

    /**
     * Statistics
     */
    async statisticsRaw(requestParameters: TrafficApiStatisticsRequest, initOverrides?: RequestInit | runtime.InitOverrideFunction): Promise<runtime.ApiResponse<TrafficStatistics>> {
        if (requestParameters['startDate'] == null) {
            throw new runtime.RequiredError(
                'startDate',
                'Required parameter "startDate" was null or undefined when calling statistics().'
            );
        }

        if (requestParameters['endDate'] == null) {
            throw new runtime.RequiredError(
                'endDate',
                'Required parameter "endDate" was null or undefined when calling statistics().'
            );
        }

        if (requestParameters['trafficInterval'] == null) {
            throw new runtime.RequiredError(
                'trafficInterval',
                'Required parameter "trafficInterval" was null or undefined when calling statistics().'
            );
        }

        const queryParameters: any = {};

        if (requestParameters['organizationId'] != null) {
            queryParameters['organization_id'] = requestParameters['organizationId'];
        }

        if (requestParameters['articleId'] != null) {
            queryParameters['article_id'] = requestParameters['articleId'];
        }

        if (requestParameters['startDate'] != null) {
            queryParameters['start_date'] = requestParameters['startDate'];
        }

        if (requestParameters['endDate'] != null) {
            queryParameters['end_date'] = requestParameters['endDate'];
        }

        if (requestParameters['trafficInterval'] != null) {
            queryParameters['trafficInterval'] = requestParameters['trafficInterval'];
        }

        if (requestParameters['groupByArticle'] != null) {
            queryParameters['group_by_article'] = requestParameters['groupByArticle'];
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
            path: `/v1/traffic/statistics`,
            method: 'GET',
            headers: headerParameters,
            query: queryParameters,
        }, initOverrides);

        return new runtime.JSONApiResponse(response);
    }

    /**
     * Statistics
     */
    async statistics(requestParameters: TrafficApiStatisticsRequest, initOverrides?: RequestInit | runtime.InitOverrideFunction): Promise<TrafficStatistics> {
        const response = await this.statisticsRaw(requestParameters, initOverrides);
        return await response.value();
    }

    /**
     * Track Page View
     */
    async trackPageViewRaw(requestParameters: TrafficApiTrackPageViewRequest, initOverrides?: RequestInit | runtime.InitOverrideFunction): Promise<runtime.ApiResponse<TrackPageViewResponse>> {
        if (requestParameters['body'] == null) {
            throw new runtime.RequiredError(
                'body',
                'Required parameter "body" was null or undefined when calling trackPageView().'
            );
        }

        const queryParameters: any = {};

        const headerParameters: runtime.HTTPHeaders = {};

        headerParameters['Content-Type'] = 'application/json';

        const response = await this.request({
            path: `/v1/traffic/track_page_view`,
            method: 'POST',
            headers: headerParameters,
            query: queryParameters,
            body: requestParameters['body'],
        }, initOverrides);

        return new runtime.JSONApiResponse(response);
    }

    /**
     * Track Page View
     */
    async trackPageView(requestParameters: TrafficApiTrackPageViewRequest, initOverrides?: RequestInit | runtime.InitOverrideFunction): Promise<TrackPageViewResponse> {
        const response = await this.trackPageViewRaw(requestParameters, initOverrides);
        return await response.value();
    }

}

/**
 * @export
 */
export const StatisticsTrafficIntervalEnum = {
    MONTH: 'month',
    WEEK: 'week',
    DAY: 'day'
} as const;
export type StatisticsTrafficIntervalEnum = typeof StatisticsTrafficIntervalEnum[keyof typeof StatisticsTrafficIntervalEnum];
