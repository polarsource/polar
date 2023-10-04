/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { ListResource_PullRequest_ } from '../models/ListResource_PullRequest_';

import type { CancelablePromise } from '../core/CancelablePromise';
import type { BaseHttpRequest } from '../core/BaseHttpRequest';

export class PullRequestsService {

  constructor(public readonly httpRequest: BaseHttpRequest) {}

  /**
   * Search pull requests (Public API)
   * Search pull requests.
   * @returns ListResource_PullRequest_ Successful Response
   * @throws ApiError
   */
  public search({
    referencesIssueId,
  }: {
    /**
     * Search pull requests that are mentioning this issue
     */
    referencesIssueId?: string,
  }): CancelablePromise<ListResource_PullRequest_> {
    return this.httpRequest.request({
      method: 'GET',
      url: '/api/v1/pull_requests/search',
      query: {
        'references_issue_id': referencesIssueId,
      },
      errors: {
        404: `Not Found`,
        422: `Validation Error`,
      },
    });
  }

}
