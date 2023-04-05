/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */

import type { IssueRead } from './IssueRead';
import type { NotificationType } from './NotificationType';
import type { PledgeRead } from './PledgeRead';
import type { PullRequestRead } from './PullRequestRead';

export type NotificationRead = {
  id: string;
  type: NotificationType;
  created_at: string;
  pledge?: PledgeRead;
  issue?: IssueRead;
  pull_request?: PullRequestRead;
};

