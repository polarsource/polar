from datetime import datetime
from enum import StrEnum
from uuid import UUID

from sqlalchemy import TIMESTAMP, BigInteger, ForeignKey, String
from sqlalchemy.orm import Mapped, declared_attr, mapped_column, relationship

from polar.kit.db.models import RecordModel
from polar.kit.extensions.sqlalchemy import PostgresUUID
from polar.models.issue import Issue
from polar.models.organization import Organization
from polar.models.repository import Repository
from polar.models.user import User


class PledgeState(StrEnum):
    # Initiated by customer. Polar has not received money yet.
    initiated = "initiated"

    # The pledge has been created.
    # Type=pay_upfront: polar has recevied the money
    # Type=pay_on_completion: polar has not recevied the money
    created = "created"

    # The fix was confirmed, and rewards have been created.
    # See issue rewards to track payment status.
    #
    # Type=pay_upfront: polar has recevied the money
    # Type=pay_on_completion: polar has recevied the money
    pending = "pending"

    # The pledge was refunded in full before being paid out.
    refunded = "refunded"
    # The pledge was disputed by the customer (via Polar)
    disputed = "disputed"
    # The charge was disputed by the customer (via Stripe, aka "chargeback")
    charge_disputed = "charge_disputed"
    # Manually cancalled by a Polar admin.
    cancelled = "cancelled"

    # The states in which this pledge is "active", i.e. is listed on the issue
    @classmethod
    def active_states(cls) -> list["PledgeState"]:
        return [
            cls.created,
            cls.pending,
            cls.disputed,
        ]

    # Happy paths:
    #   Pay upfront:
    #       initiated -> created -> pending -> (transfer)
    #
    #   Pay later (pay_on_completion / pay_from_maintainer):
    #       created -> pending -> (transfer)
    #
    #   Pay regardless:
    #       pending -> (transfer)
    #

    @classmethod
    def to_created_states(cls) -> list["PledgeState"]:
        """
        Allowed states to move into initiated from
        """
        return [cls.initiated]

    @classmethod
    def to_confirmation_pending_states(cls) -> list["PledgeState"]:
        """
        Allowed states to move into confirmation pending from
        """
        return [cls.created]

    @classmethod
    def to_pending_states(cls) -> list["PledgeState"]:
        """
        Allowed states to move into pending from
        """
        return [cls.created]

    @classmethod
    def to_disputed_states(cls) -> list["PledgeState"]:
        """
        # Allowed states to move into disputed from
        """
        return [cls.created, cls.pending]

    @classmethod
    def to_paid_states(cls) -> list["PledgeState"]:
        """
        Allowed states to move into paid from
        """
        return [cls.pending]

    @classmethod
    def to_refunded_states(cls) -> list["PledgeState"]:
        """
        Allowed states to move into refunded from
        """
        return [cls.created, cls.pending, cls.disputed]

    @classmethod
    def from_str(cls, s: str) -> "PledgeState":
        return PledgeState.__members__[s]


