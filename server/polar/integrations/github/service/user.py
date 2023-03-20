import structlog

from polar.models import User
from polar.postgres import AsyncSession
from polar.user.service import UserService

from .. import client as github

log = structlog.get_logger()


class GithubUserService(UserService):
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
        response = await client.rest.users.async_get_authenticated()
        try:
            github.ensure_expected_response(response)
        except github.UnexpectedStatusCode:
            log.warning(
                "user.update_profile",
                error="github.http.error",
                user_id=user.id,
                status_code=response.status_code,
            )
            return user

        data = response.json()
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

    async def accessable_orgs(self, session: AsyncSession, user: User) -> None:

        client = await github.get_user_client(session, user)

        return

        # oauth = user.get_primary_oauth_account()

        # app_client = github.get_app_client()
        # app_client.rest.apps.get

        client = github.get_client(oauth.access_token)

        page = 1

        try:

            # https://docs.github.com/en/rest/apps/installations?apiVersion=2022-11-28#list-app-installations-accessible-to-the-user-access-token
            installations = (
                await client.rest.apps.async_list_installations_for_authenticated_user(
                    per_page=30, page=page
                )
            )
            for i in installations.parsed_data.installations:
                log.warn("found installation", i=i)
        except Exception as e:
            log.error(
                "github error",
                e=e,
                token=oauth.access_token,
            )


github_user = GithubUserService(User)
