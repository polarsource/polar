/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { NotificationRead } from '../models/NotificationRead';

import type { CancelablePromise } from '../core/CancelablePromise';
import type { BaseHttpRequest } from '../core/BaseHttpRequest';

export class NotificationsService {

  constructor(public readonly httpRequest: BaseHttpRequest) {}

  /**
   * Get Repository Pull Requests
   * @returns NotificationRead Successful Response
   * @throws ApiError
   */
  public getRepositoryPullRequests(): CancelablePromise<Array<NotificationRead>> {
    return this.httpRequest.request({
      method: 'GET',
      url: '/api/v1/notifications',
    });
  }

}
