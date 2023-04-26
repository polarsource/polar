from typing import Self
from polar.kit.schemas import Schema
from polar.models.invites import Invite


class InviteRead(Schema):
    code: str
    sent_to_email: str | None = None
    claimed_by_username: str | None = None

    @classmethod
    def from_db(cls, o: Invite) -> Self:
        return cls(
            code=o.code,
            sent_to_email=o.sent_to_email,
            claimed_by_username=o.claimed_by_user.username
            if o.claimed_by and o.claimed_by_user
            else None,
        )
