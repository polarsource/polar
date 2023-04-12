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

}
