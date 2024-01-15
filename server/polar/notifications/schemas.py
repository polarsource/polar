from datetime import datetime
from enum import StrEnum
from uuid import UUID

from polar.kit.schemas import Schema
from polar.notifications.notification import (
    MaintainerAccountReviewedNotification,
    MaintainerAccountUnderReviewNotification,
    MaintainerNewPaidSubscriptionNotification,
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


class NotificationType(StrEnum):
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
    MaintainerAccountUnderReviewNotification = (
        "MaintainerAccountUnderReviewNotification"
    )
    MaintainerAccountReviewedNotification = "MaintainerAccountReviewedNotification"
    MaintainerNewPaidSubscriptionNotification = (
        "MaintainerNewPaidSubscriptionNotification"
    )


class NotificationRead(Schema):
    id: UUID
    type: NotificationType
    created_at: datetime

    maintainer_pledge_paid: MaintainerPledgePaidNotification | None = None
    maintainer_pledge_confirmation_pending: (
        MaintainerPledgeConfirmationPendingNotification | None
    ) = None
    maintainer_pledge_pending: MaintainerPledgePendingNotification | None = None
    maintainer_pledge_created: MaintainerPledgeCreatedNotification | None = None
    pledger_pledge_pending: PledgerPledgePendingNotification | None = None
    reward_paid: RewardPaidNotification | None = None
    maintainer_pledged_issue_confirmation_pending: (
        MaintainerPledgedIssueConfirmationPendingNotification | None
    ) = None
    maintainer_pledged_issue_pending: (
        MaintainerPledgedIssuePendingNotification | None
    ) = None
    team_admin_member_pledged: TeamAdminMemberPledgedNotification | None = None
    maintainer_account_under_review: MaintainerAccountUnderReviewNotification | None = (
        None
    )
    maintainer_account_reviewed: MaintainerAccountReviewedNotification | None = None
    maintainer_new_paid_subscription: MaintainerNewPaidSubscriptionNotification | None = None


class NotificationsList(Schema):
    notifications: list[NotificationRead]
    last_read_notification_id: UUID | None


class NotificationsMarkRead(Schema):
    notification_id: UUID
