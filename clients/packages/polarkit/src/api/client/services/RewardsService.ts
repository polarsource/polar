/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { Platforms } from '../models/Platforms';
import type { RewardCreate } from '../models/RewardCreate';
import type { RewardRead } from '../models/RewardRead';

import type { CancelablePromise } from '../core/CancelablePromise';
import type { BaseHttpRequest } from '../core/BaseHttpRequest';

export class RewardsService {

  constructor(public readonly httpRequest: BaseHttpRequest) {}

  /**
   * Get Repository Rewards
   * @returns RewardRead Successful Response
   * @throws ApiError
   */
  public getRepositoryRewards({
    platform,
    orgName,
    repoName,
  }: {
    platform: Platforms,
    orgName: string,
    repoName: string,
  }): CancelablePromise<Array<RewardRead>> {
    return this.httpRequest.request({
      method: 'GET',
      url: '/api/v1/{platform}/{org_name}/{repo_name}/rewards',
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
   * Create Rewawrd
   * @returns RewardRead Successful Response
   * @throws ApiError
   */
  public createRewawrd({
    platform,
    orgName,
    repoName,
    requestBody,
  }: {
    platform: Platforms,
    orgName: string,
    repoName: string,
    requestBody: RewardCreate,
  }): CancelablePromise<RewardRead> {
    return this.httpRequest.request({
      method: 'POST',
      url: '/api/v1/{platform}/{org_name}/{repo_name}/rewards',
      path: {
        'platform': platform,
        'org_name': orgName,
        'repo_name': repoName,
      },
      body: requestBody,
      mediaType: 'application/json',
      errors: {
        422: `Validation Error`,
      },
    });
  }

}
