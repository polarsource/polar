from uuid import UUID

from sqlalchemy import ForeignKey, Uuid
from sqlalchemy.orm import Mapped, mapped_column

from polar.kit.db.models import Model


class OrganizationNotification(Model):
    __tablename__ = "organization_notifications"

    organization_id: Mapped[UUID] = mapped_column(
        Uuid,
        ForeignKey("organizations.id"),
        nullable=False,
        primary_key=True,
    )

    last_read_notification_id: Mapped[UUID] = mapped_column(
        Uuid,
        nullable=True,
    )
