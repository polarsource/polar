/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { ConfirmIssue } from '../models/ConfirmIssue';
import type { Issue } from '../models/Issue';
import type { IssueSortBy } from '../models/IssueSortBy';
import type { IssueUpdateBadgeMessage } from '../models/IssueUpdateBadgeMessage';
import type { ListResource_Issue_ } from '../models/ListResource_Issue_';
import type { Platforms } from '../models/Platforms';
import type { PostIssueComment } from '../models/PostIssueComment';
import type { UpdateIssue } from '../models/UpdateIssue';

import type { CancelablePromise } from '../core/CancelablePromise';
import type { BaseHttpRequest } from '../core/BaseHttpRequest';

export class IssuesService {

  constructor(public readonly httpRequest: BaseHttpRequest) {}

  /**
   * Search issues (Public API)
   * Search issues.
   * @returns ListResource_Issue_ Successful Response
   * @throws ApiError
   */
  public search({
    platform,
    organizationName,
    repositoryName,
    sort,
    havePledge,
    haveBadge,
    githubMilestoneNumber,
  }: {
    platform: Platforms,
    organizationName: string,
    repositoryName?: string,
    /**
     * Issue sorting method
     */
    sort?: IssueSortBy,
    /**
     * Set to true to only return issues that have a pledge behind them
     */
    havePledge?: boolean,
    /**
     * Set to true to only return issues that have the Polar badge in the issue description
     */
    haveBadge?: boolean,
    /**
     * Filter to only return issues connected to this GitHub milestone.
     */
    githubMilestoneNumber?: number,
  }): CancelablePromise<ListResource_Issue_> {
    return this.httpRequest.request({
      method: 'GET',
      url: '/api/v1/issues/search',
      query: {
        'platform': platform,
        'organization_name': organizationName,
        'repository_name': repositoryName,
        'sort': sort,
        'have_pledge': havePledge,
        'have_badge': haveBadge,
        'github_milestone_number': githubMilestoneNumber,
      },
      errors: {
        404: `Not Found`,
        422: `Validation Error`,
      },
    });
  }

  /**
   * Lookup
   * @returns Issue Successful Response
   * @throws ApiError
   */
  public lookup({
    externalUrl,
  }: {
    /**
     * URL to issue on external source
     */
    externalUrl?: string,
  }): CancelablePromise<Issue> {
    return this.httpRequest.request({
      method: 'GET',
      url: '/api/v1/issues/lookup',
      query: {
        'external_url': externalUrl,
      },
      errors: {
        422: `Validation Error`,
      },
    });
  }

  /**
   * Get Body
   * @returns any Successful Response
   * @throws ApiError
   */
  public getBody({
    id,
  }: {
    id: string,
  }): CancelablePromise<any> {
    return this.httpRequest.request({
      method: 'GET',
      url: '/api/v1/issues/{id}/body',
      path: {
        'id': id,
      },
      errors: {
        422: `Validation Error`,
      },
    });
  }

  /**
   * For You
   * @returns ListResource_Issue_ Successful Response
   * @throws ApiError
   */
  public forYou(): CancelablePromise<ListResource_Issue_> {
    return this.httpRequest.request({
      method: 'GET',
      url: '/api/v1/issues/for_you',
    });
  }

  /**
   * Get issue (Public API)
   * Get issue
   * @returns Issue Successful Response
   * @throws ApiError
   */
  public get({
    id,
  }: {
    id: string,
  }): CancelablePromise<Issue> {
    return this.httpRequest.request({
      method: 'GET',
      url: '/api/v1/issues/{id}',
      path: {
        'id': id,
      },
      errors: {
        422: `Validation Error`,
      },
    });
  }

  /**
   * Update issue. (Public API)
   * Update issue. Requires authentication.
   * @returns Issue Successful Response
   * @throws ApiError
   */
  public update({
    id,
    requestBody,
  }: {
    id: string,
    requestBody: UpdateIssue,
  }): CancelablePromise<Issue> {
    return this.httpRequest.request({
      method: 'POST',
      url: '/api/v1/issues/{id}',
      path: {
        'id': id,
      },
      body: requestBody,
      mediaType: 'application/json',
      errors: {
        422: `Validation Error`,
      },
    });
  }

  /**
   * Mark an issue as confirmed solved. (Public API)
   * Mark an issue as confirmed solved, and configure issue reward splits. Enables payouts of pledges. Can only be done once per issue. Requires authentication.
   * @returns Issue Successful Response
   * @throws ApiError
   */
  public confirm({
    id,
    requestBody,
  }: {
    id: string,
    requestBody: ConfirmIssue,
  }): CancelablePromise<Issue> {
    return this.httpRequest.request({
      method: 'POST',
      url: '/api/v1/issues/{id}/confirm_solved',
      path: {
        'id': id,
      },
      body: requestBody,
      mediaType: 'application/json',
      errors: {
        422: `Validation Error`,
      },
    });
  }

  /**
   * Add Polar Badge
   * @returns Issue Successful Response
   * @throws ApiError
   */
  public addPolarBadge({
    id,
  }: {
    id: string,
  }): CancelablePromise<Issue> {
    return this.httpRequest.request({
      method: 'POST',
      url: '/api/v1/issues/{id}/add_badge',
      path: {
        'id': id,
      },
      errors: {
        422: `Validation Error`,
      },
    });
  }

  /**
   * Remove Polar Badge
   * @returns Issue Successful Response
   * @throws ApiError
   */
  public removePolarBadge({
    id,
  }: {
    id: string,
  }): CancelablePromise<Issue> {
    return this.httpRequest.request({
      method: 'POST',
      url: '/api/v1/issues/{id}/remove_badge',
      path: {
        'id': id,
      },
      errors: {
        422: `Validation Error`,
      },
    });
  }

  /**
   * Add Issue Comment
   * @returns Issue Successful Response
   * @throws ApiError
   */
  public addIssueComment({
    id,
    requestBody,
  }: {
    id: string,
    requestBody: PostIssueComment,
  }): CancelablePromise<Issue> {
    return this.httpRequest.request({
      method: 'POST',
      url: '/api/v1/issues/{id}/comment',
      path: {
        'id': id,
      },
      body: requestBody,
      mediaType: 'application/json',
      errors: {
        422: `Validation Error`,
      },
    });
  }

  /**
   * Badge With Message
   * @returns Issue Successful Response
   * @throws ApiError
   */
  public badgeWithMessage({
    id,
    requestBody,
  }: {
    id: string,
    requestBody: IssueUpdateBadgeMessage,
  }): CancelablePromise<Issue> {
    return this.httpRequest.request({
      method: 'POST',
      url: '/api/v1/issues/{id}/badge_with_message',
      path: {
        'id': id,
      },
      body: requestBody,
      mediaType: 'application/json',
      errors: {
        422: `Validation Error`,
      },
    });
  }

}
