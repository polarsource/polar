from typing import Self
from datetime import datetime

from polar.kit.schemas import Schema
from polar.models.invites import Invite


class InviteRead(Schema):
    code: str
    created_by_username: str | None = None
    claimed_by_username: str | None = None
    note: str | None = None
    created_at: datetime

    @classmethod
    def from_db(cls, o: Invite) -> Self:
        claimed_by = None
        if o.claimed_by and o.claimed_by_user:
            claimed_by = o.claimed_by_user.username

        return cls(
            created_at=o.created_at,
            code=o.code,
            created_by_username=o.created_by_user.username,
            claimed_by_username=claimed_by,
            note=o.note,
        )


class InviteCreate(Schema):
    note: str | None = None
