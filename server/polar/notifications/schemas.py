from pydantic import UUID4

from polar.kit.schemas import Schema
from polar.notifications.notification import Notification


class NotificationsList(Schema):
    notifications: list[Notification]
    last_read_notification_id: UUID4 | None = None


class NotificationsMarkRead(Schema):
    notification_id: UUID4
