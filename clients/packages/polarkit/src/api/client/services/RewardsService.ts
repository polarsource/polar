/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { ListResource_Reward_ } from '../models/ListResource_Reward_';

import type { CancelablePromise } from '../core/CancelablePromise';
import type { BaseHttpRequest } from '../core/BaseHttpRequest';

export class RewardsService {

  constructor(public readonly httpRequest: BaseHttpRequest) {}

  /**
   * Search rewards (Public API)
   * Search rewards.
   * @returns ListResource_Reward_ Successful Response
   * @throws ApiError
   */
  public search({
    pledgesToOrganization,
  }: {
    /**
     * Search rewards for pledges in this organization.
     */
    pledgesToOrganization?: string,
  }): CancelablePromise<ListResource_Reward_> {
    return this.httpRequest.request({
      method: 'GET',
      url: '/api/v1/rewards/search',
      query: {
        'pledges_to_organization': pledgesToOrganization,
      },
      errors: {
        422: `Validation Error`,
      },
    });
  }

}
