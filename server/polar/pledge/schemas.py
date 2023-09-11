from __future__ import annotations

from datetime import datetime
from enum import Enum
from typing import Literal
from uuid import UUID

from pydantic import Field

from polar.currency.schemas import CurrencyAmount
from polar.issue.schemas import Issue
from polar.kit.schemas import Schema
from polar.models.pledge import Pledge as PledgeModel


# Public API
class PledgeState(str, Enum):
    # Initiated by customer. Polar has not received money yet.
    initiated = "initiated"
    # Polar has received the money.
    created = "created"
    # The issue has been closed, awaiting maintainer to confirm the issue is fixed.
    confirmation_pending = "confirmation_pending"
    # The fix was confirmed, and rewards have been created.
    # See issue rewards to track payment status.
    pending = "pending"
    # The pledge was refunded in full before being paid out.
    refunded = "refunded"
    # The pledge was disputed by the customer (via Polar)
    disputed = "disputed"
    # The charge was disputed by the customer (via Stripe, aka "chargeback")
    charge_disputed = "charge_disputed"

    # The states in which this pledge is "active", i.e. is listed on the issue
    @classmethod
    def active_states(cls) -> list[PledgeState]:
        return [
            cls.created,
            cls.confirmation_pending,
            cls.pending,
            cls.disputed,
        ]

    # Happy path:
    # initiated -> created -> confirmation_pending -> pending

    @classmethod
    def to_created_states(cls) -> list[PledgeState]:
        """
        Allowed states to move into initiated from
        """
        return [cls.initiated, cls.confirmation_pending]

    @classmethod
    def to_confirmation_pending_states(cls) -> list[PledgeState]:
        """
        Allowed states to move into confirmation pending from
        """
        return [cls.created]

    @classmethod
    def to_pending_states(cls) -> list[PledgeState]:
        """
        Allowed states to move into pending from
        """
        return [cls.created, cls.confirmation_pending]

    @classmethod
    def to_disputed_states(cls) -> list[PledgeState]:
        """
        Allowed states to move into disputed from
        """
        return [cls.created, cls.confirmation_pending, cls.pending]

    @classmethod
    def to_paid_states(cls) -> list[PledgeState]:
        """
        Allowed states to move into paid from
        """
        return [cls.pending]

    @classmethod
    def to_refunded_states(cls) -> list[PledgeState]:
        """
        Allowed states to move into refunded from
        """
        return [cls.created, cls.pending, cls.disputed]

    @classmethod
    def from_str(cls, s: str) -> PledgeState:
        return PledgeState.__members__[s]


class Pledger(Schema):
    name: str
    github_username: str | None
    avatar_url: str | None


# Public API
class Pledge(Schema):
    id: UUID = Field(description="Pledge ID")
    created_at: datetime = Field(description="When the pledge was created")
    amount: CurrencyAmount = Field(description="Amount pledged towards the issue")
    state: PledgeState = Field(description="Current state of the pledge")

    refunded_at: datetime | None = Field(
        description="If and when the pledge was refunded to the pledger"
    )  # noqa: E501

    scheduled_payout_at: datetime | None = Field(
        description="When the payout is scheduled to be made to the maintainers behind the issue. Disputes must be made before this date."  # noqa: E501
    )

    issue: Issue = Field(description="The issue that the pledge was made towards")

    pledger: Pledger | None = Field(
        description="The user or organization that made this pledge"
    )

    @classmethod
    def from_db(cls, o: PledgeModel) -> Pledge:
        pledger: Pledger | None = None

        if o.by_organization_id:
            pledger = Pledger(
                name=o.by_organization.pretty_name or o.by_organization.name,
                github_username=o.by_organization.name,
                avatar_url=o.by_organization.avatar_url,
            )

        if o.by_user_id:
            pledger = Pledger(
                name=o.user.username,
                github_username=o.user.username,
                avatar_url=o.user.avatar_url,
            )

        return Pledge(
            id=o.id,
            created_at=o.created_at,
            amount=CurrencyAmount(currency="USD", amount=o.amount),
            state=PledgeState.from_str(o.state),
            refunded_at=o.refunded_at,
            scheduled_payout_at=o.scheduled_payout_at,
            issue=Issue.from_db(o.issue),
            pledger=pledger,
        )


# Internal APIs below


class CreatePledgeFromPaymentIntent(Schema):
    payment_intent_id: str


class PledgeTransactionType(str, Enum):
    pledge = "pledge"
    transfer = "transfer"
    refund = "refund"
    disputed = "disputed"


class PledgeStripePaymentIntentCreate(Schema):
    issue_id: UUID
    email: str
    amount: int
    setup_future_usage: Literal["on_session"] | None


class PledgeStripePaymentIntentUpdate(Schema):
    email: str
    amount: int
    setup_future_usage: Literal["on_session"] | None


class PledgeStripePaymentIntentMutationResponse(Schema):
    # pledge_id: UUID
    payment_intent_id: str
    # state: PledgeState
    amount: int
    fee: int
    amount_including_fee: int
    client_secret: str | None = None


class PledgeRead(Schema):
    id: UUID
    created_at: datetime

    issue_id: UUID
    amount: int

    repository_id: UUID
    organization_id: UUID

    pledger_user_id: UUID | None = None

    state: PledgeState

    pledger_name: str | None
    pledger_avatar: str | None

    authed_user_can_admin: bool = False  # deprecated
    scheduled_payout_at: datetime | None = None
    paid_at: datetime | None = None
    refunded_at: datetime | None = None

    # If the user can admin the _sending_ of the pledge (disputing, etc)
    authed_user_can_admin_sender: bool = False

    # If the user can admin the _receiving_ of the pledge (confirm it, manage payouts, ...)  # noqa: E501
    authed_user_can_admin_received: bool = False

    @classmethod
    def from_db(cls, o: PledgeModel) -> PledgeRead:
        pledger_name = None
        pledger_avatar = None
        if o.user:
            pledger_name = o.user.username
            pledger_avatar = o.user.avatar_url
        if o.by_organization:
            pledger_name = o.by_organization.name
            pledger_avatar = o.by_organization.avatar_url

        return PledgeRead(
            id=o.id,
            created_at=o.created_at,
            issue_id=o.issue_id,
            repository_id=o.repository_id,
            organization_id=o.organization_id,
            amount=o.amount,
            state=PledgeState.from_str(o.state),
            pledger_name=pledger_name,
            pledger_avatar=pledger_avatar,
            scheduled_payout_at=o.scheduled_payout_at,
            pledger_user_id=o.by_user_id,
        )