class PledgeType(StrEnum):
    # Up front pledges, paid to Polar directly, transfered to maintainer when completed.
    pay_upfront = "pay_upfront"

    # Pledge without upfront payment. The pledger pays after the issue is completed.
    pay_on_completion = "pay_on_completion"

    # Pay directly. Money is ready to transfered to maintainer without requiring
    # issue to be completed.
    pay_directly = "pay_directly"

    @classmethod
    def from_str(cls, s: str) -> "PledgeType":
        return PledgeType.__members__[s]


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
    payment_id: Mapped[str | None] = mapped_column(
        String, nullable=True, index=True, default=None
    )

    # Stripe Invoice ID (if pay later and the invoice has been created)
    invoice_id: Mapped[str | None] = mapped_column(String, nullable=True, default=None)

    # Stripe URL for hosted invoice
    invoice_hosted_url: Mapped[str | None] = mapped_column(
        String, nullable=True, default=None
    )

    # Deprecated: Not relevant after introduction of split rewards.
    # Instead see pledge_transactions table.
    transfer_id: Mapped[str | None] = mapped_column(String, nullable=True, default=None)

    email: Mapped[str] = mapped_column(String, nullable=True, index=True, default=None)

    amount: Mapped[int] = mapped_column(BigInteger, nullable=False)
    fee: Mapped[int] = mapped_column(BigInteger, nullable=False)

    @property
    def amount_including_fee(self) -> int:
        return self.amount + self.fee

    # For paid pledges, this is the amount of monye actually received.
    # For pledges paid by invoice, this amount can be smaller or larger than
    # amount_including_fee.
    amount_received: Mapped[int | None] = mapped_column(
        BigInteger, nullable=True, default=None
    )

    state: Mapped[PledgeState] = mapped_column(
        String, nullable=False, default=PledgeState.initiated
    )
    type: Mapped[PledgeType] = mapped_column(
        String, nullable=False, default=PledgeType.pay_upfront
    )

    # often 7 days after the state changes to pending
    scheduled_payout_at: Mapped[datetime | None] = mapped_column(
        TIMESTAMP(timezone=True), nullable=True, default=None
    )

    dispute_reason: Mapped[str | None] = mapped_column(
        String, nullable=True, default=None
    )
    disputed_by_user_id: Mapped[UUID | None] = mapped_column(
        PostgresUUID,
        ForeignKey("users.id"),
        nullable=True,
        default=None,
    )
    disputed_at: Mapped[datetime | None] = mapped_column(
        TIMESTAMP(timezone=True), nullable=True, default=None
    )
    refunded_at: Mapped[datetime | None] = mapped_column(
        TIMESTAMP(timezone=True), nullable=True, default=None
    )

    # by_user_id, by_organization_id are mutually exclusive
    #
    # They determine who paid for this pledge (or who's going to pay for it).
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

    # on_behalf_of_organization_id can be set when by_user_id is set.
    # This means that the "credz" if the pledge will go to the organization, but that
    # the by_user_id-user is still the one that paid/will pay for the pledge.
    #
    # on_behalf_of_organization_id can not be set when by_organization_id is set.
    on_behalf_of_organization_id: Mapped[UUID | None] = mapped_column(
        PostgresUUID,
        ForeignKey("organizations.id"),
        nullable=True,
        index=True,
        default=None,
    )

    # created_by_user_id is the user/actor that created the pledge, unrelated to who's
    # going to pay for it.
    #
    # If by_organization_id is set, this is the user that pressed the "Pledge" button.
    created_by_user_id: Mapped[UUID | None] = mapped_column(
        PostgresUUID,
        ForeignKey("users.id"),
        nullable=True,
        default=None,
    )

    @declared_attr
    def user(cls) -> Mapped[User | None]:
        return relationship(User, primaryjoin=User.id == cls.by_user_id, lazy="raise")

    @declared_attr
    def by_organization(cls) -> Mapped[Organization]:
        return relationship(
            Organization,
            primaryjoin=Organization.id == cls.by_organization_id,
            lazy="raise",
        )

    @declared_attr
    def on_behalf_of_organization(cls) -> Mapped[Organization]:
        return relationship(
            Organization,
            primaryjoin=Organization.id == cls.on_behalf_of_organization_id,
            lazy="raise",
        )

    @declared_attr
    def to_repository(cls) -> Mapped[Repository]:
        return relationship(
            Repository, primaryjoin=Repository.id == cls.repository_id, lazy="raise"
        )

    @declared_attr
    def to_organization(cls) -> Mapped[Organization]:
        return relationship(
            Organization,
            primaryjoin=Organization.id == cls.organization_id,
            lazy="raise",
        )

    @declared_attr
    def created_by_user(cls) -> Mapped[User | None]:
        return relationship(
            User, primaryjoin=User.id == cls.created_by_user_id, lazy="raise"
        )

    @declared_attr
    def issue(cls) -> Mapped[Issue]:
        return relationship(Issue, primaryjoin=Issue.id == cls.issue_id, lazy="raise")
