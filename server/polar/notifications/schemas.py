from datetime import datetime
from enum import Enum
from typing import Self, Union
from uuid import UUID

from polar.kit.schemas import Schema
from polar.notifications.notification import (
    MaintainerPledgeConfirmationPendingNotification,
    MaintainerPledgeCreatedNotification,
    MaintainerPledgePaidNotification,
    MaintainerPledgePendingNotification,
    PledgerPledgePendingNotification,
)


class NotificationType(str, Enum):
    MaintainerPledgePaidNotification = "MaintainerPledgePaidNotification"
    MaintainerPledgeConfirmationPendingNotification = (
        "MaintainerPledgeConfirmationPendingNotification"
    )
    MaintainerPledgePendingNotification = "MaintainerPledgePendingNotification"
    MaintainerPledgeCreatedNotification = "MaintainerPledgeCreatedNotification"
    PledgerPledgePendingNotification = "PledgerPledgePendingNotification"

    @classmethod
    def from_str(cls, s: str) -> Self:
        return cls.__members__[s]


class NotificationRead(Schema):
    id: UUID
    type: NotificationType
    created_at: datetime
    payload: Union[
        MaintainerPledgePaidNotification,
        MaintainerPledgeConfirmationPendingNotification,
        MaintainerPledgePendingNotification,
        MaintainerPledgeCreatedNotification,
        PledgerPledgePendingNotification,
    ]


class NotificationsList(Schema):
    notifications: list[NotificationRead]
    last_read_notification_id: UUID | None


class NotificationsMarkRead(Schema):
    notification_id: UUID
