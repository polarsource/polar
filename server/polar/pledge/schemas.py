from __future__ import annotations

from datetime import datetime
from enum import Enum
from typing import Any, Literal, Self
from uuid import UUID

from pydantic import Field, root_validator

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
    def from_pledge(cls, p: PledgeModel) -> Self | None:
        if p.on_behalf_of_organization:
            return cls(
                name=p.on_behalf_of_organization.pretty_name
                or p.on_behalf_of_organization.name,
                github_username=p.on_behalf_of_organization.name,
                avatar_url=p.on_behalf_of_organization.avatar_url,
            )

        if p.user:
            return cls(
                name=p.user.username,
                github_username=p.user.username,
                avatar_url=p.user.avatar_url,
            )

        if p.by_organization:
            return cls(
                name=p.by_organization.pretty_name or p.by_organization.name,
                github_username=p.by_organization.name,
                avatar_url=p.by_organization.avatar_url,
            )

        return None

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

    created_by: Pledger | None = Field(
        description="For pledges made by an organization, or on behalf of an organization. This is the user that made the pledge. Only visible for members of said organization."  # noqa: E501
    )

    @classmethod
    def from_db(
        cls,
        o: PledgeModel,
        include_admin_fields: bool = False,
        include_org_fields: bool = False,
    ) -> Pledge:
        return Pledge(
            id=o.id,
            created_at=o.created_at,
            amount=CurrencyAmount(currency="USD", amount=o.amount),
            state=PledgeState.from_str(o.state),
            type=PledgeType.from_str(o.type),
            refunded_at=o.refunded_at if include_admin_fields else None,
            scheduled_payout_at=o.scheduled_payout_at if include_admin_fields else None,
            issue=Issue.from_db(o.issue),
            pledger=Pledger.from_pledge(o),
            hosted_invoice_url=o.invoice_hosted_url if include_admin_fields else None,
            created_by=Pledger.from_user(o.created_by_user)
            if o.created_by_user and include_org_fields
            else None,
        )


class SummaryPledge(Schema):
    type: PledgeType = Field(description="Type of pledge")
    pledger: Pledger | None

    @classmethod
    def from_db(cls, o: PledgeModel) -> SummaryPledge:
        return SummaryPledge(
            type=PledgeType.from_str(o.type),
            pledger=Pledger.from_pledge(o),
        )


class PledgePledgesSummary(Schema):
    funding: Funding
    pledges: list[SummaryPledge]


# Internal APIs below


class CreatePledgeFromPaymentIntent(Schema):
    payment_intent_id: str


class CreatePledgePayLater(Schema):
    issue_id: UUID
    amount: int = Field(gt=0)
    on_behalf_of_organization_id: UUID | None = Field(
        description="The organization to give credit to. The pledge will be paid by the authenticated user."
    )
    by_organization_id: UUID | None = Field(
        description="The organization to create the pledge as. The pledge will be paid by this organization."
    )

    @root_validator(skip_on_failure=True)
    def validate_payer(cls, values: dict[str, Any]) -> dict[str, Any]:
        on_behalf_of_organization_id: UUID | None = values[
            "on_behalf_of_organization_id"
        ]
        by_organization_id: UUID | None = values["by_organization_id"]

        if on_behalf_of_organization_id and by_organization_id:
            raise ValueError(
                "on_behalf_of_organization_id and by_organization_id are mutually exclusive"
            )

        return values


class PledgeTransactionType(str, Enum):
    pledge = "pledge"
    transfer = "transfer"
    refund = "refund"
    disputed = "disputed"


class PledgeStripePaymentIntentCreate(Schema):
    issue_id: UUID
    email: str
    amount: int = Field(gt=0)
    setup_future_usage: Literal["on_session"] | None = Field(
        description="If the payment method should be saved for future usage."
    )
    on_behalf_of_organization_id: UUID | None = Field(
        description="The organization to give credit to. The pledge will be paid by the authenticated user."
    )


class PledgeStripePaymentIntentUpdate(Schema):
    email: str
    amount: int = Field(
        gt=0,
    )
    setup_future_usage: Literal["on_session"] | None = Field(
        description="If the payment method should be saved for future usage."
    )
    on_behalf_of_organization_id: UUID | None = Field(
        description="The organization to give credit to. The pledge will be paid by the authenticated user."
    )


class PledgeStripePaymentIntentMutationResponse(Schema):
    payment_intent_id: str
    amount: int
    fee: int
    amount_including_fee: int
    client_secret: str | None = None
