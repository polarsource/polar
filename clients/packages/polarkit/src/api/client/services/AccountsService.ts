/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { Account } from '../models/Account';
import type { AccountCreate } from '../models/AccountCreate';
import type { AccountLink } from '../models/AccountLink';
import type { AccountRead } from '../models/AccountRead';
import type { Platforms } from '../models/Platforms';

import type { CancelablePromise } from '../core/CancelablePromise';
import type { BaseHttpRequest } from '../core/BaseHttpRequest';

export class AccountsService {

  constructor(public readonly httpRequest: BaseHttpRequest) {}

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
   * Get Accounts
   * @returns AccountRead Successful Response
   * @throws ApiError
   */
  public getAccounts({
    platform,
    orgName,
  }: {
    platform: Platforms,
    orgName: string,
  }): CancelablePromise<Array<AccountRead>> {
    return this.httpRequest.request({
      method: 'GET',
      url: '/api/v1/{platform}/{org_name}/accounts',
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
   * @deprecated
   * Create Account
   * @returns AccountRead Successful Response
   * @throws ApiError
   */
  public createAccount({
    platform,
    orgName,
    requestBody,
  }: {
    platform: Platforms,
    orgName: string,
    requestBody: AccountCreate,
  }): CancelablePromise<AccountRead> {
    return this.httpRequest.request({
      method: 'POST',
      url: '/api/v1/{platform}/{org_name}/accounts',
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
