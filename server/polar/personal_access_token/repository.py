from sqlalchemy import or_
from sqlalchemy.orm import contains_eager

from polar.kit.repository import RepositoryBase, RepositoryTokenHashMixin
from polar.kit.utils import utc_now
from polar.models import PersonalAccessToken, User


class PersonalAccessTokenRepository(
    RepositoryTokenHashMixin[PersonalAccessToken],
    RepositoryBase[PersonalAccessToken],
):
    model = PersonalAccessToken
    token_hash_attribute = "token"

    async def get_by_token(
        self, token: str, *, expired: bool = False
    ) -> PersonalAccessToken | None:
        statement = (
            self.get_base_statement()
            .join(PersonalAccessToken.user)
            .where(
                self.token_hash_clause(token),
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
        personal_access_token = await self.get_one_or_none(statement)
        if personal_access_token is None:
            return None
        return await self.rehash_token(personal_access_token, token)
