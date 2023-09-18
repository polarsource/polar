/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { LoginResponse } from '../models/LoginResponse';
import type { LogoutResponse } from '../models/LogoutResponse';
import type { UserRead } from '../models/UserRead';
import type { UserUpdateSettings } from '../models/UserUpdateSettings';

import type { CancelablePromise } from '../core/CancelablePromise';
import type { BaseHttpRequest } from '../core/BaseHttpRequest';

export class UsersService {

  constructor(public readonly httpRequest: BaseHttpRequest) {}

  /**
   * Get Authenticated
   * @returns UserRead Successful Response
   * @throws ApiError
   */
  public getAuthenticated(): CancelablePromise<UserRead> {
    return this.httpRequest.request({
      method: 'GET',
      url: '/api/v1/users/me',
    });
  }

  /**
   * Update Preferences
   * @returns UserRead Successful Response
   * @throws ApiError
   */
  public updatePreferences({
    requestBody,
  }: {
    requestBody: UserUpdateSettings,
  }): CancelablePromise<UserRead> {
    return this.httpRequest.request({
      method: 'PUT',
      url: '/api/v1/users/me',
      body: requestBody,
      mediaType: 'application/json',
      errors: {
        422: `Validation Error`,
      },
    });
  }

  /**
   * Create Token
   * @returns LoginResponse Successful Response
   * @throws ApiError
   */
  public createToken(): CancelablePromise<LoginResponse> {
    return this.httpRequest.request({
      method: 'POST',
      url: '/api/v1/users/me/token',
    });
  }

  /**
   * Logout
   * @returns LogoutResponse Successful Response
   * @throws ApiError
   */
  public logout(): CancelablePromise<LogoutResponse> {
    return this.httpRequest.request({
      method: 'GET',
      url: '/api/v1/users/logout',
    });
  }

}
