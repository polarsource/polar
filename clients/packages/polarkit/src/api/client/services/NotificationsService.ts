/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { NotificationRead } from '../models/NotificationRead';

import type { CancelablePromise } from '../core/CancelablePromise';
import type { BaseHttpRequest } from '../core/BaseHttpRequest';

export class NotificationsService {

  constructor(public readonly httpRequest: BaseHttpRequest) {}

  /**
   * Get
   * @returns NotificationRead Successful Response
   * @throws ApiError
   */
  public get(): CancelablePromise<Array<NotificationRead>> {
    return this.httpRequest.request({
      method: 'GET',
      url: '/api/v1/notifications',
    });
  }

}
