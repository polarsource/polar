import structlog
from fastapi_users.db import SQLAlchemyUserDatabase
from sqlalchemy.orm import subqueryload

from polar.actions.base import Action
from polar.clients import github
from polar.models import Organization, User
from polar.models.user import User
from polar.postgres import AsyncSession, sql
from polar.schema.user import UserCreate, UserUpdate

log = structlog.get_logger()

# Used by fastapi-users as a model manager for User & OAuthAccount
class UserDatabase(SQLAlchemyUserDatabase):
    async def get(self, id: str) -> User | None:
        statement = (
            sql.select(self.user_table)
            .options(
                subqueryload(self.user_table.organization_associations).joinedload(
                    Organization
                )
            )
            .where(self.user_table.id == id)
        )
        return await self._get_user(statement)

    async def get_by_email(self, email: str) -> User | None:
        statement = sql.select(self.user_table).where(
            sql.func.lower(self.user_table.email) == sql.func.lower(email)
        )
        return await self._get_user(statement)

    async def get_by_oauth_account(self, oauth: str, account_id: str) -> User | None:
        if self.oauth_account_table is None:
            raise NotImplementedError()

        statement = (
            sql.select(self.user_table)
            .join(self.oauth_account_table)
            .where(self.oauth_account_table.oauth_name == oauth)
            .where(self.oauth_account_table.account_id == account_id)
        )
        return await self._get_user(statement)


class UserActions(Action[User, UserCreate, UserUpdate]):
    ...


class GithubUserActions(UserActions):
    async def update_profile(
        self, session: AsyncSession, user: User, access_token: str
    ) -> User:
        oauth = user.get_primary_oauth_account()
        if oauth.access_token != access_token:
            log.warning(
                "user.update_profile", error="access_token.mismatch", user_id=user.id
            )
            return user

        client = github.get_client(oauth.access_token)
        request = await client.rest.users.async_get_authenticated()
        if request.status_code != 200:
            log.warning(
                "user.update_profile",
                error="github.http.error",
                user_id=user.id,
                status_code=request.status_code,
            )
            return user

        data = request.json()
        user.profile = {
            "username": data["login"],
            "platform": "github",
            "external_id": data["id"],
            "avatar_url": data["avatar_url"],
            "name": data["name"],
            "bio": data["bio"],
            "company": data["company"],
            "blog": data["blog"],
            "location": data["location"],
            "hireable": data["hireable"],
            "twitter": data["twitter_username"],
            "public_repos": data["public_repos"],
            "public_gists": data["public_gists"],
            "followers": data["followers"],
            "following": data["following"],
            "created_at": data["created_at"],
            "updated_at": data["updated_at"],
        }
        session.add(user)
        # TODO: Check success?
        await session.commit()
        log.info(
            "user.update_profile",
            user_id=user.id,
            github_username=user.profile["username"],
        )
        return user


user = UserActions(User)
github_user = GithubUserActions(User)
