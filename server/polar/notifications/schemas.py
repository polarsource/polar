from datetime import datetime
from typing import Self, Union
from uuid import UUID

from pydantic import BaseModel
from polar.kit.schemas import Schema
from enum import Enum

from polar.notifications.notification import (
    MaintainerPledgePaidNotification,
    MaintainerPledgePendingNotification,
    PledgerPledgePendingNotification,
)


# TODO: keep or use?
class NotificationType(str, Enum):
    issue_pledge_created = "issue_pledge_created"

    # To pledgers when the status changes for the pledged issue
    issue_pledged_branch_created = "issue_pledged_branch_created"
    issue_pledged_pull_request_created = "issue_pledged_pull_request_created"
    issue_pledged_pull_request_merged = "issue_pledged_pull_request_merged"

    # To maintainers
    maintainer_issue_branch_created = "maintainer_issue_branch_created"
    maintainer_issue_pull_request_created = "maintainer_issue_pull_request_created"
    maintainer_issue_pull_request_merged = "maintainer_issue_pull_request_merged"

    @classmethod
    def from_str(cls, s: str) -> Self:
        return cls.__members__[s]


class NotificationRead(Schema):
    id: UUID
    type: NotificationType
    created_at: datetime
    payload: Union[
        MaintainerPledgePaidNotification,
        MaintainerPledgePendingNotification,
        MaintainerPledgePaidNotification,
        PledgerPledgePendingNotification,
    ]


class NotificationsList(Schema):
    notifications: list[NotificationRead]
    last_read_notification_id: UUID | None


class NotificationsMarkRead(Schema):
    notification_id: UUID
