import pytest

from polar.auth.models import AuthSubject
from polar.customer_portal.service.benefit_grant import CustomerBenefitGrantSortProperty
from polar.customer_portal.service.benefit_grant import (
    customer_benefit_grant as customer_benefit_grant_service,
)
from polar.kit.db.postgres import AsyncSession
from polar.kit.pagination import PaginationParams
from polar.kit.sorting import Sorting
from polar.models import Benefit, Customer, Subscription
from tests.fixtures.auth import AuthSubjectFixture
from tests.fixtures.database import SaveFixture
from tests.fixtures.random_objects import create_benefit_grant


@pytest.mark.asyncio
@pytest.mark.skip_db_asserts
class TestList:
    @pytest.mark.auth(AuthSubjectFixture(subject="customer"))
    async def test_other_customer(
        self,
        auth_subject: AuthSubject[Customer],
        save_fixture: SaveFixture,
        session: AsyncSession,
        subscription: Subscription,
        benefit_organization: Benefit,
        customer_second: Customer,
    ) -> None:
        await create_benefit_grant(
            save_fixture,
            customer_second,
            benefit_organization,
            granted=True,
            subscription=subscription,
        )

        grants, count = await customer_benefit_grant_service.list(
            session, auth_subject, pagination=PaginationParams(1, 10)
        )

        assert count == 0
        assert len(grants) == 0

    @pytest.mark.auth(AuthSubjectFixture(subject="customer"))
    async def test_customer(
        self,
        auth_subject: AuthSubject[Customer],
        save_fixture: SaveFixture,
        session: AsyncSession,
        subscription: Subscription,
        benefit_organization: Benefit,
        benefit_organization_second: Benefit,
        customer: Customer,
    ) -> None:
        await create_benefit_grant(
            save_fixture,
            customer,
            benefit_organization,
            granted=True,
            subscription=subscription,
        )

        await create_benefit_grant(
            save_fixture,
            customer,
            benefit_organization_second,
            granted=False,
            subscription=subscription,
        )

        grants, count = await customer_benefit_grant_service.list(
            session, auth_subject, pagination=PaginationParams(1, 10)
        )

        assert count == 2
        assert len(grants) == 2

    @pytest.mark.parametrize(
        "sorting",
        [
            [("granted_at", True)],
            [("type", True)],
            [("organization", False)],
        ],
    )
    @pytest.mark.auth(AuthSubjectFixture(subject="customer"))
    async def test_sorting(
        self,
        sorting: list[Sorting[CustomerBenefitGrantSortProperty]],
        auth_subject: AuthSubject[Customer],
        save_fixture: SaveFixture,
        session: AsyncSession,
        subscription: Subscription,
        benefit_organization: Benefit,
        customer: Customer,
    ) -> None:
        await create_benefit_grant(
            save_fixture,
            customer,
            benefit_organization,
            granted=True,
            subscription=subscription,
        )

        grants, count = await customer_benefit_grant_service.list(
            session, auth_subject, pagination=PaginationParams(1, 10), sorting=sorting
        )

        assert count == 1
        assert len(grants) == 1


@pytest.mark.asyncio
@pytest.mark.skip_db_asserts
class TestGetById:
    @pytest.mark.auth(AuthSubjectFixture(subject="customer"))
    async def test_other_customer(
        self,
        auth_subject: AuthSubject[Customer],
        save_fixture: SaveFixture,
        session: AsyncSession,
        subscription: Subscription,
        benefit_organization: Benefit,
        customer_second: Customer,
    ) -> None:
        grant = await create_benefit_grant(
            save_fixture,
            customer_second,
            benefit_organization,
            granted=True,
            subscription=subscription,
        )
        result = await customer_benefit_grant_service.get_by_id(
            session, auth_subject, grant.id
        )
        assert result is None

    @pytest.mark.auth(AuthSubjectFixture(subject="customer"))
    async def test_customer_revoked(
        self,
        auth_subject: AuthSubject[Customer],
        save_fixture: SaveFixture,
        session: AsyncSession,
        subscription: Subscription,
        benefit_organization: Benefit,
        customer: Customer,
    ) -> None:
        grant = await create_benefit_grant(
            save_fixture,
            customer,
            benefit_organization,
            granted=False,
            subscription=subscription,
        )

        result = await customer_benefit_grant_service.get_by_id(
            session, auth_subject, grant.id
        )

        assert result is not None
        assert result.is_revoked

    @pytest.mark.auth(AuthSubjectFixture(subject="customer"))
    async def test_customer_granted(
        self,
        auth_subject: AuthSubject[Customer],
        save_fixture: SaveFixture,
        session: AsyncSession,
        subscription: Subscription,
        benefit_organization: Benefit,
        customer: Customer,
        customer_second: Customer,
    ) -> None:
        customer_grant = await create_benefit_grant(
            save_fixture,
            customer,
            benefit_organization,
            granted=True,
            subscription=subscription,
        )
        await create_benefit_grant(
            save_fixture,
            customer_second,
            benefit_organization,
            granted=True,
            subscription=subscription,
        )

        session.expunge_all()

        result = await customer_benefit_grant_service.get_by_id(
            session, auth_subject, customer_grant.id
        )

        assert result is not None
        assert result.id == customer_grant.id
