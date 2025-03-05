from enum import StrEnum
from typing import TYPE_CHECKING, Literal
from uuid import UUID

from sqlalchemy import ForeignKey, String, Uuid
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, declared_attr, mapped_column, relationship

from polar.kit.db.models.base import RecordModel

if TYPE_CHECKING:
    from .organization import Organization


class WebhookEventType(StrEnum):
    checkout_created = "checkout.created"
    checkout_updated = "checkout.updated"
    customer_created = "customer.created"
    customer_updated = "customer.updated"
    customer_deleted = "customer.deleted"
    customer_state_changed = "customer.state_changed"
    order_created = "order.created"
    order_refunded = "order.refunded"
    subscription_created = "subscription.created"
    subscription_updated = "subscription.updated"
    subscription_active = "subscription.active"
    subscription_canceled = "subscription.canceled"
    subscription_uncanceled = "subscription.uncanceled"
    subscription_revoked = "subscription.revoked"
    refund_created = "refund.created"
    refund_updated = "refund.updated"
    product_created = "product.created"
    product_updated = "product.updated"
    benefit_created = "benefit.created"
    benefit_updated = "benefit.updated"
    benefit_grant_created = "benefit_grant.created"
    benefit_grant_updated = "benefit_grant.updated"
    benefit_grant_revoked = "benefit_grant.revoked"
    organization_updated = "organization.updated"
    pledge_created = "pledge.created"
    pledge_updated = "pledge.updated"


CustomerWebhookEventType = Literal[
    WebhookEventType.customer_created,
    WebhookEventType.customer_updated,
    WebhookEventType.customer_deleted,
    WebhookEventType.customer_state_changed,
]


class WebhookFormat(StrEnum):
    raw = "raw"
    discord = "discord"
    slack = "slack"


class WebhookEndpoint(RecordModel):
    __tablename__ = "webhook_endpoints"

    url: Mapped[str] = mapped_column(String, nullable=False)
    format: Mapped[WebhookFormat] = mapped_column(String, nullable=False)
    secret: Mapped[str] = mapped_column(String, nullable=False)
    events: Mapped[list[WebhookEventType]] = mapped_column(
        JSONB, nullable=False, default=[]
    )

    organization_id: Mapped[UUID] = mapped_column(
        Uuid,
        ForeignKey("organizations.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    @declared_attr
    def organization(cls) -> Mapped["Organization"]:
        return relationship("Organization", lazy="raise")
