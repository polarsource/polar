/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { OAuth2AuthorizeResponse } from '../models/OAuth2AuthorizeResponse';
import type { WebhookResponse } from '../models/WebhookResponse';

import type { CancelablePromise } from '../core/CancelablePromise';
import type { BaseHttpRequest } from '../core/BaseHttpRequest';

export class IntegrationsService {

  constructor(public readonly httpRequest: BaseHttpRequest) {}

  /**
   * Oauth:Github.Jwt.Authorize
   * @param scopes
   * @returns OAuth2AuthorizeResponse Successful Response
   * @throws ApiError
   */
  public githubAuthorize(
    scopes?: Array<string>,
  ): CancelablePromise<OAuth2AuthorizeResponse> {
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
   * @param code
   * @param codeVerifier
   * @param state
   * @param error
   * @returns any Successful Response
   * @throws ApiError
   */
  public githubCallback(
    code?: string,
    codeVerifier?: string,
    state?: string,
    error?: string,
  ): CancelablePromise<any> {
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
