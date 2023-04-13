/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { PledgeRead } from '../models/PledgeRead';

import type { CancelablePromise } from '../core/CancelablePromise';
import type { BaseHttpRequest } from '../core/BaseHttpRequest';

export class BackofficeService {

  constructor(public readonly httpRequest: BaseHttpRequest) {}

  /**
   * Pledges
   * @returns PledgeRead Successful Response
   * @throws ApiError
   */
  public pledges(): CancelablePromise<Array<PledgeRead>> {
    return this.httpRequest.request({
      method: 'GET',
      url: '/api/v1/backoffice/pledges',
    });
  }

  /**
   * Pledge Approve
   * @returns PledgeRead Successful Response
   * @throws ApiError
   */
  public pledgeApprove({
    pledgeId,
  }: {
    pledgeId: string,
  }): CancelablePromise<PledgeRead> {
    return this.httpRequest.request({
      method: 'POST',
      url: '/api/v1/backoffice/pledges/approve/{pledge_id}',
      path: {
        'pledge_id': pledgeId,
      },
      errors: {
        422: `Validation Error`,
      },
    });
  }

  /**
   * Pledge Mark Pending
   * @returns PledgeRead Successful Response
   * @throws ApiError
   */
  public pledgeMarkPending({
    pledgeId,
  }: {
    pledgeId: string,
  }): CancelablePromise<PledgeRead> {
    return this.httpRequest.request({
      method: 'POST',
      url: '/api/v1/backoffice/pledges/mark_pending/{pledge_id}',
      path: {
        'pledge_id': pledgeId,
      },
      errors: {
        422: `Validation Error`,
      },
    });
  }

}
