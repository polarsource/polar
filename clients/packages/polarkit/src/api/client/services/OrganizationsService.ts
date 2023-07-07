/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { Organization } from '../models/Organization';
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
   * List organizations (Public API)
   * List organizations that the authenticated user is a member of. Requires authentication.
   * @returns Organization Successful Response
   * @throws ApiError
   */
  public list(): CancelablePromise<Array<Organization>> {
    return this.httpRequest.request({
      method: 'GET',
      url: '/api/v1/organizations',
    });
  }

  /**
   * Search organizations (Public API)
   * Search organizations.
   * @returns Organization Successful Response
   * @throws ApiError
   */
  public search({
    platform,
    organizationName,
  }: {
    platform?: Platforms,
    organizationName?: string,
  }): CancelablePromise<Array<Organization>> {
    return this.httpRequest.request({
      method: 'GET',
      url: '/api/v1/organizations/search',
      query: {
        'platform': platform,
        'organization_name': organizationName,
      },
      errors: {
        422: `Validation Error`,
      },
    });
  }

  /**
   * Lookup organization (Public API)
   * Lookup organization. Like search but returns at only one organization.
   * @returns Organization Successful Response
   * @throws ApiError
   */
  public lookup({
    platform,
    organizationName,
  }: {
    platform?: Platforms,
    organizationName?: string,
  }): CancelablePromise<Organization> {
    return this.httpRequest.request({
      method: 'GET',
      url: '/api/v1/organizations/lookup',
      query: {
        'platform': platform,
        'organization_name': organizationName,
      },
      errors: {
        404: `Not Found`,
        422: `Validation Error`,
      },
    });
  }

  /**
   * Get an organization (Public API)
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

  /**
   * @deprecated
   * Get an organization (Internal API)
   * @returns OrganizationPrivateRead Successful Response
   * @throws ApiError
   */
  public getInternal({
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
   * Get badge settings (Internal API)
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
   * Update badge settings (Internal API)
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
   * Update organization settings (Internal API)
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
