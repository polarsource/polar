from datetime import datetime
from uuid import UUID

from sqlalchemy import TIMESTAMP, ForeignKey, String, Uuid
from sqlalchemy.dialects.postgresql import ARRAY
from sqlalchemy.orm import Mapped, declared_attr, mapped_column, relationship

from polar.kit.db.models.base import RecordModel

from .benefit import Benefit
from .organization import Organization


class BenefitSlackIntegration(RecordModel):
    __tablename__ = "benefit_slack_integrations"

    benefit_id: Mapped[UUID] = mapped_column(
        Uuid,
        ForeignKey("benefits.id", ondelete="cascade"),
        nullable=False,
        unique=True,
    )
    organization_id: Mapped[UUID] = mapped_column(
        Uuid,
        ForeignKey("organizations.id", ondelete="cascade"),
        nullable=False,
        index=True,
    )

    display_name: Mapped[str] = mapped_column(String(35), nullable=False)
    slack_app_id: Mapped[str | None] = mapped_column(
        String(32), nullable=True, unique=True, default=None
    )
    client_id: Mapped[str | None] = mapped_column(
        String(255), nullable=True, default=None
    )
    client_secret: Mapped[str | None] = mapped_column(
        String(255), nullable=True, default=None
    )
    signing_secret: Mapped[str | None] = mapped_column(
        String(255), nullable=True, default=None
    )

    team_id: Mapped[str | None] = mapped_column(
        String(32), nullable=True, default=None, index=True
    )
    team_name: Mapped[str | None] = mapped_column(
        String(255), nullable=True, default=None
    )
    bot_user_id: Mapped[str | None] = mapped_column(
        String(32), nullable=True, default=None
    )
    bot_token: Mapped[str | None] = mapped_column(
        String(255), nullable=True, default=None
    )
    authed_user_id: Mapped[str | None] = mapped_column(
        String(32), nullable=True, default=None
    )
    scopes: Mapped[list[str] | None] = mapped_column(
        ARRAY(String), nullable=True, default=None
    )
    installed_at: Mapped[datetime | None] = mapped_column(
        TIMESTAMP(timezone=True), nullable=True, default=None
    )
    revoked_at: Mapped[datetime | None] = mapped_column(
        TIMESTAMP(timezone=True), nullable=True, default=None
    )

    @declared_attr
    def benefit(cls) -> Mapped["Benefit"]:
        return relationship(Benefit, lazy="raise")

    @declared_attr
    def organization(cls) -> Mapped["Organization"]:
        return relationship(Organization, lazy="raise")

    @property
    def is_installed(self) -> bool:
        return self.bot_token is not None and self.revoked_at is None
