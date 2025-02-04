from datetime import datetime
from uuid import UUID

from sqlalchemy import CHAR, TIMESTAMP, ForeignKey, String, Text, Uuid
from sqlalchemy.orm import Mapped, declared_attr, mapped_column, relationship

from polar.auth.scope import Scope, scope_to_set
from polar.kit.db.models.base import RecordModel

from .organization import Organization


class OrganizationAccessToken(RecordModel):
    __tablename__ = "organization_access_tokens"

    token: Mapped[str] = mapped_column(CHAR(64), unique=True, nullable=False)
    scope: Mapped[str] = mapped_column(Text, nullable=False)
    expires_at: Mapped[datetime | None] = mapped_column(
        TIMESTAMP(timezone=True), nullable=True, index=True
    )
    comment: Mapped[str] = mapped_column(String, nullable=False)
    last_used_at: Mapped[datetime | None] = mapped_column(
        TIMESTAMP(timezone=True), nullable=True, default=None
    )

    organization_id: Mapped[UUID] = mapped_column(
        Uuid, ForeignKey("organizations.id"), nullable=False
    )

    @declared_attr
    def organization(cls) -> Mapped["Organization"]:
        return relationship(Organization, lazy="raise")

    @property
    def scopes(self) -> set[Scope]:
        return scope_to_set(self.scope)
