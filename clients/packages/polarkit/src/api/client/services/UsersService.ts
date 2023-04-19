/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { LoginResponse } from '../models/LoginResponse';
import type { LogoutResponse } from '../models/LogoutResponse';
import type { UserRead } from '../models/UserRead';

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
   * Get Token
   * @returns LoginResponse Successful Response
   * @throws ApiError
   */
  public getToken(): CancelablePromise<LoginResponse> {
    return this.httpRequest.request({
      method: 'GET',
      url: '/api/v1/users/token',
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
