import uuid
from collections.abc import Callable
from datetime import timedelta
from typing import Any

import pytest
from sqlalchemy import Select, select

from polar.kit.utils import utc_now
from polar.models import OAuthAccount, User
from polar.models.user import OAuthPlatform
from polar.postgres import AsyncSession
from polar.user.repository import UserRepository
from tests.fixtures.database import SaveFixture
from tests.fixtures.random_objects import create_user


@pytest.mark.asyncio
class TestPaginateHasMore:
    @pytest.mark.parametrize(
        "build_statement",
        [
            pytest.param(
                lambda: select(User).outerjoin(User.oauth_accounts),
                id="one_to_many_join",
            ),
            pytest.param(
                lambda: (
                    select(User)
                    .select_from(OAuthAccount)
                    .join(User, OAuthAccount.user_id == User.id)
                ),
                id="model_on_the_joined_side",
            ),
        ],
    )
    async def test_join_matching_several_rows_per_entity(
        self,
        build_statement: Callable[[], Select[Any]],
        save_fixture: SaveFixture,
        session: AsyncSession,
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
            build_statement()
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

    async def test_ties_on_the_sort_key(
        self, save_fixture: SaveFixture, session: AsyncSession
    ) -> None:
        created_at = utc_now() - timedelta(days=1)
        users = [await create_user(save_fixture) for _ in range(12)]
        for user in users:
            user.created_at = created_at
        await session.flush()

        repository = UserRepository.from_session(session)
        statement = (
            select(User)
            .where(User.id.in_([user.id for user in users]))
            .order_by(User.created_at.desc())
        )

        paged_ids: list[uuid.UUID] = []
        for page in range(1, 5):
            items, has_more = await repository.paginate_has_more(
                statement, limit=3, page=page
            )
            paged_ids.extend(item.id for item in items)
            assert has_more is (page < 4)

        assert sorted(paged_ids) == sorted(user.id for user in users)
