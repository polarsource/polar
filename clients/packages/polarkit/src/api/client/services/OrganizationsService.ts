/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { OrganizationBadgeSettingsRead } from '../models/OrganizationBadgeSettingsRead';
import type { OrganizationBadgeSettingsUpdate } from '../models/OrganizationBadgeSettingsUpdate';
import type { OrganizationPrivateRead } from '../models/OrganizationPrivateRead';
import type { OrganizationSettingsUpdate } from '../models/OrganizationSettingsUpdate';
import type { Platforms } from '../models/Platforms';

import type { CancelablePromise } from '../core/CancelablePromise';
import type { BaseHttpRequest } from '../core/BaseHttpRequest';

export class OrganizationsService {

  constructor(public readonly httpRequest: BaseHttpRequest) {}

  /**
   * Get
   * @returns OrganizationPrivateRead Successful Response
   * @throws ApiError
   */
  public get({
    platform,
    orgName,
  }: {
    platform: Platforms,
    orgName: string,
  }): CancelablePromise<OrganizationPrivateRead> {
    return this.httpRequest.request({
      method: 'GET',
      url: '/api/v1/{platform}/{org_name}',
      path: {
        'platform': platform,
        'org_name': orgName,
      },
      errors: {
        422: `Validation Error`,
      },
    });
  }

  /**
   * Get Badge Settings
   * @returns OrganizationBadgeSettingsRead Successful Response
   * @throws ApiError
   */
  public getBadgeSettings({
    platform,
    orgName,
  }: {
    platform: Platforms,
    orgName: string,
  }): CancelablePromise<OrganizationBadgeSettingsRead> {
    return this.httpRequest.request({
      method: 'GET',
      url: '/api/v1/{platform}/{org_name}/badge_settings',
      path: {
        'platform': platform,
        'org_name': orgName,
      },
      errors: {
        422: `Validation Error`,
      },
    });
  }

  /**
   * Update Badge Settings
   * @returns OrganizationBadgeSettingsUpdate Successful Response
   * @throws ApiError
   */
  public updateBadgeSettings({
    platform,
    orgName,
    requestBody,
  }: {
    platform: Platforms,
    orgName: string,
    requestBody: OrganizationBadgeSettingsUpdate,
  }): CancelablePromise<OrganizationBadgeSettingsUpdate> {
    return this.httpRequest.request({
      method: 'PUT',
      url: '/api/v1/{platform}/{org_name}/badge_settings',
      path: {
        'platform': platform,
        'org_name': orgName,
      },
      body: requestBody,
      mediaType: 'application/json',
      errors: {
        422: `Validation Error`,
      },
    });
  }

  /**
   * Update Settings
   * @returns OrganizationPrivateRead Successful Response
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
  }): CancelablePromise<OrganizationPrivateRead> {
    return this.httpRequest.request({
      method: 'PUT',
      url: '/api/v1/{platform}/{org_name}/settings',
      path: {
        'platform': platform,
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
