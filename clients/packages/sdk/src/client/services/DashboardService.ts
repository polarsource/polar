/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { IssueListResponse } from '../models/IssueListResponse';
import type { IssueListType } from '../models/IssueListType';
import type { IssueSortBy } from '../models/IssueSortBy';
import type { IssueStatus } from '../models/IssueStatus';
import type { Platforms } from '../models/Platforms';
import type { PledgesTypeSummaries } from '../models/PledgesTypeSummaries';

import type { CancelablePromise } from '../core/CancelablePromise';
import type { BaseHttpRequest } from '../core/BaseHttpRequest';

export class DashboardService {

  constructor(public readonly httpRequest: BaseHttpRequest) {}

  /**
   * Get Personal Dashboard
   * @returns IssueListResponse Successful Response
   * @throws ApiError
   */
  public getPersonalDashboard({
    issueListType,
    status,
    q,
    sort,
    onlyPledged = false,
    onlyBadged = false,
    page = 1,
  }: {
    issueListType?: IssueListType,
    status?: Array<IssueStatus>,
    q?: string,
    sort?: IssueSortBy,
    onlyPledged?: boolean,
    onlyBadged?: boolean,
    page?: number,
  }): CancelablePromise<IssueListResponse> {
    return this.httpRequest.request({
      method: 'GET',
      url: '/api/v1/dashboard/personal',
      query: {
        'issue_list_type': issueListType,
        'status': status,
        'q': q,
        'sort': sort,
        'only_pledged': onlyPledged,
        'only_badged': onlyBadged,
        'page': page,
      },
      errors: {
        422: `Validation Error`,
      },
    });
  }

  /**
   * Get Dashboard
   * @returns IssueListResponse Successful Response
   * @throws ApiError
   */
  public getDashboard({
    platform,
    orgName,
    repoName,
    issueListType,
    status,
    q,
    sort,
    onlyPledged = false,
    onlyBadged = false,
    page = 1,
  }: {
    platform: Platforms,
    orgName: string,
    repoName?: string,
    issueListType?: IssueListType,
    status?: Array<IssueStatus>,
    q?: string,
    sort?: IssueSortBy,
    onlyPledged?: boolean,
    onlyBadged?: boolean,
    page?: number,
  }): CancelablePromise<IssueListResponse> {
    return this.httpRequest.request({
      method: 'GET',
      url: '/api/v1/dashboard/{platform}/{org_name}',
      path: {
        'platform': platform,
        'org_name': orgName,
      },
      query: {
        'repo_name': repoName,
        'issue_list_type': issueListType,
        'status': status,
        'q': q,
        'sort': sort,
        'only_pledged': onlyPledged,
        'only_badged': onlyBadged,
        'page': page,
      },
      errors: {
        422: `Validation Error`,
      },
    });
  }

  /**
   * Dummy Do Not Use
   * @returns PledgesTypeSummaries Successful Response
   * @throws ApiError
   */
  public dummyDoNotUse(): CancelablePromise<PledgesTypeSummaries> {
    return this.httpRequest.request({
      method: 'GET',
      url: '/api/v1/dashboard/dummy_do_not_use',
    });
  }

}
