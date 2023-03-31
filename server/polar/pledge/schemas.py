from __future__ import annotations

from uuid import UUID
from datetime import datetime
from enum import Enum

from polar.kit.schemas import Schema
from polar.models.organization import Organization
from polar.models.pledge import Pledge
from polar.models.user import User
from polar.organization.schemas import OrganizationRead
from polar.repository.schemas import RepositoryRead
from polar.issue.schemas import IssueRead


class State(str, Enum):
    initiated = "initiated"  # Initiated by customer. Polar has not received money yet.
    created = "created"  # Polar has received the money.
    pending = "pending"  # The issue has been closed, but the pledge has not been paid.
    paid = "paid"  # The pledge has been paid out to the maintainer.

    # Alpha flow: initiated -> created -> pending -> paid
    # In the future, we might have a "disputed", "refunded", "cancelled" states etc...


class PledgeCreate(Schema):
    issue_id: UUID
    email: str | None = None
    amount: int
    pledge_as_org: UUID | None = None


class PledgeUpdate(Schema):
    email: str | None
    amount: int | None


class PledgeRead(Schema):
    id: UUID
    created_at: datetime

    issue_id: UUID
    amount: int

    repository_id: UUID
    organization_id: UUID

    state: State

    pledger_name: str | None
    pledger_avatar: str | None

    # TODO: Move to a different object? This is only used during the pledge creation flow
    client_secret: str | None

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
            state=o.state,
            pledger_name=pledger_name,
            pledger_avatar=pledger_avatar,
        )


class PledgeResources(Schema):
    pledge: PledgeRead | None
    issue: IssueRead | None
    organization: OrganizationRead | None
    repository: RepositoryRead | None
