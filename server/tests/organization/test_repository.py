from datetime import UTC, datetime, timedelta

import pytest

from polar.models import Customer, Organization, Product, User, UserOrganization
from polar.models.organization import OrganizationStatus
from polar.models.user_organization import OrganizationRole
from polar.organization.repository import OrganizationRepository
from polar.postgres import AsyncSession
from polar.user_organization.service import (
    user_organization as user_organization_service,
)
from tests.fixtures.database import SaveFixture
from tests.fixtures.random_objects import (
    create_active_subscription,
    create_canceled_subscription,
)


@pytest.mark.asyncio
class TestGetOwnerUser:
    async def test_excludes_soft_deleted_membership(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        organization: Organization,
        user: User,
        user_second: User,
    ) -> None:
        # Owner A + Admin B.
        owner_membership = UserOrganization(
            user_id=user.id,
            organization_id=organization.id,
            role=OrganizationRole.owner,
        )
        await save_fixture(owner_membership)

        admin_membership = UserOrganization(
            user_id=user_second.id,
            organization_id=organization.id,
            role=OrganizationRole.admin,
        )
        await save_fixture(admin_membership)

        # Soft-delete the owner via raw `remove_member` (allowed because
        # admin B keeps the admin-capability invariant satisfied).
        await user_organization_service.remove_member(
            session,
            user_id=user.id,
            organization_id=organization.id,
        )
        await session.flush()

        repo = OrganizationRepository.from_session(session)
        owner_after_removal = await repo.get_owner_user(organization)
        assert owner_after_removal is None


async def _set_status(
    save_fixture: SaveFixture,
    organization: Organization,
    status: OrganizationStatus,
    status_updated_at: datetime,
) -> None:
    organization.status = status
    organization.status_updated_at = status_updated_at
    await save_fixture(organization)


@pytest.mark.asyncio
class TestGetStatusCancellationExpired:
    async def test_returns_expired_org_with_billable_subscription(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        organization: Organization,
        product: Product,
        customer: Customer,
    ) -> None:
        await _set_status(
            save_fixture,
            organization,
            OrganizationStatus.DENIED,
            datetime.now(UTC) - timedelta(days=8),
        )
        await create_active_subscription(
            save_fixture, product=product, customer=customer
        )

        repo = OrganizationRepository.from_session(session)
        results = await repo.get_status_cancellation_expired(
            datetime.now(UTC) - timedelta(days=7)
        )

        assert organization.id in {org.id for org in results}

    @pytest.mark.parametrize(
        "status",
        [
            OrganizationStatus.DENIED,
            OrganizationStatus.BLOCKED,
            OrganizationStatus.OFFBOARDED,
        ],
    )
    async def test_includes_all_cancellation_statuses(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        organization: Organization,
        product: Product,
        customer: Customer,
        status: OrganizationStatus,
    ) -> None:
        await _set_status(
            save_fixture,
            organization,
            status,
            datetime.now(UTC) - timedelta(days=8),
        )
        await create_active_subscription(
            save_fixture, product=product, customer=customer
        )

        repo = OrganizationRepository.from_session(session)
        results = await repo.get_status_cancellation_expired(
            datetime.now(UTC) - timedelta(days=7)
        )

        assert organization.id in {org.id for org in results}

    async def test_excludes_recent_status_change(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        organization: Organization,
        product: Product,
        customer: Customer,
    ) -> None:
        await _set_status(
            save_fixture,
            organization,
            OrganizationStatus.DENIED,
            datetime.now(UTC) - timedelta(days=1),
        )
        await create_active_subscription(
            save_fixture, product=product, customer=customer
        )

        repo = OrganizationRepository.from_session(session)
        results = await repo.get_status_cancellation_expired(
            datetime.now(UTC) - timedelta(days=7)
        )

        assert organization.id not in {org.id for org in results}

    async def test_excludes_org_without_billable_subscription(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        organization: Organization,
        product: Product,
        customer: Customer,
    ) -> None:
        await _set_status(
            save_fixture,
            organization,
            OrganizationStatus.DENIED,
            datetime.now(UTC) - timedelta(days=8),
        )
        await create_canceled_subscription(
            save_fixture, product=product, customer=customer, revoke=True
        )

        repo = OrganizationRepository.from_session(session)
        results = await repo.get_status_cancellation_expired(
            datetime.now(UTC) - timedelta(days=7)
        )

        assert organization.id not in {org.id for org in results}

    @pytest.mark.parametrize(
        "status",
        [
            OrganizationStatus.ACTIVE,
            # `offboarding` is the in-progress wind-down (renewals still on);
            # only the terminal `offboarded` status triggers cancellation.
            OrganizationStatus.OFFBOARDING,
        ],
    )
    async def test_excludes_non_cancellation_status(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        organization: Organization,
        product: Product,
        customer: Customer,
        status: OrganizationStatus,
    ) -> None:
        await _set_status(
            save_fixture,
            organization,
            status,
            datetime.now(UTC) - timedelta(days=8),
        )
        await create_active_subscription(
            save_fixture, product=product, customer=customer
        )

        repo = OrganizationRepository.from_session(session)
        results = await repo.get_status_cancellation_expired(
            datetime.now(UTC) - timedelta(days=7)
        )

        assert organization.id not in {org.id for org in results}

    async def test_falls_back_to_created_at_when_status_updated_at_null(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        organization: Organization,
        product: Product,
        customer: Customer,
    ) -> None:
        # Legacy terminal org with no status_updated_at must still be picked up,
        # anchored on created_at.
        organization.status = OrganizationStatus.DENIED
        organization.status_updated_at = None
        organization.created_at = datetime.now(UTC) - timedelta(days=8)
        await save_fixture(organization)
        await create_active_subscription(
            save_fixture, product=product, customer=customer
        )

        repo = OrganizationRepository.from_session(session)
        results = await repo.get_status_cancellation_expired(
            datetime.now(UTC) - timedelta(days=7)
        )

        assert organization.id in {org.id for org in results}
