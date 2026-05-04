from sqlalchemy import select
from sqlalchemy.orm import joinedload

from polar.kit.repository import RepositoryBase
from polar.kit.utils import utc_now
from polar.models import LoginCode


class LoginCodeRepository(RepositoryBase[LoginCode]):
    model = LoginCode

    async def get_by_code_for_update(
        self, code_hash: str, email: str
    ) -> LoginCode | None:
        statement = (
            select(LoginCode)
            .where(
                LoginCode.code_hash == code_hash,
                LoginCode.email == email,
                LoginCode.expires_at > utc_now(),
            )
            .options(joinedload(LoginCode.user))
            .with_for_update(nowait=True, of=LoginCode)
        )
        return await self.get_one_or_none(statement)
