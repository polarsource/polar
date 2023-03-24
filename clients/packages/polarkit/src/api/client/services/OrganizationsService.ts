/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { OrganizationRead } from '../models/OrganizationRead';
import type { OrganizationSettingsUpdate } from '../models/OrganizationSettingsUpdate';
import type { Platforms } from '../models/Platforms';

import type { CancelablePromise } from '../core/CancelablePromise';
import type { BaseHttpRequest } from '../core/BaseHttpRequest';

export class OrganizationsService {

  constructor(public readonly httpRequest: BaseHttpRequest) {}

  /**
   * Update Settings
   * @returns OrganizationRead Successful Response
   * @throws ApiError
   */
  public updateSettings({
    platform,
    orgName,
    requestBody,
  }: {
    platform: Platforms,
    orgName: string,
    requestBody: OrganizationSettingsUpdate,
  }): CancelablePromise<OrganizationRead> {
    return this.httpRequest.request({
      method: 'PUT',
      url: '/api/v1/{platform}/{organization_name}/settings',
      path: {
        'platform': platform,
      },
      query: {
        'org_name': orgName,
      },
      body: requestBody,
      mediaType: 'application/json',
      errors: {
        422: `Validation Error`,
      },
    });
  }

}
