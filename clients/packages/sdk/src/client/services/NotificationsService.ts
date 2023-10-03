/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { NotificationsList } from '../models/NotificationsList';
import type { NotificationsMarkRead } from '../models/NotificationsMarkRead';

import type { CancelablePromise } from '../core/CancelablePromise';
import type { BaseHttpRequest } from '../core/BaseHttpRequest';

export class NotificationsService {

  constructor(public readonly httpRequest: BaseHttpRequest) {}

  /**
   * Get
   * @returns NotificationsList Successful Response
   * @throws ApiError
   */
  public get(): CancelablePromise<NotificationsList> {
    return this.httpRequest.request({
      method: 'GET',
      url: '/api/v1/notifications',
    });
  }

  /**
   * Mark Read
   * @returns any Successful Response
   * @throws ApiError
   */
  public markRead({
    requestBody,
  }: {
    requestBody: NotificationsMarkRead,
  }): CancelablePromise<any> {
    return this.httpRequest.request({
      method: 'POST',
      url: '/api/v1/notifications/read',
      body: requestBody,
      mediaType: 'application/json',
      errors: {
        422: `Validation Error`,
      },
    });
  }

}
