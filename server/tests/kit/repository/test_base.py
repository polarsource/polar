import pytest
from sqlalchemy import select

from polar.models import OAuthAccount, User
from polar.models.user import OAuthPlatform
from polar.postgres import AsyncSession
from polar.user.repository import UserRepository
from tests.fixtures.database import SaveFixture
from tests.fixtures.random_objects import create_user


@pytest.mark.asyncio
class TestPaginateHasMore:
    async def test_join_matching_several_rows_per_entity(
        self, save_fixture: SaveFixture, session: AsyncSession
    ) -> None:
        users = [await create_user(save_fixture) for _ in range(2)]
        for user in users:
            for platform in (OAuthPlatform.github, OAuthPlatform.google):
                oauth_account = OAuthAccount(
                    platform=platform,
                    account_id=f"{platform}-{user.id}",
                    account_email=user.email,
                    user=user,
                )
                await oauth_account.set_tokens(access_token="token", refresh_token=None)
                await save_fixture(oauth_account)
        first_user, second_user = sorted(users, key=lambda user: user.id)

        repository = UserRepository.from_session(session)
        statement = (
            select(User)
            .outerjoin(User.oauth_accounts)
            .where(User.id.in_([user.id for user in users]))
            .order_by(User.id)
        )

        first_page, first_has_more = await repository.paginate_has_more(
            statement, limit=1, page=1
        )
        second_page, second_has_more = await repository.paginate_has_more(
            statement, limit=1, page=2
        )

        assert first_page == [first_user]
        assert first_has_more is True
        assert second_page == [second_user]
        assert second_has_more is False
