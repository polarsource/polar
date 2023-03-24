import structlog
from sqlalchemy.orm import joinedload

from polar.kit.services import ResourceService
from polar.models import User, OAuthAccount
from polar.postgres import AsyncSession, sql

from .schemas import UserCreate, UserUpdate

log = structlog.get_logger()


class UserService(ResourceService[User, UserCreate, UserUpdate]):
    async def get_oauth_account_by_account_id(
        self, session: AsyncSession, *, oauth_name: str, account_id: str
    ) -> OAuthAccount | None:
        query = (
            sql.select(OAuthAccount)
            .options(joinedload(OAuthAccount.user, innerjoin=True))
            .where(
                OAuthAccount.oauth_name == oauth_name,
                OAuthAccount.account_id == str(account_id),
            )
        )
        res = await session.execute(query)
        account = res.scalars().first()
        if account:
            return account
        return None


user = UserService(User)
