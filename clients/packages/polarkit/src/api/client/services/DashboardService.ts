/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { IssueListResponse } from '../models/IssueListResponse';
import type { IssueSortBy } from '../models/IssueSortBy';
import type { IssueStatus } from '../models/IssueStatus';
import type { Platforms } from '../models/Platforms';

import type { CancelablePromise } from '../core/CancelablePromise';
import type { BaseHttpRequest } from '../core/BaseHttpRequest';

export class DashboardService {

  constructor(public readonly httpRequest: BaseHttpRequest) {}

  /**
   * Get Dashboard
   * @returns IssueListResponse Successful Response
   * @throws ApiError
   */
  public getDashboard({
    platform,
    orgName,
    repoName,
    status,
    q,
    sort,
  }: {
    platform: Platforms,
    orgName: string,
    repoName?: string,
    status?: Array<IssueStatus>,
    q?: string,
    sort?: IssueSortBy,
  }): CancelablePromise<IssueListResponse> {
    return this.httpRequest.request({
      method: 'GET',
      url: '/api/v1/{platform}/{org_name}/dashboard',
      path: {
        'platform': platform,
        'org_name': orgName,
      },
      query: {
        'repo_name': repoName,
        'status': status,
        'q': q,
        'sort': sort,
      },
      errors: {
        422: `Validation Error`,
      },
    });
  }

}
