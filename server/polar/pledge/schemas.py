from __future__ import annotations

from datetime import datetime
from typing import Literal, Self
from uuid import UUID

from pydantic import Field, model_validator

from polar.currency.schemas import CurrencyAmount
from polar.funding.funding_schema import Funding
from polar.issue.schemas import Issue
from polar.kit.schemas import Schema
from polar.models import Organization, User
from polar.models.pledge import Pledge as PledgeModel
from polar.models.pledge import PledgeState, PledgeType


# Public API
class Pledger(Schema):
    name: str
    github_username: str | None = None
    avatar_url: str | None = None

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
                name=p.user.username_or_email,
                github_username=p.user.github_username,
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
            name=user.username_or_email,
            github_username=user.github_username,
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
        None, description="If and when the pledge was refunded to the pledger"
    )  # noqa: E501

    scheduled_payout_at: datetime | None = Field(
        None,
        description="When the payout is scheduled to be made to the maintainers behind the issue. Disputes must be made before this date.",  # noqa: E501
    )

    issue: Issue = Field(description="The issue that the pledge was made towards")

    pledger: Pledger | None = Field(
        None, description="The user or organization that made this pledge"
    )

    hosted_invoice_url: str | None = Field(
        None, description="URL of invoice for this pledge"
    )

    authed_can_admin_sender: bool = Field(
        default=False,
        description="If the currently authenticated subject can perform admin actions on behalf of the maker of the peldge",  # noqa: E501
    )

    authed_can_admin_received: bool = Field(
        default=False,
        description="If the currently authenticated subject can perform admin actions on behalf of the receiver of the peldge",  # noqa: E501
    )

    created_by: Pledger | None = Field(
        None,
        description="For pledges made by an organization, or on behalf of an organization. This is the user that made the pledge. Only visible for members of said organization.",  # noqa: E501
    )

    @classmethod
    def from_db(
        cls,
        o: PledgeModel,
        *,
        include_receiver_admin_fields: bool = False,
        include_sender_admin_fields: bool = False,
        include_sender_fields: bool = False,
    ) -> Pledge:
        return Pledge(
            id=o.id,
            created_at=o.created_at,
            amount=CurrencyAmount(currency="USD", amount=o.amount),
            state=PledgeState.from_str(o.state),
            type=PledgeType.from_str(o.type),
            #
            refunded_at=o.refunded_at
            if include_sender_admin_fields or include_receiver_admin_fields
            else None,
            #
            scheduled_payout_at=o.scheduled_payout_at
            if include_receiver_admin_fields
            else None,
            #
            issue=Issue.from_db(o.issue),
            pledger=Pledger.from_pledge(o),
            #
            hosted_invoice_url=o.invoice_hosted_url
            if include_sender_admin_fields
            else None,
            #
            created_by=Pledger.from_user(o.created_by_user)
            if o.created_by_user and include_sender_fields
            else None,
        )


class SummaryPledge(Schema):
    type: PledgeType = Field(description="Type of pledge")
    pledger: Pledger | None = None

    @classmethod
    def from_db(cls, o: PledgeModel) -> SummaryPledge:
        return SummaryPledge(
            type=PledgeType.from_str(o.type),
            pledger=Pledger.from_pledge(o),
        )


class PledgePledgesSummary(Schema):
    funding: Funding
    pledges: list[SummaryPledge]


class PledgeSpending(Schema):
    amount: CurrencyAmount


# Internal APIs below

# Ref: https://stripe.com/docs/api/payment_intents/object#payment_intent_object-amount
MAXIMUM_AMOUNT = 99999999


class CreatePledgeFromPaymentIntent(Schema):
    payment_intent_id: str


class CreatePledgePayLater(Schema):
    issue_id: UUID
    amount: int = Field(gt=0, le=MAXIMUM_AMOUNT)
    on_behalf_of_organization_id: UUID | None = Field(
        None,
        description="The organization to give credit to. The pledge will be paid by the authenticated user.",
    )
    by_organization_id: UUID | None = Field(
        None,
        description="The organization to create the pledge as. The pledge will be paid by this organization.",
    )

    @model_validator(mode="after")
    def validate_payer(self) -> Self:
        if self.on_behalf_of_organization_id and self.by_organization_id:
            raise ValueError(
                "on_behalf_of_organization_id and by_organization_id are mutually exclusive"
            )

        return self


class PledgeStripePaymentIntentCreate(Schema):
    issue_id: UUID
    email: str
    amount: int = Field(gt=0, le=MAXIMUM_AMOUNT)
    setup_future_usage: Literal["on_session"] | None = Field(
        None, description="If the payment method should be saved for future usage."
    )
    on_behalf_of_organization_id: UUID | None = Field(
        None,
        description="The organization to give credit to. The pledge will be paid by the authenticated user.",
    )


class PledgeStripePaymentIntentUpdate(Schema):
    email: str
    amount: int = Field(gt=0, le=MAXIMUM_AMOUNT)
    setup_future_usage: Literal["on_session"] | None = Field(
        None, description="If the payment method should be saved for future usage."
    )
    on_behalf_of_organization_id: UUID | None = Field(
        None,
        description="The organization to give credit to. The pledge will be paid by the authenticated user.",
    )


class PledgeStripePaymentIntentMutationResponse(Schema):
    payment_intent_id: str
    amount: int
    fee: int
    amount_including_fee: int
    client_secret: str | None = None
