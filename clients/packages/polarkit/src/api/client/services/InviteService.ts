/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { CancelablePromise } from '../core/CancelablePromise';
import type { BaseHttpRequest } from '../core/BaseHttpRequest';

export class InviteService {

  constructor(public readonly httpRequest: BaseHttpRequest) {}

  /**
   * Claim
   * @returns boolean Successful Response
   * @throws ApiError
   */
  public claim({
    code,
  }: {
    code: string,
  }): CancelablePromise<Record<string, boolean>> {
    return this.httpRequest.request({
      method: 'POST',
      url: '/api/v1/invite/claim_code',
      query: {
        'code': code,
      },
      errors: {
        422: `Validation Error`,
      },
    });
  }

}
