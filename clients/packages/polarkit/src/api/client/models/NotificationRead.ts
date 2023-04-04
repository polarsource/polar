/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */

import type { IssueRead } from './IssueRead';
import type { NotificationType } from './NotificationType';
import type { PledgeRead } from './PledgeRead';

export type NotificationRead = {
  id: string;
  type: NotificationType;
  created_at: string;
  pledge?: PledgeRead;
  issue?: IssueRead;
};

