/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */

import type { NotificationRead } from './NotificationRead';

export type NotificationsList = {
  notifications: Array<NotificationRead>;
  last_read_notification_id?: string;
};

