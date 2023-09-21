/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { ListResource_Organization_ } from '../models/ListResource_Organization_';
import type { Organization } from '../models/Organization';
import type { OrganizationBadgeSettingsRead } from '../models/OrganizationBadgeSettingsRead';
import type { OrganizationBadgeSettingsUpdate } from '../models/OrganizationBadgeSettingsUpdate';
import type { Platforms } from '../models/Platforms';

import type { CancelablePromise } from '../core/CancelablePromise';
import type { BaseHttpRequest } from '../core/BaseHttpRequest';

export class OrganizationsService {

  constructor(public readonly httpRequest: BaseHttpRequest) {}

  /**
   * List organizations (Public API)
   * List organizations that the authenticated user is a member of. Requires authentication.
   * @returns ListResource_Organization_ Successful Response
   * @throws ApiError
   */
  public list(): CancelablePromise<ListResource_Organization_> {
    return this.httpRequest.request({
      method: 'GET',
      url: '/api/v1/organizations',
    });
  }

  /**
   * Search organizations (Public API)
   * Search organizations.
   * @returns ListResource_Organization_ Successful Response
   * @throws ApiError
   */
  public search({
    platform,
    organizationName,
  }: {
    platform?: Platforms,
    organizationName?: string,
  }): CancelablePromise<ListResource_Organization_> {
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
   * Get organization (Public API)
   * Get organization
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
   * Get badge settings (Internal API)
   * @returns OrganizationBadgeSettingsRead Successful Response
   * @throws ApiError
   */
  public getBadgeSettings({
    id,
  }: {
    id: string,
  }): CancelablePromise<OrganizationBadgeSettingsRead> {
    return this.httpRequest.request({
      method: 'GET',
      url: '/api/v1/organizations/{id}/badge_settings',
      path: {
        'id': id,
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
    id,
    requestBody,
  }: {
    id: string,
    requestBody: OrganizationBadgeSettingsUpdate,
  }): CancelablePromise<OrganizationBadgeSettingsUpdate> {
    return this.httpRequest.request({
      method: 'POST',
      url: '/api/v1/organizations/{id}/badge_settings',
      path: {
        'id': id,
      },
      body: requestBody,
      mediaType: 'application/json',
      errors: {
        422: `Validation Error`,
      },
    });
  }

}
