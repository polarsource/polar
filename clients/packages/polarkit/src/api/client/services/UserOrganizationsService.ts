/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { OrganizationPrivateRead } from '../models/OrganizationPrivateRead';

import type { CancelablePromise } from '../core/CancelablePromise';
import type { BaseHttpRequest } from '../core/BaseHttpRequest';

export class UserOrganizationsService {

  constructor(public readonly httpRequest: BaseHttpRequest) {}

  /**
   * Get User Organizations
   * @returns OrganizationPrivateRead Successful Response
   * @throws ApiError
   */
  public getUserOrganizations(): CancelablePromise<Array<OrganizationPrivateRead>> {
    return this.httpRequest.request({
      method: 'GET',
      url: '/api/v1/user/organizations',
    });
  }

}
