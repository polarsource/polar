from enum import StrEnum
from typing import NotRequired, TypedDict
from uuid import UUID

from sqlalchemy import ForeignKey, Index, Uuid
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, declared_attr, mapped_column, relationship

from polar.kit.db.models import TimestampedModel
from polar.kit.extensions.sqlalchemy.types import StringEnum
from polar.models.organization import Organization
from polar.models.user import User


class OrganizationRole(StrEnum):
    owner = "owner"
    admin = "admin"
    member = "member"


class OrganizationNotificationSettings(TypedDict):
    new_order: bool
    new_subscription: bool
    # NotRequired so rows written before the backfill (lacking the key) still
    # serialize; reads default it to True.
    chargeback_prevention: NotRequired[bool]


_default_notification_settings: OrganizationNotificationSettings = {
    "new_order": True,
    "new_subscription": True,
    "chargeback_prevention": True,
}


class UserOrganization(TimestampedModel):
    __tablename__ = "user_organizations"
    __table_args__ = (
        Index(
            "ix_user_organizations_owner_per_org",
            "organization_id",
            unique=True,
            postgresql_where="role = 'owner' AND deleted_at IS NULL",
        ),
    )

    user_id: Mapped[UUID] = mapped_column(
        Uuid,
        ForeignKey("users.id"),
        nullable=False,
        primary_key=True,
    )

    organization_id: Mapped[UUID] = mapped_column(
        Uuid,
        ForeignKey("organizations.id", ondelete="CASCADE"),
        nullable=False,
        primary_key=True,
    )

    role: Mapped[OrganizationRole] = mapped_column(
        StringEnum(OrganizationRole),
        nullable=False,
        default=OrganizationRole.member,
    )

    notification_settings: Mapped[OrganizationNotificationSettings] = mapped_column(
        JSONB, nullable=False, default=_default_notification_settings
    )

    @declared_attr
    def user(cls) -> "Mapped[User]":
        return relationship("User", lazy="raise")

    @declared_attr
    def organization(cls) -> "Mapped[Organization]":
        return relationship("Organization", lazy="raise")
