/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { CreatePersonalAccessToken } from '../models/CreatePersonalAccessToken';
import type { CreatePersonalAccessTokenResponse } from '../models/CreatePersonalAccessTokenResponse';
import type { ListResource_PersonalAccessToken_ } from '../models/ListResource_PersonalAccessToken_';
import type { PersonalAccessToken } from '../models/PersonalAccessToken';

import type { CancelablePromise } from '../core/CancelablePromise';
import type { BaseHttpRequest } from '../core/BaseHttpRequest';

export class PersonalAccessTokenService {

  constructor(public readonly httpRequest: BaseHttpRequest) {}

  /**
   * Delete a personal access tokens (Public API)
   * Delete a personal access tokens. Requires authentication.
   * @returns PersonalAccessToken Successful Response
   * @throws ApiError
   */
  public delete({
    id,
  }: {
    id: string,
  }): CancelablePromise<PersonalAccessToken> {
    return this.httpRequest.request({
      method: 'DELETE',
      url: '/api/v1/personal_access_tokens/{id}',
      path: {
        'id': id,
      },
      errors: {
        422: `Validation Error`,
      },
    });
  }

  /**
   * List personal access tokens (Public API)
   * List personal access tokens. Requires authentication.
   * @returns ListResource_PersonalAccessToken_ Successful Response
   * @throws ApiError
   */
  public list(): CancelablePromise<ListResource_PersonalAccessToken_> {
    return this.httpRequest.request({
      method: 'GET',
      url: '/api/v1/personal_access_tokens',
    });
  }

  /**
   * Create a new personal access token (Public API)
   * Create a new personal access token. Requires authentication.
   * @returns CreatePersonalAccessTokenResponse Successful Response
   * @throws ApiError
   */
  public create({
    requestBody,
  }: {
    requestBody: CreatePersonalAccessToken,
  }): CancelablePromise<CreatePersonalAccessTokenResponse> {
    return this.httpRequest.request({
      method: 'POST',
      url: '/api/v1/personal_access_tokens',
      body: requestBody,
      mediaType: 'application/json',
      errors: {
        422: `Validation Error`,
      },
    });
  }

}
