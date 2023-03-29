/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { OrganizationRead } from '../models/OrganizationRead';
import type { OrganizationSettingsUpdate } from '../models/OrganizationSettingsUpdate';
import type { OrganizationSetupIntentRead } from '../models/OrganizationSetupIntentRead';
import type { OrganizationStripeCustomerRead } from '../models/OrganizationStripeCustomerRead';
import type { Platforms } from '../models/Platforms';

import type { CancelablePromise } from '../core/CancelablePromise';
import type { BaseHttpRequest } from '../core/BaseHttpRequest';

export class OrganizationsService {

  constructor(public readonly httpRequest: BaseHttpRequest) {}

  /**
   * Get
   * @returns OrganizationRead Successful Response
   * @throws ApiError
   */
  public get({
    platform,
    orgName,
  }: {
    platform: Platforms,
    orgName: string,
  }): CancelablePromise<OrganizationRead> {
    return this.httpRequest.request({
      method: 'GET',
      url: '/api/v1/{platform}/{organization_name}',
      path: {
        'platform': platform,
      },
      query: {
        'org_name': orgName,
      },
      errors: {
        422: `Validation Error`,
      },
    });
  }

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

  /**
   * Get Stripe Customer
   * @returns OrganizationStripeCustomerRead Successful Response
   * @throws ApiError
   */
  public getStripeCustomer({
    platform,
    orgName,
  }: {
    platform: Platforms,
    orgName: string,
  }): CancelablePromise<OrganizationStripeCustomerRead> {
    return this.httpRequest.request({
      method: 'GET',
      url: '/api/v1/{platform}/{organization_name}/stripe_customer',
      path: {
        'platform': platform,
      },
      query: {
        'org_name': orgName,
      },
      errors: {
        422: `Validation Error`,
      },
    });
  }

  /**
   * Create Setup Intent
   * @returns OrganizationSetupIntentRead Successful Response
   * @throws ApiError
   */
  public createSetupIntent({
    platform,
    orgName,
  }: {
    platform: Platforms,
    orgName: string,
  }): CancelablePromise<OrganizationSetupIntentRead> {
    return this.httpRequest.request({
      method: 'POST',
      url: '/api/v1/{platform}/{organization_name}/setup_intent',
      path: {
        'platform': platform,
      },
      query: {
        'org_name': orgName,
      },
      errors: {
        422: `Validation Error`,
      },
    });
  }

  /**
   * Set Default Payment Method
   * @returns OrganizationStripeCustomerRead Successful Response
   * @throws ApiError
   */
  public setDefaultPaymentMethod({
    platform,
    orgName,
    paymentMethodId,
  }: {
    platform: Platforms,
    orgName: string,
    paymentMethodId: string,
  }): CancelablePromise<OrganizationStripeCustomerRead> {
    return this.httpRequest.request({
      method: 'POST',
      url: '/api/v1/{platform}/{organization_name}/set_default_payment_method',
      path: {
        'platform': platform,
      },
      query: {
        'org_name': orgName,
        'payment_method_id': paymentMethodId,
      },
      errors: {
        422: `Validation Error`,
      },
    });
  }

}
