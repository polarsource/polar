/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { Platforms } from '../models/Platforms';
import type { PullRequestSchema } from '../models/PullRequestSchema';

import type { CancelablePromise } from '../core/CancelablePromise';
import type { BaseHttpRequest } from '../core/BaseHttpRequest';

export class PullRequestsService {

  constructor(public readonly httpRequest: BaseHttpRequest) {}

  /**
   * Get Repository Pull Requests
   * @returns PullRequestSchema Successful Response
   * @throws ApiError
   */
  public getRepositoryPullRequests({
    platform,
    organizationName,
    name,
  }: {
    platform: Platforms,
    organizationName: string,
    name: string,
  }): CancelablePromise<Array<PullRequestSchema>> {
    return this.httpRequest.request({
      method: 'GET',
      url: '/api/v1/pull_requests/{platform}/{organization_name}/{name}',
      path: {
        'platform': platform,
        'organization_name': organizationName,
        'name': name,
      },
      errors: {
        422: `Validation Error`,
      },
    });
  }

}
