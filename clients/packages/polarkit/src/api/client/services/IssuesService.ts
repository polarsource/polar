/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { Issue } from '../models/Issue';
import type { IssueRead } from '../models/IssueRead';
import type { IssueReferenceRead } from '../models/IssueReferenceRead';
import type { IssueResources } from '../models/IssueResources';
import type { IssueUpdateBadgeMessage } from '../models/IssueUpdateBadgeMessage';
import type { ListResource_Issue_ } from '../models/ListResource_Issue_';
import type { OrganizationPublicPageRead } from '../models/OrganizationPublicPageRead';
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
  }: {
    platform: Platforms,
    organizationName: string,
    repositoryName?: string,
  }): CancelablePromise<ListResource_Issue_> {
    return this.httpRequest.request({
      method: 'GET',
      url: '/api/v1/issues/search',
      query: {
        'platform': platform,
        'organization_name': organizationName,
        'repository_name': repositoryName,
      },
      errors: {
        404: `Not Found`,
        422: `Validation Error`,
      },
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
   * Get Or Sync External
   * @returns IssueResources Successful Response
   * @throws ApiError
   */
  public getOrSyncExternal({
    platform,
    orgName,
    repoName,
    number,
    include = 'organization,repository',
  }: {
    platform: Platforms,
    orgName: string,
    repoName: string,
    number: number,
    include?: string,
  }): CancelablePromise<IssueResources> {
    return this.httpRequest.request({
      method: 'GET',
      url: '/api/v1/{platform}/{org_name}/{repo_name}/issues/{number}',
      path: {
        'platform': platform,
        'org_name': orgName,
        'repo_name': repoName,
        'number': number,
      },
      query: {
        'include': include,
      },
      errors: {
        422: `Validation Error`,
      },
    });
  }

  /**
   * Get Repository Issues
   * @returns IssueRead Successful Response
   * @throws ApiError
   */
  public getRepositoryIssues({
    platform,
    orgName,
    repoName,
  }: {
    platform: Platforms,
    orgName: string,
    repoName: string,
  }): CancelablePromise<Array<IssueRead>> {
    return this.httpRequest.request({
      method: 'GET',
      url: '/api/v1/{platform}/{org_name}/{repo_name}/issues',
      path: {
        'platform': platform,
        'org_name': orgName,
        'repo_name': repoName,
      },
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
    platform,
    orgName,
    repoName,
    issueNumber,
  }: {
    platform: Platforms,
    orgName: string,
    repoName: string,
    issueNumber: number,
  }): CancelablePromise<Issue> {
    return this.httpRequest.request({
      method: 'POST',
      url: '/api/v1/{platform}/{org_name}/{repo_name}/issue/{issue_number}/add_badge',
      path: {
        'platform': platform,
        'org_name': orgName,
        'repo_name': repoName,
        'issue_number': issueNumber,
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
    platform,
    orgName,
    repoName,
    issueNumber,
  }: {
    platform: Platforms,
    orgName: string,
    repoName: string,
    issueNumber: number,
  }): CancelablePromise<Issue> {
    return this.httpRequest.request({
      method: 'POST',
      url: '/api/v1/{platform}/{org_name}/{repo_name}/issue/{issue_number}/remove_badge',
      path: {
        'platform': platform,
        'org_name': orgName,
        'repo_name': repoName,
        'issue_number': issueNumber,
      },
      errors: {
        422: `Validation Error`,
      },
    });
  }

  /**
   * Get Issue References
   * @returns IssueReferenceRead Successful Response
   * @throws ApiError
   */
  public getIssueReferences({
    platform,
    orgName,
    repoName,
    number,
  }: {
    platform: Platforms,
    orgName: string,
    repoName: string,
    number: number,
  }): CancelablePromise<Array<IssueReferenceRead>> {
    return this.httpRequest.request({
      method: 'GET',
      url: '/api/v1/{platform}/{org_name}/{repo_name}/issues/{number}/references',
      path: {
        'platform': platform,
        'org_name': orgName,
        'repo_name': repoName,
        'number': number,
      },
      errors: {
        422: `Validation Error`,
      },
    });
  }

  /**
   * Add Issue Comment
   * @returns IssueRead Successful Response
   * @throws ApiError
   */
  public addIssueComment({
    platform,
    orgName,
    repoName,
    issueNumber,
    requestBody,
  }: {
    platform: Platforms,
    orgName: string,
    repoName: string,
    issueNumber: number,
    requestBody: PostIssueComment,
  }): CancelablePromise<IssueRead> {
    return this.httpRequest.request({
      method: 'POST',
      url: '/api/v1/{platform}/{org_name}/{repo_name}/issue/{issue_number}/comment',
      path: {
        'platform': platform,
        'org_name': orgName,
        'repo_name': repoName,
        'issue_number': issueNumber,
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
   * @returns IssueRead Successful Response
   * @throws ApiError
   */
  public badgeWithMessage({
    platform,
    orgName,
    repoName,
    issueNumber,
    requestBody,
  }: {
    platform: Platforms,
    orgName: string,
    repoName: string,
    issueNumber: number,
    requestBody: IssueUpdateBadgeMessage,
  }): CancelablePromise<IssueRead> {
    return this.httpRequest.request({
      method: 'POST',
      url: '/api/v1/{platform}/{org_name}/{repo_name}/issue/{issue_number}/badge_message',
      path: {
        'platform': platform,
        'org_name': orgName,
        'repo_name': repoName,
        'issue_number': issueNumber,
      },
      body: requestBody,
      mediaType: 'application/json',
      errors: {
        422: `Validation Error`,
      },
    });
  }

  /**
   * Get organization public issues (Internal API)
   * @returns OrganizationPublicPageRead Successful Response
   * @throws ApiError
   */
  public getPublicIssues({
    platform,
    orgName,
    repoName,
  }: {
    platform: Platforms,
    orgName: string,
    repoName?: string,
  }): CancelablePromise<OrganizationPublicPageRead> {
    return this.httpRequest.request({
      method: 'GET',
      url: '/api/v1/{platform}/{org_name}/public',
      path: {
        'platform': platform,
        'org_name': orgName,
      },
      query: {
        'repo_name': repoName,
      },
      errors: {
        422: `Validation Error`,
      },
    });
  }

}
