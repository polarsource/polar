from datetime import datetime
from enum import StrEnum
from typing import TYPE_CHECKING
from uuid import UUID

from sqlalchemy import TIMESTAMP, ForeignKey, String, Uuid
from sqlalchemy.orm import Mapped, declared_attr, mapped_column, relationship

from polar.kit.db.models import RecordModel

if TYPE_CHECKING:
    from polar.models import OAuth2Client, Organization, User


class AgentStatus(StrEnum):
    unclaimed = "unclaimed"
    claimed = "claimed"
    revoked = "revoked"


class Agent(RecordModel):
    __tablename__ = "agents"

    name: Mapped[str | None] = mapped_column(String, nullable=True, default=None)
    status: Mapped[AgentStatus] = mapped_column(
        String, nullable=False, default=AgentStatus.unclaimed
    )

    @declared_attr
    def oauth2_client(cls) -> Mapped["OAuth2Client"]:
        return relationship("OAuth2Client", lazy="raise", uselist=False)

    organization_id: Mapped[UUID | None] = mapped_column(
        Uuid,
        ForeignKey("organizations.id", ondelete="set null"),
        nullable=True,
        unique=True,
        default=None,
    )

    @declared_attr
    def organization(cls) -> Mapped["Organization | None"]:
        return relationship("Organization", lazy="raise")

    claim_email: Mapped[str | None] = mapped_column(
        String(320), nullable=True, default=None
    )
    claim_token_hash: Mapped[str | None] = mapped_column(
        String(80), nullable=True, unique=True, default=None
    )
    claim_token_expires_at: Mapped[datetime | None] = mapped_column(
        TIMESTAMP(timezone=True), nullable=True, default=None
    )
    claim_link_token_hash: Mapped[str | None] = mapped_column(
        String(80), nullable=True, unique=True, default=None
    )
    claim_code_hash: Mapped[str | None] = mapped_column(
        String(80), nullable=True, default=None
    )
    claim_expires_at: Mapped[datetime | None] = mapped_column(
        TIMESTAMP(timezone=True), nullable=True, default=None
    )
    claim_polled_at: Mapped[datetime | None] = mapped_column(
        TIMESTAMP(timezone=True), nullable=True, default=None
    )

    claimed_by_user_id: Mapped[UUID | None] = mapped_column(
        Uuid,
        ForeignKey("users.id", ondelete="set null"),
        nullable=True,
        index=True,
        default=None,
    )

    @declared_attr
    def claimed_by_user(cls) -> Mapped["User | None"]:
        return relationship("User", lazy="raise")

    claimed_at: Mapped[datetime | None] = mapped_column(
        TIMESTAMP(timezone=True), nullable=True, default=None
    )
    revoked_at: Mapped[datetime | None] = mapped_column(
        TIMESTAMP(timezone=True), nullable=True, default=None
    )

    @property
    def can_authenticate(self) -> bool:
        return not self.is_deleted and self.status == AgentStatus.unclaimed
