from __future__ import annotations

from uuid import UUID
from datetime import datetime
from enum import Enum

from polar.kit.schemas import Schema
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


class PledgeRead(PledgeCreate):
    id: UUID
    created_at: datetime

    repository_id: UUID
    organization_id: UUID

    state: State

    client_secret: str | None

    class Config:
        orm_mode = True


class PledgeResources(Schema):
    pledge: PledgeRead | None
    issue: IssueRead | None
    organization: OrganizationRead | None
    repository: RepositoryRead | None
