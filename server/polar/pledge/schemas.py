from __future__ import annotations

from datetime import datetime
from enum import Enum
from typing import Literal, Self
from uuid import UUID

from pydantic import Field

from polar.currency.schemas import CurrencyAmount
from polar.funding.funding_schema import Funding
from polar.issue.schemas import Issue
from polar.kit.schemas import Schema
from polar.models import Organization, User
from polar.models.pledge import Pledge as PledgeModel


# Public API
class PledgeState(str, Enum):
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

    # The states in which this pledge is "active", i.e. is listed on the issue
    @classmethod
    def active_states(cls) -> list[PledgeState]:
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
    def to_created_states(cls) -> list[PledgeState]:
        """
        Allowed states to move into initiated from
        """
        return [cls.initiated]

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
        return [cls.created]

    @classmethod
    def to_disputed_states(cls) -> list[PledgeState]:
        """
        # Allowed states to move into disputed from
        """
        return [cls.created, cls.pending]

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


class PledgeType(str, Enum):
    # Up front pledges, paid to Polar directly, transfered to maintainer when completed.
    pay_upfront = "pay_upfront"

    # Pledge without upfront payment. The pledger pays after the issue is completed.
    pay_on_completion = "pay_on_completion"

    # Pay directly. Money is ready to transfered to maintainer without requiring
    # issue to be completed.
    pay_directly = "pay_directly"

    @classmethod
    def from_str(cls, s: str) -> PledgeType:
        return PledgeType.__members__[s]


class Pledger(Schema):
    name: str
    github_username: str | None
    avatar_url: str | None

    @classmethod
    def from_user(cls, user: User) -> Self:
        return cls(
            name=user.username,
            github_username=user.username,
            avatar_url=user.avatar_url,
        )

    @classmethod
    def from_organization(cls, organization: Organization) -> Self:
        return cls(
            name=organization.name,
            github_username=organization.name,
            avatar_url=organization.avatar_url,
        )


# Public API
class Pledge(Schema):
    id: UUID = Field(description="Pledge ID")
    created_at: datetime = Field(description="When the pledge was created")
    amount: CurrencyAmount = Field(description="Amount pledged towards the issue")
    state: PledgeState = Field(description="Current state of the pledge")
    type: PledgeType = Field(description="Type of pledge")

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

    hosted_invoice_url: str | None = Field(description="URL of invoice for this pledge")

    authed_can_admin_sender: bool = Field(
        default=False,
        description="If the currently authenticated subject can perform admin actions on behalf of the maker of the peldge",  # noqa: E501
    )

    authed_can_admin_received: bool = Field(
        default=False,
        description="If the currently authenticated subject can perform admin actions on behalf of the receiver of the peldge",  # noqa: E501
    )

    @classmethod
    def from_db(cls, o: PledgeModel, include_admin_fields: bool = False) -> Pledge:
        pledger: Pledger | None = None

        if o.by_organization:
            pledger = Pledger(
                name=o.by_organization.name,
                github_username=o.by_organization.name,
                avatar_url=o.by_organization.avatar_url,
            )
        elif o.user:
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
            type=PledgeType.from_str(o.type),
            refunded_at=o.refunded_at if include_admin_fields else None,
            scheduled_payout_at=o.scheduled_payout_at if include_admin_fields else None,
            issue=Issue.from_db(o.issue),
            pledger=pledger,
            hosted_invoice_url=o.invoice_hosted_url if include_admin_fields else None,
        )


class SummaryPledge(Schema):
    type: PledgeType = Field(description="Type of pledge")
    pledger: Pledger | None

    @classmethod
    def from_db(cls, o: PledgeModel) -> SummaryPledge:
        pledger: Pledger | None = None

        if o.by_organization:
            pledger = Pledger(
                name=o.by_organization.name,
                github_username=o.by_organization.name,
                avatar_url=o.by_organization.avatar_url,
            )
        elif o.user:
            pledger = Pledger(
                name=o.user.username,
                github_username=o.user.username,
                avatar_url=o.user.avatar_url,
            )

        return SummaryPledge(
            type=PledgeType.from_str(o.type),
            pledger=pledger,
        )


class PledgePledgesSummary(Schema):
    funding: Funding
    pledges: list[SummaryPledge]


# Internal APIs below


class CreatePledgeFromPaymentIntent(Schema):
    payment_intent_id: str


class CreatePledgePayLater(Schema):
    issue_id: UUID
    amount: int


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
