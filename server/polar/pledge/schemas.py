from __future__ import annotations

from uuid import UUID
from datetime import datetime
from enum import Enum

from polar.kit.schemas import Schema
from polar.models.pledge import Pledge
from polar.organization.schemas import OrganizationPublicRead
from polar.repository.schemas import RepositoryRead
from polar.issue.schemas import IssueRead


class PledgeState(str, Enum):
    # Initiated by customer. Polar has not received money yet.
    initiated = "initiated"
    # Polar has received the money.
    created = "created"
    # The issue has been closed, awaiting maintainer to confirm the issue is fixed.
    confirmation_pending = "confirmation_pending"
    # The fix was confirmed, but the pledge has not been paid.
    pending = "pending"
    # The pledge has been paid out to the maintainer.
    paid = "paid"
    # The pledge was refunded in full before being paid out.
    refunded = "refunded"
    # The pledge was disputed by the customer (via Polar)
    disputed = "disputed"
    # The charge was disputed by the customer (via Stripe, aka "chargeback")
    charge_disputed = "charge_disputed"

    # The states in which this pledge is "active", i.e. is listed on the issue
    @classmethod
    def active_states(cls) -> list[PledgeState]:
        return [cls.created, cls.confirmation_pending,
                cls.pending, cls.paid, cls.disputed]

    # Happy path:
    # initiated -> created -> confirmation_pending -> pending -> paid

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
        return [cls.created, cls.disputed]

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


class PledgeTransactionType(str, Enum):
    pledge = "pledge"
    transfer = "transfer"
    refund = "refund"
    disputed = "disputed"


class PledgeCreate(Schema):
    issue_id: UUID
    email: str | None = None
    amount: int
    pledge_as_org: UUID | None = None


class PledgeUpdate(Schema):
    email: str | None
    amount: int | None
    pledge_as_org: UUID | None = None


class PledgeMutationResponse(PledgeCreate):
    id: UUID
    state: PledgeState
    fee: int
    amount_including_fee: int
    client_secret: str | None = None

    class Config:
        orm_mode = True


class PledgeRead(Schema):
    id: UUID
    created_at: datetime

    issue_id: UUID
    amount: int

    repository_id: UUID
    organization_id: UUID

    state: PledgeState

    pledger_name: str | None
    pledger_avatar: str | None

    authed_user_can_admin: bool = False
    scheduled_payout_at: datetime | None = None

    @classmethod
    def from_db(cls, o: Pledge) -> PledgeRead:
        pledger_name = None
        pledger_avatar = None
        if o.user:
            pledger_name = o.user.username
            pledger_avatar = o.user.avatar_url
        if o.organization:
            pledger_name = o.organization.name
            pledger_avatar = o.organization.avatar_url

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
        )


class PledgeResources(Schema):
    pledge: PledgeRead | None
    issue: IssueRead | None
    organization: OrganizationPublicRead | None
    repository: RepositoryRead | None
