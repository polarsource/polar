import pytest

from polar.auth.models import AuthSubject
from polar.customer_portal.service.benefit_grant import CustomerBenefitGrantSortProperty
from polar.customer_portal.service.benefit_grant import (
    customer_benefit_grant as customer_benefit_grant_service,
)
from polar.kit.db.postgres import AsyncSession
from polar.kit.pagination import PaginationParams
from polar.kit.sorting import Sorting
from polar.models import Benefit, Customer, Member, Organization, Subscription
from polar.models.member import MemberRole
from tests.fixtures.auth import MEMBER_AUTH_SUBJECT, AuthSubjectFixture
from tests.fixtures.database import SaveFixture
from tests.fixtures.random_objects import create_benefit_grant, create_member


@pytest.mark.asyncio
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
        benefit_organization_third: Benefit,
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
            granted=None,
            subscription=subscription,
        )

        await create_benefit_grant(
            save_fixture,
            customer,
            benefit_organization_third,
            granted=False,
            subscription=subscription,
        )

        grants, count = await customer_benefit_grant_service.list(
            session, auth_subject, pagination=PaginationParams(1, 10)
        )

        assert count == 2
        assert len(grants) == 2

    @pytest.mark.auth(AuthSubjectFixture(subject="customer"))
    async def test_search(
        self,
        auth_subject: AuthSubject[Customer],
        save_fixture: SaveFixture,
        session: AsyncSession,
        subscription: Subscription,
        benefit_organization: Benefit,
        benefit_organization_second: Benefit,
        customer: Customer,
    ) -> None:
        benefit_organization.description = "Premium Support"
        await save_fixture(benefit_organization)
        
        await create_benefit_grant(
            save_fixture,
            customer,
            benefit_organization,
            granted=True,
            subscription=subscription,
        )

        benefit_organization_second.description = "Basic Access"
        await save_fixture(benefit_organization_second)
        
        await create_benefit_grant(
            save_fixture,
            customer,
            benefit_organization_second,
            granted=True,
            subscription=subscription,
        )

        # Search for "Premium"
        grants, count = await customer_benefit_grant_service.list(
            session, auth_subject, pagination=PaginationParams(1, 10), query="Premium"
        )
        assert count == 1
        assert len(grants) == 1
        assert grants[0].benefit.description == "Premium Support"

        # Search for "Basic"
        grants, count = await customer_benefit_grant_service.list(
            session, auth_subject, pagination=PaginationParams(1, 10), query="Basic"
        )
        assert count == 1
        assert len(grants) == 1
        assert grants[0].benefit.description == "Basic Access"

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

        assert result is None

    @pytest.mark.auth(AuthSubjectFixture(subject="customer"))
    async def test_customer_pending(
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
            granted=None,
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


@pytest.mark.asyncio
class TestListMember:
    """Tests for member-specific benefit grant filtering."""

    @pytest.mark.auth(MEMBER_AUTH_SUBJECT)
    async def test_member_sees_only_own_grants(
        self,
        auth_subject: AuthSubject[Member],
        save_fixture: SaveFixture,
        session: AsyncSession,
        subscription: Subscription,
        benefit_organization: Benefit,
        customer: Customer,
        member: Member,
        organization: Organization,
    ) -> None:
        """Member should only see grants assigned to them, not other grants."""
        # Create a grant for the member
        member_grant = await create_benefit_grant(
            save_fixture,
            customer,
            benefit_organization,
            granted=True,
            subscription=subscription,
            member=member,
        )

        # Create another member for the same customer
        member_second = await create_member(
            save_fixture,
            customer=customer,
            organization=organization,
            email="member.second@example.com",
            role=MemberRole.member,
        )

        # Create a grant for the other member
        await create_benefit_grant(
            save_fixture,
            customer,
            benefit_organization,
            granted=True,
            subscription=subscription,
            member=member_second,
        )

        grants, count = await customer_benefit_grant_service.list(
            session, auth_subject, pagination=PaginationParams(1, 10)
        )

        # Member should only see their own grant
        assert count == 1
        assert len(grants) == 1
        assert grants[0].id == member_grant.id

    @pytest.mark.auth(MEMBER_AUTH_SUBJECT)
    async def test_member_does_not_see_customer_level_grants(
        self,
        auth_subject: AuthSubject[Member],
        save_fixture: SaveFixture,
        session: AsyncSession,
        subscription: Subscription,
        benefit_organization: Benefit,
        customer: Customer,
        member: Member,
    ) -> None:
        """Member should not see grants without a member_id (customer-level grants)."""
        # Create a customer-level grant (no member_id)
        await create_benefit_grant(
            save_fixture,
            customer,
            benefit_organization,
            granted=True,
            subscription=subscription,
        )

        grants, count = await customer_benefit_grant_service.list(
            session, auth_subject, pagination=PaginationParams(1, 10)
        )

        # Member should not see customer-level grants
        assert count == 0
        assert len(grants) == 0


@pytest.mark.asyncio
class TestGetByIdMember:
    """Tests for member-specific benefit grant access by ID."""

    @pytest.mark.auth(MEMBER_AUTH_SUBJECT)
    async def test_member_can_access_own_grant(
        self,
        auth_subject: AuthSubject[Member],
        save_fixture: SaveFixture,
        session: AsyncSession,
        subscription: Subscription,
        benefit_organization: Benefit,
        customer: Customer,
        member: Member,
    ) -> None:
        """Member should be able to access their own grant by ID."""
        member_grant = await create_benefit_grant(
            save_fixture,
            customer,
            benefit_organization,
            granted=True,
            subscription=subscription,
            member=member,
        )

        session.expunge_all()

        result = await customer_benefit_grant_service.get_by_id(
            session, auth_subject, member_grant.id
        )

        assert result is not None
        assert result.id == member_grant.id

    @pytest.mark.auth(MEMBER_AUTH_SUBJECT)
    async def test_member_cannot_access_other_member_grant(
        self,
        auth_subject: AuthSubject[Member],
        save_fixture: SaveFixture,
        session: AsyncSession,
        subscription: Subscription,
        benefit_organization: Benefit,
        customer: Customer,
        member: Member,
        organization: Organization,
    ) -> None:
        """Member should not be able to access another member's grant."""
        # Create another member for the same customer
        member_second = await create_member(
            save_fixture,
            customer=customer,
            organization=organization,
            email="member.second@example.com",
            role=MemberRole.member,
        )

        # Create a grant for the other member
        other_grant = await create_benefit_grant(
            save_fixture,
            customer,
            benefit_organization,
            granted=True,
            subscription=subscription,
            member=member_second,
        )

        session.expunge_all()

        result = await customer_benefit_grant_service.get_by_id(
            session, auth_subject, other_grant.id
        )

        assert result is None

    @pytest.mark.auth(MEMBER_AUTH_SUBJECT)
    async def test_member_cannot_access_customer_level_grant(
        self,
        auth_subject: AuthSubject[Member],
        save_fixture: SaveFixture,
        session: AsyncSession,
        subscription: Subscription,
        benefit_organization: Benefit,
        customer: Customer,
        member: Member,
    ) -> None:
        """Member should not be able to access customer-level grants (no member_id)."""
        # Create a customer-level grant
        customer_grant = await create_benefit_grant(
            save_fixture,
            customer,
            benefit_organization,
            granted=True,
            subscription=subscription,
        )

        session.expunge_all()

        result = await customer_benefit_grant_service.get_by_id(
            session, auth_subject, customer_grant.id
        )

        assert result is None
