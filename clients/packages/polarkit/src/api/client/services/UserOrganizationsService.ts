/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { OrganizationRead } from '../models/OrganizationRead';

import type { CancelablePromise } from '../core/CancelablePromise';
import type { BaseHttpRequest } from '../core/BaseHttpRequest';

export class UserOrganizationsService {

  constructor(public readonly httpRequest: BaseHttpRequest) {}

  /**
   * Get User Organizations
   * @returns OrganizationRead Successful Response
   * @throws ApiError
   */
  public getUserOrganizations(): CancelablePromise<Array<OrganizationRead>> {
    return this.httpRequest.request({
      method: 'GET',
      url: '/api/v1/user/organizations',
    });
  }

}
