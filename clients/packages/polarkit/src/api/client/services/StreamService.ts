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
    repositoryId,
  }: {
    organizationId: string,
    repositoryId: string,
  }): CancelablePromise<any> {
    return this.httpRequest.request({
      method: 'GET',
      url: '/api/v1/stream',
      query: {
        'organization_id': organizationId,
        'repository_id': repositoryId,
      },
      errors: {
        422: `Validation Error`,
      },
    });
  }

}
