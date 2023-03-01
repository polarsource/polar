/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { Platforms } from '../models/Platforms';
import type { RewardSchema } from '../models/RewardSchema';

import type { CancelablePromise } from '../core/CancelablePromise';
import type { BaseHttpRequest } from '../core/BaseHttpRequest';

export class RewardsService {

  constructor(public readonly httpRequest: BaseHttpRequest) {}

  /**
   * Get Repository Rewards
   * @returns RewardSchema Successful Response
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
  }): CancelablePromise<Array<RewardSchema>> {
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
