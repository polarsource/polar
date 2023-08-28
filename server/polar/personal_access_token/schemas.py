from datetime import datetime
from typing import Self
from uuid import UUID

from polar.kit.schemas import Schema
from polar.models.personal_access_token import (
    PersonalAccessToken as PersonalAccessTokenModel,
)


class PersonalAccessToken(Schema):
    id: UUID
    created_at: datetime
    last_used_at: datetime | None
    expires_at: datetime
    comment: str

    @classmethod
    def from_db(cls, p: PersonalAccessTokenModel) -> Self:
        return cls(
            id=p.id,
            created_at=p.created_at,
            last_used_at=p.last_used_at,
            expires_at=p.expires_at,
            comment=p.comment,
        )


class CreatePersonalAccessToken(Schema):
    comment: str


class CreatePersonalAccessTokenResponse(PersonalAccessToken):
    token: str
