from sqlalchemy import or_
from sqlalchemy.orm import contains_eager

from polar.kit.crypto import get_token_hash
from polar.kit.repository import RepositoryBase
from polar.kit.utils import utc_now
from polar.models import PersonalAccessToken, User


class PersonalAccessTokenRepository(RepositoryBase[PersonalAccessToken]):
    model = PersonalAccessToken

    async def get_by_token(
        self, token: str, *, expired: bool = False
    ) -> PersonalAccessToken | None:
        statement = (
            self.get_base_statement()
            .join(PersonalAccessToken.user)
            .where(
                PersonalAccessToken.token_v2 == get_token_hash(token),
                ~PersonalAccessToken.is_deleted,
                User.can_authenticate,
            )
            .options(contains_eager(PersonalAccessToken.user))
        )
        if not expired:
            statement = statement.where(
                or_(
                    PersonalAccessToken.expires_at.is_(None),
                    PersonalAccessToken.expires_at > utc_now(),
                )
            )
        return await self.get_one_or_none(statement)
