/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { ExternalGitHubIssueCreate } from '../models/ExternalGitHubIssueCreate';
import type { GitHubIssue } from '../models/GitHubIssue';
import type { IssueRead } from '../models/IssueRead';
import type { IssueReferenceRead } from '../models/IssueReferenceRead';
import type { Platforms } from '../models/Platforms';

import type { CancelablePromise } from '../core/CancelablePromise';
import type { BaseHttpRequest } from '../core/BaseHttpRequest';

export class IssuesService {

  constructor(public readonly httpRequest: BaseHttpRequest) {}

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
   * @returns IssueRead Successful Response
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
  }): CancelablePromise<IssueRead> {
    return this.httpRequest.request({
      method: 'GET',
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
   * @returns IssueRead Successful Response
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
  }): CancelablePromise<IssueRead> {
    return this.httpRequest.request({
      method: 'GET',
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
   * Get Public Issue
   * @returns IssueRead Successful Response
   * @throws ApiError
   */
  public getPublicIssue({
    platform,
    orgName,
    repoName,
    number,
  }: {
    platform: Platforms,
    orgName: string,
    repoName: string,
    number: number,
  }): CancelablePromise<IssueRead> {
    return this.httpRequest.request({
      method: 'GET',
      url: '/api/v1/{platform}/{org_name}/{repo_name}/issues/{number}',
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
   * Sync External Issue
   * @returns GitHubIssue Successful Response
   * @throws ApiError
   */
  public syncExternalIssue({
    platform,
    requestBody,
  }: {
    platform: Platforms,
    requestBody: ExternalGitHubIssueCreate,
  }): CancelablePromise<GitHubIssue> {
    return this.httpRequest.request({
      method: 'POST',
      url: '/api/v1/{platform}/external_issues',
      path: {
        'platform': platform,
      },
      body: requestBody,
      mediaType: 'application/json',
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

}
