/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { CancelablePromise } from '../core/CancelablePromise';
import type { BaseHttpRequest } from '../core/BaseHttpRequest';

export class HealthService {

  constructor(public readonly httpRequest: BaseHttpRequest) {}

  /**
   * Healthz
   * @returns string Successful Response
   * @throws ApiError
   */
  public healthz(): CancelablePromise<Record<string, string>> {
    return this.httpRequest.request({
      method: 'GET',
      url: '/healthz',
    });
  }

  /**
   * Readyz
   * @returns string Successful Response
   * @throws ApiError
   */
  public readyz(): CancelablePromise<Record<string, string>> {
    return this.httpRequest.request({
      method: 'GET',
      url: '/readyz',
    });
  }

}
