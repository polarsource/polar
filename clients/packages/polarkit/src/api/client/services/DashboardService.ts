/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { IssueListResponse } from '../models/IssueListResponse';
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
    organizationName,
    repositoryName,
    status,
    q,
  }: {
    platform: Platforms,
    organizationName: string,
    repositoryName: string,
    status?: Array<IssueStatus>,
    q?: string,
  }): CancelablePromise<IssueListResponse> {
    return this.httpRequest.request({
      method: 'GET',
      url: '/api/v1/dashboard/{platform}/{organization_name}/{repository_name}',
      path: {
        'platform': platform,
        'organization_name': organizationName,
        'repository_name': repositoryName,
      },
      query: {
        'status': status,
        'q': q,
      },
      errors: {
        422: `Validation Error`,
      },
    });
  }

}
