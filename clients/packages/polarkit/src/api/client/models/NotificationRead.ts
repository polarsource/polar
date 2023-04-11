/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */

import type { IssuePledgeCreated } from './IssuePledgeCreated';
import type { IssuePledgedBranchCreated } from './IssuePledgedBranchCreated';
import type { IssuePledgedPullRequestCreated } from './IssuePledgedPullRequestCreated';
import type { IssuePledgedPullRequestMerged } from './IssuePledgedPullRequestMerged';
import type { MaintainerIssueBranchCreated } from './MaintainerIssueBranchCreated';
import type { MaintainerIssuePullRequestCreated } from './MaintainerIssuePullRequestCreated';
import type { MaintainerIssuePullRequestMerged } from './MaintainerIssuePullRequestMerged';
import type { NotificationType } from './NotificationType';

export type NotificationRead = {
  id: string;
  type: NotificationType;
  created_at: string;
  payload: (IssuePledgeCreated | IssuePledgedBranchCreated | IssuePledgedPullRequestCreated | IssuePledgedPullRequestMerged | MaintainerIssueBranchCreated | MaintainerIssuePullRequestCreated | MaintainerIssuePullRequestMerged);
};

