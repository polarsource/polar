from datetime import datetime
from typing import Self, Literal
from uuid import UUID

from polar.kit.schemas import Schema
from polar.models.pledge import Pledge
from polar.pledge.schemas import PledgeRead, PledgeState
from polar.enums import AccountType


class BackofficePledgeRead(PledgeRead):
    payment_id: str | None
    transfer_id: str | None
    receiver_org_name: str
    issue_title: str
    issue_url: str

    dispute_reason: str | None
    disputed_by_user_id: UUID | None
    disputed_at: datetime | None

    pledger_email: str | None

    to_organization_account_type: AccountType | None

    @classmethod
    def from_db(cls, o: Pledge) -> Self:
        pledger_name = None
        pledger_avatar = None
        if o.user:
            pledger_name = o.user.username
            pledger_avatar = o.user.avatar_url
        if o.by_organization:
            pledger_name = o.by_organization.name
            pledger_avatar = o.by_organization.avatar_url

        to_organization_account_type = None
        if o.to_organization.account is not None:
            to_organization_account_type = o.to_organization.account.account_type

        return cls(
            id=o.id,
            created_at=o.created_at,
            issue_id=o.issue_id,
            repository_id=o.repository_id,
            organization_id=o.organization_id,
            amount=o.amount,
            state=PledgeState.from_str(o.state),
            pledger_name=pledger_name,
            pledger_avatar=pledger_avatar,
            pledger_email=o.email,
            payment_id=o.payment_id,
            transfer_id=o.transfer_id,
            issue_title=o.issue.title,
            issue_url=f"https://github.com/{o.issue.organization.name}/{o.issue.repository.name}/issues/{o.issue.number}",
            receiver_org_name=o.issue.organization.name,
            dispute_reason=o.dispute_reason,
            disputed_at=o.disputed_at,
            disputed_by_user_id=o.disputed_by_user_id,
            scheduled_payout_at=o.scheduled_payout_at,
            to_organization_account_type=to_organization_account_type,
        )


class BackofficeBadge(Schema):
    org_slug: str
    repo_slug: str
    issue_number: int
    action: Literal["embed", "remove"]


class BackofficeBadgeResponse(BackofficeBadge):
    success: bool
