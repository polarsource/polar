from uuid import UUID

from sqlalchemy import (
    Boolean,
    ForeignKey,
    String,
)
from sqlalchemy.orm import Mapped, mapped_column

from polar.kit.db.models.base import RecordModel
from polar.kit.extensions.sqlalchemy.types import PostgresUUID


class WebhookEndpoint(RecordModel):
    __tablename__ = "webhook_endpoints"

    url: Mapped[str] = mapped_column(String, nullable=False)

    secret: Mapped[str] = mapped_column(String, nullable=False)

    organization_id: Mapped[UUID | None] = mapped_column(
        PostgresUUID,
        ForeignKey("organizations.id", ondelete="CASCADE"),
        nullable=True,
        index=True,
    )

    user_id: Mapped[UUID | None] = mapped_column(
        PostgresUUID,
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=True,
        index=True,
    )

    created_by_user_id: Mapped[UUID] = mapped_column(
        PostgresUUID,
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=True,
    )

    # Events
    event_subscription_created: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        server_default="false",
    )
    event_subscription_updated: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        server_default="false",
    )
    event_subscription_tier_created: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        server_default="false",
    )
    event_subscription_tier_updated: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        server_default="false",
    )
    event_pledge_created: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        server_default="false",
    )
    event_pledge_updated: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        server_default="false",
    )
    event_donation_created: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        server_default="false",
    )
