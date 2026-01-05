from datetime import datetime
from typing import TYPE_CHECKING
from uuid import UUID

from sqlalchemy import TIMESTAMP, ForeignKey, Index, Integer, Text, String, Uuid
from sqlalchemy.orm import Mapped, declared_attr, mapped_column, relationship

from polar.kit.db.models import RecordModel
from polar.kit.metadata import MetadataMixin

if TYPE_CHECKING:
    from .account import Account
    from .campaign import Campaign


class AccountCredit(MetadataMixin, RecordModel):
    __tablename__ = "account_credits"
    __table_args__ = (
        Index(
            "ix_account_credits_active",
            "account_id",
            "expires_at",
            "revoked_at",
            "deleted_at",
        ),
    )

    account_id: Mapped[UUID] = mapped_column(
        Uuid, ForeignKey("accounts.id", ondelete="cascade"), nullable=False
    )
    campaign_id: Mapped[UUID | None] = mapped_column(
        Uuid, ForeignKey("campaigns.id", ondelete="set null"), nullable=True, index=True
    )
    title: Mapped[str] = mapped_column(String, nullable=False)
    amount: Mapped[int] = mapped_column(Integer, nullable=False)
    used: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

    granted_at: Mapped[datetime] = mapped_column(
        TIMESTAMP(timezone=True), nullable=False, default=datetime.utcnow
    )
    expires_at: Mapped[datetime | None] = mapped_column(
        TIMESTAMP(timezone=True), nullable=True
    )
    revoked_at: Mapped[datetime | None] = mapped_column(
        TIMESTAMP(timezone=True), nullable=True
    )

    notes: Mapped[str | None] = mapped_column(Text, nullable=True, default=None)

    @declared_attr
    def account(cls) -> Mapped["Account"]:
        return relationship("Account", lazy="raise", back_populates="credits")

    @declared_attr
    def campaign(cls) -> Mapped["Campaign | None"]:
        return relationship("Campaign", lazy="raise")

    @property
    def remaining(self) -> int:
        return max(0, self.amount - self.used)

    def is_active(self) -> bool:
        now = datetime.utcnow()

        if self.revoked_at is not None:
            return False

        if self.expires_at is not None and self.expires_at <= now:
            return False

        if self.remaining <= 0:
            return False

        return True
