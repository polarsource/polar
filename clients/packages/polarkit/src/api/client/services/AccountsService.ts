/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { AccountCreate } from '../models/AccountCreate';
import type { AccountLink } from '../models/AccountLink';
import type { AccountRead } from '../models/AccountRead';
import type { Platforms } from '../models/Platforms';

import type { CancelablePromise } from '../core/CancelablePromise';
import type { BaseHttpRequest } from '../core/BaseHttpRequest';

export class AccountsService {

  constructor(public readonly httpRequest: BaseHttpRequest) {}

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

  /**
   * Onboarding Link
   * @returns AccountLink Successful Response
   * @throws ApiError
   */
  public onboardingLink({
    platform,
    orgName,
    accountId,
  }: {
    platform: Platforms,
    orgName: string,
    accountId: string,
  }): CancelablePromise<AccountLink> {
    return this.httpRequest.request({
      method: 'GET',
      url: '/api/v1/{platform}/{org_name}/accounts/{account_id}/onboarding_link',
      path: {
        'platform': platform,
        'org_name': orgName,
        'account_id': accountId,
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
    platform,
    orgName,
    accountId,
  }: {
    platform: Platforms,
    orgName: string,
    accountId: string,
  }): CancelablePromise<AccountLink> {
    return this.httpRequest.request({
      method: 'GET',
      url: '/api/v1/{platform}/{org_name}/accounts/{account_id}/dashboard_link',
      path: {
        'platform': platform,
        'org_name': orgName,
        'account_id': accountId,
      },
      errors: {
        422: `Validation Error`,
      },
    });
  }

}
