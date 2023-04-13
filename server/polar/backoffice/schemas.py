from typing import Self
from polar.models.pledge import Pledge
from polar.pledge.schemas import PledgeRead, State


class BackofficePledgeRead(PledgeRead):
    payment_id: str | None
    transfer_id: str | None
    receiver_org_name: str
    issue_title: str
    issue_url: str

    @classmethod
    def from_db(cls, o: Pledge) -> Self:
        pledger_name = None
        pledger_avatar = None
        if o.user:
            pledger_name = o.user.username
            pledger_avatar = o.user.avatar_url
        if o.organization:
            pledger_name = o.organization.name
            pledger_avatar = o.organization.avatar_url

        return cls(
            id=o.id,
            created_at=o.created_at,
            issue_id=o.issue_id,
            repository_id=o.repository_id,
            organization_id=o.organization_id,
            amount=o.amount,
            state=State.from_str(o.state),
            pledger_name=pledger_name,
            pledger_avatar=pledger_avatar,
            payment_id=o.payment_id,
            transfer_id=o.transfer_id,
            issue_title=o.issue.title,
            issue_url=f"https://github.com/{o.issue.organization.name}/{o.issue.repository.name}/issues/{o.issue.number}",
            receiver_org_name=o.issue.organization.name,
        )
