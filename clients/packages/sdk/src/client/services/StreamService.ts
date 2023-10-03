/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { Platforms } from '../models/Platforms';

import type { CancelablePromise } from '../core/CancelablePromise';
import type { BaseHttpRequest } from '../core/BaseHttpRequest';

export class StreamService {

  constructor(public readonly httpRequest: BaseHttpRequest) {}

  /**
   * User Stream
   * @returns any Successful Response
   * @throws ApiError
   */
  public userStream(): CancelablePromise<any> {
    return this.httpRequest.request({
      method: 'GET',
      url: '/api/v1/user/stream',
    });
  }

  /**
   * User Org Stream
   * @returns any Successful Response
   * @throws ApiError
   */
  public userOrgStream({
    platform,
    orgName,
  }: {
    platform: Platforms,
    orgName: string,
  }): CancelablePromise<any> {
    return this.httpRequest.request({
      method: 'GET',
      url: '/api/v1/{platform}/{org_name}/stream',
      path: {
        'platform': platform,
        'org_name': orgName,
      },
      errors: {
        422: `Validation Error`,
      },
    });
  }

  /**
   * User Org Repo Stream
   * @returns any Successful Response
   * @throws ApiError
   */
  public userOrgRepoStream({
    platform,
    orgName,
    repoName,
  }: {
    platform: Platforms,
    orgName: string,
    repoName: string,
  }): CancelablePromise<any> {
    return this.httpRequest.request({
      method: 'GET',
      url: '/api/v1/{platform}/{org_name}/{repo_name}/stream',
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

}
