/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { Issue } from '../models/Issue';
import type { Organization } from '../models/Organization';
import type { Platforms } from '../models/Platforms';
import type { Repository } from '../models/Repository';

import type { CancelablePromise } from '../core/CancelablePromise';
import type { BaseHttpRequest } from '../core/BaseHttpRequest';

export class PublicService {

  constructor(public readonly httpRequest: BaseHttpRequest) {}

  /**
   * List repositories (Public API)
   * List repositories in organizations that the authenticated user is a member of. Requires authentication.
   * @returns Repository Successful Response
   * @throws ApiError
   */
  public list(): CancelablePromise<Array<Repository>> {
    return this.httpRequest.request({
      method: 'GET',
      url: '/api/v1/repositories',
    });
  }

  /**
   * Search repositories (Public API)
   * Search repositories.
   * @returns Repository Successful Response
   * @throws ApiError
   */
  public search({
    platform,
    organizationName,
    repositoryName,
  }: {
    platform: Platforms,
    organizationName: string,
    repositoryName?: string,
  }): CancelablePromise<Array<Repository>> {
    return this.httpRequest.request({
      method: 'GET',
      url: '/api/v1/repositories/search',
      query: {
        'platform': platform,
        'organization_name': organizationName,
        'repository_name': repositoryName,
      },
      errors: {
        404: `Not Found`,
        422: `Validation Error`,
      },
    });
  }

  /**
   * Lookup repositories (Public API)
   * Lookup repositories. Like search but returns at only one repository.
   * @returns Repository Successful Response
   * @throws ApiError
   */
  public lookup({
    platform,
    organizationName,
    repositoryName,
  }: {
    platform: Platforms,
    organizationName: string,
    repositoryName: string,
  }): CancelablePromise<Repository> {
    return this.httpRequest.request({
      method: 'GET',
      url: '/api/v1/repositories/lookup',
      query: {
        'platform': platform,
        'organization_name': organizationName,
        'repository_name': repositoryName,
      },
      errors: {
        404: `Not Found`,
        422: `Validation Error`,
      },
    });
  }

  /**
   * Get a repository (Public API)
   * Get a repository
   * @returns Repository Successful Response
   * @throws ApiError
   */
  public get({
    id,
  }: {
    id: string,
  }): CancelablePromise<Repository> {
    return this.httpRequest.request({
      method: 'GET',
      url: '/api/v1/repositories/{id}',
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
   * Get
   * @returns Issue Successful Response
   * @throws ApiError
   */
  public get1({
    id,
  }: {
    id: string,
  }): CancelablePromise<Issue> {
    return this.httpRequest.request({
      method: 'GET',
      url: '/api/v1/issues/{id}',
      path: {
        'id': id,
      },
      errors: {
        422: `Validation Error`,
      },
    });
  }

  /**
   * List organizations (Public API)
   * List organizations that the authenticated user is a member of. Requires authentication.
   * @returns Organization Successful Response
   * @throws ApiError
   */
  public list1(): CancelablePromise<Array<Organization>> {
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
  public search1({
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
  public lookup1({
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
  public get2({
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
