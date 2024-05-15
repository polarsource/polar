from enum import StrEnum
from uuid import UUID

from sqlalchemy import ForeignKey, String
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from polar.kit.db.models.base import RecordModel
from polar.kit.extensions.sqlalchemy.types import PostgresUUID


class WebhookEventType(StrEnum):
    subscription_created = "subscription.created"
    subscription_updated = "subscription.updated"
    product_created = "product.created"
    product_updated = "product.updated"
    benefit_created = "benefit.created"
    benefit_updated = "benefit.updated"
    organization_updated = "organization.updated"
    pledge_created = "pledge.created"
    pledge_updated = "pledge.updated"
    donation_created = "donation.created"


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

    events: Mapped[list[WebhookEventType]] = mapped_column(
        JSONB, nullable=False, default=[]
    )
