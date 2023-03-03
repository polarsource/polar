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
   * Create Rewawrd
   * @returns RewardRead Successful Response
   * @throws ApiError
   */
  public createRewawrd({
    requestBody,
  }: {
    requestBody: RewardCreate,
  }): CancelablePromise<RewardRead> {
    return this.httpRequest.request({
      method: 'POST',
      url: '/api/v1/rewards',
      body: requestBody,
      mediaType: 'application/json',
      errors: {
        422: `Validation Error`,
      },
    });
  }

  /**
   * Get Repository Rewards
   * @returns RewardRead Successful Response
   * @throws ApiError
   */
  public getRepositoryRewards({
    platform,
    organizationName,
    name,
  }: {
    platform: Platforms,
    organizationName: string,
    name: string,
  }): CancelablePromise<Array<RewardRead>> {
    return this.httpRequest.request({
      method: 'GET',
      url: '/api/v1/rewards/{platform}/{organization_name}/{name}',
      path: {
        'platform': platform,
        'organization_name': organizationName,
        'name': name,
      },
      errors: {
        422: `Validation Error`,
      },
    });
  }

}
