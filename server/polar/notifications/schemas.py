from datetime import datetime
from enum import Enum
from typing import Self, Union
from uuid import UUID

from pydantic import Field

from polar.kit.schemas import Schema
from polar.notifications.notification import (
    MaintainerPledgeConfirmationPendingNotification,
    MaintainerPledgeCreatedNotification,
    MaintainerPledgedIssueConfirmationPendingNotification,
    MaintainerPledgedIssuePendingNotification,
    MaintainerPledgePaidNotification,
    MaintainerPledgePendingNotification,
    PledgerPledgePendingNotification,
    RewardPaidNotification,
    TeamAdminMemberPledgedNotification,
)


class NotificationType(str, Enum):
    MaintainerPledgePaidNotification = "MaintainerPledgePaidNotification"
    MaintainerPledgeConfirmationPendingNotification = (
        "MaintainerPledgeConfirmationPendingNotification"
    )
    MaintainerPledgePendingNotification = "MaintainerPledgePendingNotification"
    MaintainerPledgeCreatedNotification = "MaintainerPledgeCreatedNotification"
    PledgerPledgePendingNotification = "PledgerPledgePendingNotification"
    RewardPaidNotification = "RewardPaidNotification"
    MaintainerPledgedIssueConfirmationPendingNotification = (
        "MaintainerPledgedIssueConfirmationPendingNotification"
    )
    MaintainerPledgedIssuePendingNotification = (
        "MaintainerPledgedIssuePendingNotification"
    )
    TeamAdminMemberPledgedNotification = "TeamAdminMemberPledgedNotification"

    @classmethod
    def from_str(cls, s: str) -> Self:
        return cls.__members__[s]


class NotificationRead(Schema):
    id: UUID
    type: NotificationType
    created_at: datetime

    maintainer_pledge_paid: MaintainerPledgePaidNotification | None = None
    maintainer_pledge_confirmation_pending: (
        MaintainerPledgeConfirmationPendingNotification | None
    ) = None  # noqa: E501
    maintainer_pledge_pending: MaintainerPledgePendingNotification | None = None
    maintainer_pledge_created: MaintainerPledgeCreatedNotification | None = None
    pledger_pledge_pending: PledgerPledgePendingNotification | None = None
    reward_paid: RewardPaidNotification | None = None
    maintainer_pledged_issue_confirmation_pending: (
        MaintainerPledgedIssueConfirmationPendingNotification | None
    ) = None  # noqa: E501
    maintainer_pledged_issue_pending: (
        MaintainerPledgedIssuePendingNotification | None
    ) = None  # noqa: E501
    team_admin_member_pledged: TeamAdminMemberPledgedNotification | None = None


class NotificationsList(Schema):
    notifications: list[NotificationRead]
    last_read_notification_id: UUID | None


class NotificationsMarkRead(Schema):
    notification_id: UUID
