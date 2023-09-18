/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { AuthorizationResponse } from '../models/AuthorizationResponse';
import type { GithubBadgeRead } from '../models/GithubBadgeRead';
import type { GithubUser } from '../models/GithubUser';
import type { InstallationCreate } from '../models/InstallationCreate';
import type { LoginResponse } from '../models/LoginResponse';
import type { LookupUserRequest } from '../models/LookupUserRequest';
import type { OrganizationPrivateRead } from '../models/OrganizationPrivateRead';
import type { polar__integrations__github__endpoints__WebhookResponse } from '../models/polar__integrations__github__endpoints__WebhookResponse';
import type { polar__integrations__stripe__endpoints__WebhookResponse } from '../models/polar__integrations__stripe__endpoints__WebhookResponse';

import type { CancelablePromise } from '../core/CancelablePromise';
import type { BaseHttpRequest } from '../core/BaseHttpRequest';

export class IntegrationsService {

  constructor(public readonly httpRequest: BaseHttpRequest) {}

  /**
   * Github Authorize
   * @returns AuthorizationResponse Successful Response
   * @throws ApiError
   */
  public githubAuthorize({
    paymentIntentId,
    gotoUrl,
  }: {
    paymentIntentId?: string,
    gotoUrl?: string,
  }): CancelablePromise<AuthorizationResponse> {
    return this.httpRequest.request({
      method: 'GET',
      url: '/api/v1/integrations/github/authorize',
      query: {
        'payment_intent_id': paymentIntentId,
        'goto_url': gotoUrl,
      },
      errors: {
        422: `Validation Error`,
      },
    });
  }

  /**
   * Github Callback
   * @returns LoginResponse Successful Response
   * @throws ApiError
   */
  public githubCallback({
    code,
    codeVerifier,
    state,
    error,
  }: {
    code?: string,
    codeVerifier?: string,
    state?: string,
    error?: string,
  }): CancelablePromise<LoginResponse> {
    return this.httpRequest.request({
      method: 'GET',
      url: '/api/v1/integrations/github/callback',
      query: {
        'code': code,
        'code_verifier': codeVerifier,
        'state': state,
        'error': error,
      },
      errors: {
        422: `Validation Error`,
      },
    });
  }

  /**
   * Get Badge Settings
   * @returns GithubBadgeRead Successful Response
   * @throws ApiError
   */
  public getBadgeSettings({
    org,
    repo,
    number,
    badgeType,
  }: {
    org: string,
    repo: string,
    number: number,
    badgeType: 'pledge',
  }): CancelablePromise<GithubBadgeRead> {
    return this.httpRequest.request({
      method: 'GET',
      url: '/api/v1/integrations/github/{org}/{repo}/issues/{number}/badges/{badge_type}',
      path: {
        'org': org,
        'repo': repo,
        'number': number,
        'badge_type': badgeType,
      },
      errors: {
        422: `Validation Error`,
      },
    });
  }

  /**
   * Lookup User
   * @returns GithubUser Successful Response
   * @throws ApiError
   */
  public lookupUser({
    requestBody,
  }: {
    requestBody: LookupUserRequest,
  }): CancelablePromise<GithubUser> {
    return this.httpRequest.request({
      method: 'POST',
      url: '/api/v1/integrations/github/lookup_user',
      body: requestBody,
      mediaType: 'application/json',
      errors: {
        422: `Validation Error`,
      },
    });
  }

  /**
   * Install
   * @returns OrganizationPrivateRead Successful Response
   * @throws ApiError
   */
  public install({
    requestBody,
  }: {
    requestBody: InstallationCreate,
  }): CancelablePromise<OrganizationPrivateRead> {
    return this.httpRequest.request({
      method: 'POST',
      url: '/api/v1/integrations/github/installations',
      body: requestBody,
      mediaType: 'application/json',
      errors: {
        422: `Validation Error`,
      },
    });
  }

  /**
   * Webhook
   * @returns polar__integrations__github__endpoints__WebhookResponse Successful Response
   * @throws ApiError
   */
  public webhook(): CancelablePromise<polar__integrations__github__endpoints__WebhookResponse> {
    return this.httpRequest.request({
      method: 'POST',
      url: '/api/v1/integrations/github/webhook',
    });
  }

  /**
   * Stripe Connect Return
   * @returns any Successful Response
   * @throws ApiError
   */
  public stripeConnectReturn({
    stripeId,
  }: {
    stripeId: string,
  }): CancelablePromise<any> {
    return this.httpRequest.request({
      method: 'GET',
      url: '/api/v1/integrations/stripe/return',
      query: {
        'stripe_id': stripeId,
      },
      errors: {
        422: `Validation Error`,
      },
    });
  }

  /**
   * Stripe Connect Refresh
   * @returns polar__integrations__stripe__endpoints__WebhookResponse Successful Response
   * @throws ApiError
   */
  public stripeConnectRefresh(): CancelablePromise<polar__integrations__stripe__endpoints__WebhookResponse> {
    return this.httpRequest.request({
      method: 'GET',
      url: '/api/v1/integrations/stripe/refresh',
    });
  }

  /**
   * Webhook
   * @returns polar__integrations__stripe__endpoints__WebhookResponse Successful Response
   * @throws ApiError
   */
  public webhook1(): CancelablePromise<polar__integrations__stripe__endpoints__WebhookResponse> {
    return this.httpRequest.request({
      method: 'POST',
      url: '/api/v1/integrations/stripe/webhook',
    });
  }

}
