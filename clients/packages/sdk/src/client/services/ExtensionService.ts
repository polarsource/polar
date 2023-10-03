/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { IssueExtensionRead } from '../models/IssueExtensionRead';
import type { Platforms } from '../models/Platforms';

import type { CancelablePromise } from '../core/CancelablePromise';
import type { BaseHttpRequest } from '../core/BaseHttpRequest';

export class ExtensionService {

  constructor(public readonly httpRequest: BaseHttpRequest) {}

  /**
   * List Issues For Extension
   * @returns IssueExtensionRead Successful Response
   * @throws ApiError
   */
  public listIssuesForExtension({
    platform,
    orgName,
    repoName,
    numbers,
  }: {
    platform: Platforms,
    orgName: string,
    repoName: string,
    numbers: string,
  }): CancelablePromise<Array<IssueExtensionRead>> {
    return this.httpRequest.request({
      method: 'GET',
      url: '/api/v1/extension/{platform}/{org_name}/{repo_name}/issues',
      path: {
        'platform': platform,
        'org_name': orgName,
        'repo_name': repoName,
      },
      query: {
        'numbers': numbers,
      },
      errors: {
        422: `Validation Error`,
      },
    });
  }

}
