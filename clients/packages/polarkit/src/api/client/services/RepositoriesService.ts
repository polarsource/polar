/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { Platforms } from '../models/Platforms';
import type { Repository } from '../models/Repository';

import type { CancelablePromise } from '../core/CancelablePromise';
import type { BaseHttpRequest } from '../core/BaseHttpRequest';

export class RepositoriesService {

  constructor(public readonly httpRequest: BaseHttpRequest) {}

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

}
