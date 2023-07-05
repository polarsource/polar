/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { Organization } from '../models/Organization';
import type { Platforms } from '../models/Platforms';

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

  /**
   * List
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
   * Search
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
   * Lookup
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

}
