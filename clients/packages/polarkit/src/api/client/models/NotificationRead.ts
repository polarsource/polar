/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */

import type { MaintainerPledgeConfirmationPendingNotification } from './MaintainerPledgeConfirmationPendingNotification';
import type { MaintainerPledgeCreatedNotification } from './MaintainerPledgeCreatedNotification';
import type { MaintainerPledgePaidNotification } from './MaintainerPledgePaidNotification';
import type { MaintainerPledgePendingNotification } from './MaintainerPledgePendingNotification';
import type { NotificationType } from './NotificationType';
import type { PledgerPledgePendingNotification } from './PledgerPledgePendingNotification';

export type NotificationRead = {
  id: string;
  type: NotificationType;
  created_at: string;
  payload: (MaintainerPledgePaidNotification | MaintainerPledgeConfirmationPendingNotification | MaintainerPledgePendingNotification | MaintainerPledgeCreatedNotification | PledgerPledgePendingNotification);
};

