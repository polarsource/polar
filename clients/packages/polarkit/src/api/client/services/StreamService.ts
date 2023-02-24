/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { CancelablePromise } from '../core/CancelablePromise';
import type { BaseHttpRequest } from '../core/BaseHttpRequest';

export class StreamService {

  constructor(public readonly httpRequest: BaseHttpRequest) {}

  /**
   * Listen
   * @returns any Successful Response
   * @throws ApiError
   */
  public listen({
    organizationId,
  }: {
    organizationId: string,
  }): CancelablePromise<any> {
    return this.httpRequest.request({
      method: 'GET',
      url: '/api/v1/stream/events/{organization_id}',
      path: {
        'organization_id': organizationId,
      },
      errors: {
        422: `Validation Error`,
      },
    });
  }

}
