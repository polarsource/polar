/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { LoginResponse } from '../models/LoginResponse';
import type { MagicLinkRequest } from '../models/MagicLinkRequest';

import type { CancelablePromise } from '../core/CancelablePromise';
import type { BaseHttpRequest } from '../core/BaseHttpRequest';

export class MagicLinkService {

  constructor(public readonly httpRequest: BaseHttpRequest) {}

  /**
   * Request Magic Link
   * @returns any Successful Response
   * @throws ApiError
   */
  public requestMagicLink({
    requestBody,
  }: {
    requestBody: MagicLinkRequest,
  }): CancelablePromise<any> {
    return this.httpRequest.request({
      method: 'POST',
      url: '/api/v1/magic_link/request',
      body: requestBody,
      mediaType: 'application/json',
      errors: {
        422: `Validation Error`,
      },
    });
  }

  /**
   * Authenticate Magic Link
   * @returns LoginResponse Successful Response
   * @throws ApiError
   */
  public authenticateMagicLink({
    token,
  }: {
    token: string,
  }): CancelablePromise<LoginResponse> {
    return this.httpRequest.request({
      method: 'POST',
      url: '/api/v1/magic_link/authenticate',
      query: {
        'token': token,
      },
      errors: {
        422: `Validation Error`,
      },
    });
  }

}
