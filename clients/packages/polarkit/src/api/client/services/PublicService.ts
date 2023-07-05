/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { Organization } from '../models/Organization';

import type { CancelablePromise } from '../core/CancelablePromise';
import type { BaseHttpRequest } from '../core/BaseHttpRequest';

export class PublicService {

  constructor(public readonly httpRequest: BaseHttpRequest) {}

  /**
   * Get
   * Get an organization
   * @returns Organization Successful Response
   * @throws ApiError
   */
  public get({
    id,
  }: {
    id: string,
  }): CancelablePromise<Organization> {
    return this.httpRequest.request({
      method: 'GET',
      url: '/api/v1/organizations/{id}',
      path: {
        'id': id,
      },
      errors: {
        404: `Not Found`,
        422: `Validation Error`,
      },
    });
  }

}
