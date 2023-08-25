/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { BackofficeBadge } from '../models/BackofficeBadge';
import type { BackofficeBadgeResponse } from '../models/BackofficeBadgeResponse';
import type { BackofficePledge } from '../models/BackofficePledge';
import type { BackofficeReward } from '../models/BackofficeReward';
import type { Issue } from '../models/Issue';
import type { ListResource_BackofficeReward_ } from '../models/ListResource_BackofficeReward_';
import type { OrganizationPrivateRead } from '../models/OrganizationPrivateRead';
import type { PledgeRewardTransfer } from '../models/PledgeRewardTransfer';

import type { CancelablePromise } from '../core/CancelablePromise';
import type { BaseHttpRequest } from '../core/BaseHttpRequest';

export class BackofficeService {

  constructor(public readonly httpRequest: BaseHttpRequest) {}

  /**
   * Pledges
   * @returns BackofficePledge Successful Response
   * @throws ApiError
   */
  public pledges(): CancelablePromise<Array<BackofficePledge>> {
    return this.httpRequest.request({
      method: 'GET',
      url: '/api/v1/backoffice/pledges',
    });
  }

  /**
   * Rewards
   * @returns ListResource_BackofficeReward_ Successful Response
   * @throws ApiError
   */
  public rewards({
    issueId,
  }: {
    issueId?: string,
  }): CancelablePromise<ListResource_BackofficeReward_> {
    return this.httpRequest.request({
      method: 'GET',
      url: '/api/v1/backoffice/rewards/by_issue',
      query: {
        'issue_id': issueId,
      },
      errors: {
        422: `Validation Error`,
      },
    });
  }

  /**
   * Rewards Pending
   * @returns ListResource_BackofficeReward_ Successful Response
   * @throws ApiError
   */
  public rewardsPending(): CancelablePromise<ListResource_BackofficeReward_> {
    return this.httpRequest.request({
      method: 'GET',
      url: '/api/v1/backoffice/rewards/pending',
    });
  }

  /**
   * Issue
   * @returns Issue Successful Response
   * @throws ApiError
   */
  public issue({
    id,
  }: {
    id: string,
  }): CancelablePromise<Issue> {
    return this.httpRequest.request({
      method: 'GET',
      url: '/api/v1/backoffice/issue/{id}',
      path: {
        'id': id,
      },
      errors: {
        422: `Validation Error`,
      },
    });
  }

  /**
   * Pledge Reward Transfer
   * @returns BackofficeReward Successful Response
   * @throws ApiError
   */
  public pledgeRewardTransfer({
    requestBody,
  }: {
    requestBody: PledgeRewardTransfer,
  }): CancelablePromise<BackofficeReward> {
    return this.httpRequest.request({
      method: 'POST',
      url: '/api/v1/backoffice/pledges/approve',
      body: requestBody,
      mediaType: 'application/json',
      errors: {
        422: `Validation Error`,
      },
    });
  }

  /**
   * Pledge Mark Pending
   * @returns BackofficePledge Successful Response
   * @throws ApiError
   */
  public pledgeMarkPending({
    pledgeId,
  }: {
    pledgeId: string,
  }): CancelablePromise<BackofficePledge> {
    return this.httpRequest.request({
      method: 'POST',
      url: '/api/v1/backoffice/pledges/mark_pending/{pledge_id}',
      path: {
        'pledge_id': pledgeId,
      },
      errors: {
        422: `Validation Error`,
      },
    });
  }

  /**
   * Pledge Mark Disputed
   * @returns BackofficePledge Successful Response
   * @throws ApiError
   */
  public pledgeMarkDisputed({
    pledgeId,
  }: {
    pledgeId: string,
  }): CancelablePromise<BackofficePledge> {
    return this.httpRequest.request({
      method: 'POST',
      url: '/api/v1/backoffice/pledges/mark_disputed/{pledge_id}',
      path: {
        'pledge_id': pledgeId,
      },
      errors: {
        422: `Validation Error`,
      },
    });
  }

  /**
   * Organization Sync
   * @returns OrganizationPrivateRead Successful Response
   * @throws ApiError
   */
  public organizationSync({
    name,
  }: {
    name: string,
  }): CancelablePromise<OrganizationPrivateRead> {
    return this.httpRequest.request({
      method: 'POST',
      url: '/api/v1/backoffice/organization/sync/{name}',
      path: {
        'name': name,
      },
      errors: {
        422: `Validation Error`,
      },
    });
  }

  /**
   * Manage Badge
   * @returns BackofficeBadgeResponse Successful Response
   * @throws ApiError
   */
  public manageBadge({
    requestBody,
  }: {
    requestBody: BackofficeBadge,
  }): CancelablePromise<BackofficeBadgeResponse> {
    return this.httpRequest.request({
      method: 'POST',
      url: '/api/v1/backoffice/badge',
      body: requestBody,
      mediaType: 'application/json',
      errors: {
        422: `Validation Error`,
      },
    });
  }

}
