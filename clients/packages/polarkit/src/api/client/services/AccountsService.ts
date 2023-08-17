/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { Account } from '../models/Account';
import type { AccountCreate } from '../models/AccountCreate';
import type { AccountLink } from '../models/AccountLink';
import type { ListResource_Account_ } from '../models/ListResource_Account_';

import type { CancelablePromise } from '../core/CancelablePromise';
import type { BaseHttpRequest } from '../core/BaseHttpRequest';

export class AccountsService {

  constructor(public readonly httpRequest: BaseHttpRequest) {}

  /**
   * Search
   * @returns ListResource_Account_ Successful Response
   * @throws ApiError
   */
  public search({
    organizationId,
    userId,
  }: {
    /**
     * Search accounts connected to this organization. Either user_id or organization_id must be set.
     */
    organizationId?: string,
    /**
     * Search accounts connected to this user. Either user_id or organization_id must be set.
     */
    userId?: string,
  }): CancelablePromise<ListResource_Account_> {
    return this.httpRequest.request({
      method: 'GET',
      url: '/api/v1/accounts/search',
      query: {
        'organization_id': organizationId,
        'user_id': userId,
      },
      errors: {
        422: `Validation Error`,
      },
    });
  }

  /**
   * Get
   * @returns Account Successful Response
   * @throws ApiError
   */
  public get({
    id,
  }: {
    id: string,
  }): CancelablePromise<Account> {
    return this.httpRequest.request({
      method: 'GET',
      url: '/api/v1/accounts/{id}',
      path: {
        'id': id,
      },
      errors: {
        422: `Validation Error`,
      },
    });
  }

  /**
   * Onboarding Link
   * @returns AccountLink Successful Response
   * @throws ApiError
   */
  public onboardingLink({
    id,
  }: {
    id: string,
  }): CancelablePromise<AccountLink> {
    return this.httpRequest.request({
      method: 'POST',
      url: '/api/v1/accounts/{id}/onboarding_link',
      path: {
        'id': id,
      },
      errors: {
        422: `Validation Error`,
      },
    });
  }

  /**
   * Dashboard Link
   * @returns AccountLink Successful Response
   * @throws ApiError
   */
  public dashboardLink({
    id,
  }: {
    id: string,
  }): CancelablePromise<AccountLink> {
    return this.httpRequest.request({
      method: 'POST',
      url: '/api/v1/accounts/{id}/dashboard_link',
      path: {
        'id': id,
      },
      errors: {
        422: `Validation Error`,
      },
    });
  }

  /**
   * Create
   * @returns Account Successful Response
   * @throws ApiError
   */
  public create({
    requestBody,
  }: {
    requestBody: AccountCreate,
  }): CancelablePromise<Account> {
    return this.httpRequest.request({
      method: 'POST',
      url: '/api/v1/accounts',
      body: requestBody,
      mediaType: 'application/json',
      errors: {
        422: `Validation Error`,
      },
    });
  }

}
