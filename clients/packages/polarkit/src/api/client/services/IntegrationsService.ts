/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { GithubBadgeRead } from '../models/GithubBadgeRead';
import type { InstallationCreate } from '../models/InstallationCreate';
import type { OAuth2AuthorizeResponse } from '../models/OAuth2AuthorizeResponse';
import type { OrganizationRead } from '../models/OrganizationRead';
import type { WebhookResponse } from '../models/WebhookResponse';

import type { CancelablePromise } from '../core/CancelablePromise';
import type { BaseHttpRequest } from '../core/BaseHttpRequest';

export class IntegrationsService {

  constructor(public readonly httpRequest: BaseHttpRequest) {}

  /**
   * Oauth:Github.Jwt.Authorize
   * @returns OAuth2AuthorizeResponse Successful Response
   * @throws ApiError
   */
  public githubAuthorize({
    scopes,
  }: {
    scopes?: Array<string>,
  }): CancelablePromise<OAuth2AuthorizeResponse> {
    return this.httpRequest.request({
      method: 'GET',
      url: '/api/v1/integrations/github/authorize',
      query: {
        'scopes': scopes,
      },
      errors: {
        422: `Validation Error`,
      },
    });
  }

  /**
   * Oauth:Github.Jwt.Callback
   * The response varies based on the authentication backend used.
   * @returns any Successful Response
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
  }): CancelablePromise<any> {
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
        400: `Bad Request`,
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
    badgeType: 'funding',
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
   * Install
   * @returns OrganizationRead Successful Response
   * @throws ApiError
   */
  public install({
    requestBody,
  }: {
    requestBody: InstallationCreate,
  }): CancelablePromise<OrganizationRead> {
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
   * @returns WebhookResponse Successful Response
   * @throws ApiError
   */
  public webhook(): CancelablePromise<WebhookResponse> {
    return this.httpRequest.request({
      method: 'POST',
      url: '/api/v1/integrations/github/webhook',
    });
  }

}
