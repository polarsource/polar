/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */

import type { MaintainerPledgeConfirmationPendingNotification } from './MaintainerPledgeConfirmationPendingNotification';
import type { MaintainerPledgeCreatedNotification } from './MaintainerPledgeCreatedNotification';
import type { MaintainerPledgedIssueConfirmationPendingNotification } from './MaintainerPledgedIssueConfirmationPendingNotification';
import type { MaintainerPledgedIssuePendingNotification } from './MaintainerPledgedIssuePendingNotification';
import type { MaintainerPledgePaidNotification } from './MaintainerPledgePaidNotification';
import type { MaintainerPledgePendingNotification } from './MaintainerPledgePendingNotification';
import type { NotificationType } from './NotificationType';
import type { PledgerPledgePendingNotification } from './PledgerPledgePendingNotification';
import type { RewardPaidNotification } from './RewardPaidNotification';

export type NotificationRead = {
  id: string;
  type: NotificationType;
  created_at: string;
  payload: (MaintainerPledgePaidNotification | MaintainerPledgeConfirmationPendingNotification | MaintainerPledgePendingNotification | MaintainerPledgeCreatedNotification | PledgerPledgePendingNotification | RewardPaidNotification | MaintainerPledgedIssueConfirmationPendingNotification | MaintainerPledgedIssuePendingNotification);
};

