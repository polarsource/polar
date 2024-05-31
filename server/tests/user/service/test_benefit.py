import pytest

from polar.auth.models import AuthSubject
from polar.kit.db.postgres import AsyncSession
from polar.kit.pagination import PaginationParams
from polar.kit.sorting import Sorting
from polar.models import Benefit, Subscription, User
from polar.user.service.benefit import SortProperty
from polar.user.service.benefit import user_benefit as user_benefit_service
from tests.fixtures.database import SaveFixture
from tests.fixtures.random_objects import create_benefit_grant


@pytest.mark.asyncio
@pytest.mark.skip_db_asserts
class TestList:
    @pytest.mark.auth
    async def test_other_user(
        self,
        auth_subject: AuthSubject[User],
        save_fixture: SaveFixture,
        session: AsyncSession,
        subscription: Subscription,
        benefit_organization: Benefit,
        user_second: User,
    ) -> None:
        await create_benefit_grant(
            save_fixture,
            user_second,
            benefit_organization,
            granted=True,
            subscription=subscription,
        )

        orders, count = await user_benefit_service.list(
            session, auth_subject, pagination=PaginationParams(1, 10)
        )

        assert count == 0
        assert len(orders) == 0

    @pytest.mark.auth
    async def test_user(
        self,
        auth_subject: AuthSubject[User],
        save_fixture: SaveFixture,
        session: AsyncSession,
        subscription: Subscription,
        benefit_organization: Benefit,
        benefit_organization_second: Benefit,
        user: User,
    ) -> None:
        await create_benefit_grant(
            save_fixture,
            user,
            benefit_organization,
            granted=True,
            subscription=subscription,
        )

        await create_benefit_grant(
            save_fixture,
            user,
            benefit_organization_second,
            granted=False,
            subscription=subscription,
        )

        orders, count = await user_benefit_service.list(
            session, auth_subject, pagination=PaginationParams(1, 10)
        )

        assert count == 1
        assert len(orders) == 1

    @pytest.mark.parametrize(
        "sorting",
        [
            [("granted_at", True)],
            [("type", True)],
            [("organization", False)],
            [("order", False)],
            [("subscription", False)],
        ],
    )
    @pytest.mark.auth
    async def test_sorting(
        self,
        sorting: list[Sorting[SortProperty]],
        auth_subject: AuthSubject[User],
        save_fixture: SaveFixture,
        session: AsyncSession,
        subscription: Subscription,
        benefit_organization: Benefit,
        user: User,
    ) -> None:
        await create_benefit_grant(
            save_fixture,
            user,
            benefit_organization,
            granted=True,
            subscription=subscription,
        )

        orders, count = await user_benefit_service.list(
            session, auth_subject, pagination=PaginationParams(1, 10), sorting=sorting
        )

        assert count == 1
        assert len(orders) == 1


@pytest.mark.asyncio
@pytest.mark.skip_db_asserts
class TestGetById:
    @pytest.mark.auth
    async def test_other_user(
        self,
        auth_subject: AuthSubject[User],
        save_fixture: SaveFixture,
        session: AsyncSession,
        subscription: Subscription,
        benefit_organization: Benefit,
        user_second: User,
    ) -> None:
        await create_benefit_grant(
            save_fixture,
            user_second,
            benefit_organization,
            granted=True,
            subscription=subscription,
        )
        result = await user_benefit_service.get_by_id(
            session, auth_subject, benefit_organization.id
        )
        assert result is None

    @pytest.mark.auth
    async def test_user_revoled(
        self,
        auth_subject: AuthSubject[User],
        save_fixture: SaveFixture,
        session: AsyncSession,
        subscription: Subscription,
        benefit_organization: Benefit,
        user: User,
    ) -> None:
        await create_benefit_grant(
            save_fixture,
            user,
            benefit_organization,
            granted=False,
            subscription=subscription,
        )

        result = await user_benefit_service.get_by_id(
            session, auth_subject, benefit_organization.id
        )

        assert result is None

    @pytest.mark.auth
    async def test_user_granted(
        self,
        auth_subject: AuthSubject[User],
        save_fixture: SaveFixture,
        session: AsyncSession,
        subscription: Subscription,
        benefit_organization: Benefit,
        user: User,
    ) -> None:
        await create_benefit_grant(
            save_fixture,
            user,
            benefit_organization,
            granted=True,
            subscription=subscription,
        )

        result = await user_benefit_service.get_by_id(
            session, auth_subject, benefit_organization.id
        )

        assert result is not None
        assert result.id == benefit_organization.id
