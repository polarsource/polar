/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { IssueFunding } from '../models/IssueFunding';
import type { ListFundingSortBy } from '../models/ListFundingSortBy';
import type { ListResource_IssueFunding_ } from '../models/ListResource_IssueFunding_';
import type { Platforms } from '../models/Platforms';

import type { CancelablePromise } from '../core/CancelablePromise';
import type { BaseHttpRequest } from '../core/BaseHttpRequest';

export class FundingService {

  constructor(public readonly httpRequest: BaseHttpRequest) {}

  /**
   * List
   * @returns ListResource_IssueFunding_ Successful Response
   * @throws ApiError
   */
  public list({
    organizationName,
    platform,
    repositoryName,
    badged,
    sorting,
    page = 1,
    limit = 10,
  }: {
    /**
     * Filter by organization name.
     */
    organizationName: string,
    platform: Platforms,
    /**
     * Filter by repository name.
     */
    repositoryName?: string,
    badged?: boolean,
    /**
     * Sorting criterion. Several criteria can be used simultaneously and will be applied in order.
     */
    sorting?: Array<ListFundingSortBy>,
    /**
     * Page number, defaults to 1.
     */
    page?: number,
    /**
     * Size of a page, defaults to 10. Maximum is 100
     */
    limit?: number,
  }): CancelablePromise<ListResource_IssueFunding_> {
    return this.httpRequest.request({
      method: 'GET',
      url: '/api/v1/funding/',
      query: {
        'organization_name': organizationName,
        'repository_name': repositoryName,
        'badged': badged,
        'sorting': sorting,
        'platform': platform,
        'page': page,
        'limit': limit,
      },
      errors: {
        422: `Validation Error`,
      },
    });
  }

  /**
   * Lookup
   * @returns IssueFunding Successful Response
   * @throws ApiError
   */
  public lookup({
    issueId,
  }: {
    issueId: string,
  }): CancelablePromise<IssueFunding> {
    return this.httpRequest.request({
      method: 'GET',
      url: '/api/v1/funding/lookup',
      query: {
        'issue_id': issueId,
      },
      errors: {
        422: `Validation Error`,
      },
    });
  }

}
