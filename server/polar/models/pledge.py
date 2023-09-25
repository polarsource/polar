from datetime import datetime
from uuid import UUID

from sqlalchemy import TIMESTAMP, BigInteger, ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from polar.exceptions import PolarError
from polar.kit.db.models import RecordModel
from polar.kit.extensions.sqlalchemy import PostgresUUID
from polar.models.issue import Issue
from polar.models.organization import Organization
from polar.models.repository import Repository
from polar.models.user import User


class PledgeWithoutPledgerError(PolarError):
    def __init__(self, pledge_id: UUID) -> None:
        self.pledge_id = pledge_id
        message = f"The pledge {pledge_id} has no associated pledger"
        super().__init__(message)


class Pledge(RecordModel):
    __tablename__ = "pledges"

    issue_id: Mapped[UUID] = mapped_column(
        PostgresUUID, ForeignKey("issues.id"), nullable=False, index=True
    )
    repository_id: Mapped[UUID] = mapped_column(
        PostgresUUID, ForeignKey("repositories.id"), nullable=False
    )
    organization_id: Mapped[UUID] = mapped_column(
        PostgresUUID, ForeignKey("organizations.id"), nullable=False
    )

    # Stripe Payment Intents (may or may not have been paid)
    payment_id: Mapped[str | None] = mapped_column(String, nullable=True, index=True)

    # Stripe Invoice ID (if pay later and the invoice has been created)
    invoice_id: Mapped[str | None] = mapped_column(String, nullable=True)

    # Stripe URL for hosted invoice
    invoice_hosted_url: Mapped[str | None] = mapped_column(String, nullable=True)

    # Deprecated: Not relevant after introduction of split rewards.
    # Instead see pledge_transactions table.
    transfer_id: Mapped[str] = mapped_column(String, nullable=True)

    email: Mapped[str] = mapped_column(String, nullable=True, index=True, default=None)

    amount: Mapped[int] = mapped_column(BigInteger, nullable=False)
    fee: Mapped[int] = mapped_column(BigInteger, nullable=False)

    @property
    def amount_including_fee(self) -> int:
        return self.amount + self.fee

    # For paid pledges, this is the amount of monye actually received.
    # For pledges paid by invoice, this amount can be smaller or larger than
    # amount_including_fee.
    amount_received: Mapped[int | None] = mapped_column(BigInteger, nullable=True)

    state: Mapped[str] = mapped_column(String, nullable=False, default="initiated")
    type: Mapped[str] = mapped_column(String, nullable=False, default="pay_upfront")

    # 14 days after the state changes to pending
    scheduled_payout_at: Mapped[datetime | None] = mapped_column(
        TIMESTAMP(timezone=True), nullable=True
    )

    dispute_reason: Mapped[str | None] = mapped_column(String, nullable=True)
    disputed_by_user_id: Mapped[UUID | None] = mapped_column(
        PostgresUUID,
        ForeignKey("users.id"),
        nullable=True,
    )
    disputed_at: Mapped[datetime | None] = mapped_column(
        TIMESTAMP(timezone=True), nullable=True
    )
    refunded_at: Mapped[datetime | None] = mapped_column(
        TIMESTAMP(timezone=True), nullable=True
    )

    by_user_id: Mapped[UUID | None] = mapped_column(
        PostgresUUID,
        ForeignKey("users.id"),
        nullable=True,
        index=True,
        default=None,
    )

    by_organization_id: Mapped[UUID | None] = mapped_column(
        PostgresUUID,
        ForeignKey("organizations.id"),
        nullable=True,
        index=True,
        default=None,
    )

    user: Mapped[User] = relationship("User", foreign_keys=[by_user_id], lazy="raise")

    by_organization: Mapped[Organization] = relationship(
        "Organization", foreign_keys=[by_organization_id], lazy="raise"
    )

    to_repository: Mapped[Repository] = relationship(
        "Repository", foreign_keys=[repository_id], lazy="raise"
    )

    to_organization: Mapped[Organization] = relationship(
        "Organization", foreign_keys=[organization_id], lazy="raise"
    )

    issue: Mapped[Issue] = relationship("Issue", foreign_keys=[issue_id], lazy="raise")

    @property
    def pledger(self) -> User | Organization:
        if self.by_organization is not None:
            return self.by_organization
        if self.user is not None:
            return self.user
        raise PledgeWithoutPledgerError(self.id)
