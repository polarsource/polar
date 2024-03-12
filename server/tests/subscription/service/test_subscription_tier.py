import uuid
from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock

import pytest
from pytest_mock import MockerFixture

from polar.authz.service import Anonymous, Authz
from polar.exceptions import NotPermitted
from polar.integrations.stripe.service import StripeError
from polar.kit.pagination import PaginationParams
from polar.models import (
    Organization,
    Repository,
    SubscriptionBenefit,
    SubscriptionTier,
    User,
    UserOrganization,
)
from polar.models.subscription_benefit import SubscriptionBenefitType
from polar.models.subscription_tier import SubscriptionTierType
from polar.postgres import AsyncSession
from polar.subscription.schemas import SubscriptionTierCreate, SubscriptionTierUpdate
from polar.subscription.service.subscription_tier import (
    FreeTierIsNotArchivable,
    OrganizationDoesNotExist,
    RepositoryDoesNotExist,
    SubscriptionBenefitDoesNotExist,
    SubscriptionBenefitIsNotSelectable,
)
from polar.subscription.service.subscription_tier import (
    subscription_tier as subscription_tier_service,
)
from tests.fixtures.database import SaveFixture
from tests.fixtures.random_objects import (
    add_subscription_benefits,
    create_subscription_benefit,
    create_subscription_tier,
)


@pytest.fixture
def authz(session: AsyncSession) -> Authz:
    return Authz(session)


@pytest.fixture
def enqueue_job_mock(mocker: MockerFixture) -> AsyncMock:
    return mocker.patch("polar.subscription.service.subscription_tier.enqueue_job")


@pytest.mark.asyncio
class TestSearch:
    async def test_anonymous(
        self, session: AsyncSession, subscription_tiers: list[SubscriptionTier]
    ) -> None:
        # then
        session.expunge_all()

        results, count = await subscription_tier_service.search(
            session, Anonymous(), pagination=PaginationParams(1, 10)
        )

        assert count == 4
        assert len(results) == 4
        assert results[0].id == subscription_tiers[0].id
        assert results[1].id == subscription_tiers[1].id
        assert results[2].id == subscription_tiers[2].id

    async def test_user(
        self,
        session: AsyncSession,
        subscription_tiers: list[SubscriptionTier],
        user: User,
    ) -> None:
        # then
        session.expunge_all()

        results, count = await subscription_tier_service.search(
            session, user, pagination=PaginationParams(1, 10)
        )

        assert count == 4
        assert len(results) == 4
        assert results[0].id == subscription_tiers[0].id
        assert results[1].id == subscription_tiers[1].id
        assert results[2].id == subscription_tiers[2].id

    async def test_user_organization(
        self,
        session: AsyncSession,
        user: User,
        subscription_tiers: list[SubscriptionTier],
        user_organization: UserOrganization,
    ) -> None:
        # then
        session.expunge_all()

        results, count = await subscription_tier_service.search(
            session, user, pagination=PaginationParams(1, 10)
        )

        assert count == 5
        assert len(results) == 5

    async def test_filter_type(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        user: User,
        organization: Organization,
    ) -> None:
        individual_subscription_tier = await create_subscription_tier(
            save_fixture,
            type=SubscriptionTierType.individual,
            organization=organization,
        )
        await create_subscription_tier(
            save_fixture, type=SubscriptionTierType.business, organization=organization
        )

        # then
        session.expunge_all()

        results, count = await subscription_tier_service.search(
            session,
            user,
            type=SubscriptionTierType.individual,
            pagination=PaginationParams(1, 10),
        )

        assert count == 1
        assert len(results) == 1
        assert results[0].id == individual_subscription_tier.id

    async def test_filter_organization_direct(
        self,
        session: AsyncSession,
        user: User,
        organization: Organization,
        subscription_tiers: list[SubscriptionTier],
        subscription_tier_organization_free: SubscriptionTier,
        subscription_tier_organization: SubscriptionTier,
        subscription_tier_organization_second: SubscriptionTier,
    ) -> None:
        # then
        session.expunge_all()

        results, count = await subscription_tier_service.search(
            session, user, organization=organization, pagination=PaginationParams(1, 10)
        )

        assert count == 3
        assert len(results) == 3
        assert results[0].id == subscription_tier_organization_free.id
        assert results[1].id == subscription_tier_organization.id
        assert results[2].id == subscription_tier_organization_second.id

    async def test_filter_organization_indirect(
        self,
        session: AsyncSession,
        user: User,
        organization: Organization,
        subscription_tiers: list[SubscriptionTier],
        user_organization: UserOrganization,
    ) -> None:
        # then
        session.expunge_all()

        results, count = await subscription_tier_service.search(
            session,
            user,
            organization=organization,
            direct_organization=False,
            pagination=PaginationParams(1, 10),
        )

        assert count == 5
        assert len(results) == 5

    async def test_filter_repository(
        self,
        session: AsyncSession,
        user: User,
        repository: Repository,
        subscription_tiers: list[SubscriptionTier],
        subscription_tier_private_repository: SubscriptionTier,
        user_organization: UserOrganization,
    ) -> None:
        # then
        session.expunge_all()

        results, count = await subscription_tier_service.search(
            session, user, repository=repository, pagination=PaginationParams(1, 10)
        )

        assert count == 1
        assert len(results) == 1
        assert results[0].id == subscription_tier_private_repository.id

    async def test_filter_include_archived(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        user: User,
        organization: Organization,
        user_organization: UserOrganization,
    ) -> None:
        archived_subscription_tier = await create_subscription_tier(
            save_fixture, organization=organization, is_archived=True
        )

        # then
        session.expunge_all()

        # Anonymous
        results, count = await subscription_tier_service.search(
            session,
            Anonymous(),
            include_archived=False,
            pagination=PaginationParams(1, 10),
        )
        assert count == 0
        assert len(results) == 0
        results, count = await subscription_tier_service.search(
            session,
            Anonymous(),
            include_archived=True,
            pagination=PaginationParams(1, 10),
        )
        assert count == 0
        assert len(results) == 0

        # User
        results, count = await subscription_tier_service.search(
            session, user, include_archived=False, pagination=PaginationParams(1, 10)
        )
        assert count == 0
        assert len(results) == 0
        results, count = await subscription_tier_service.search(
            session, user, include_archived=True, pagination=PaginationParams(1, 10)
        )
        assert count == 1
        assert len(results) == 1
        assert results[0].id == archived_subscription_tier.id


@pytest.mark.asyncio
class TestGetById:
    async def test_anonymous(
        self,
        session: AsyncSession,
        subscription_tier_private_repository: SubscriptionTier,
        subscription_tier_organization: SubscriptionTier,
    ) -> None:
        # then
        session.expunge_all()

        not_existing_subscription_tier = await subscription_tier_service.get_by_id(
            session, Anonymous(), uuid.uuid4()
        )
        assert not_existing_subscription_tier is None

        not_accessible_subscription_tier = await subscription_tier_service.get_by_id(
            session, Anonymous(), subscription_tier_private_repository.id
        )
        assert not_accessible_subscription_tier is None

        accessible_subscription_tier = await subscription_tier_service.get_by_id(
            session, Anonymous(), subscription_tier_organization.id
        )
        assert accessible_subscription_tier is not None
        assert accessible_subscription_tier.id == subscription_tier_organization.id

    async def test_user(
        self,
        session: AsyncSession,
        subscription_tier_private_repository: SubscriptionTier,
        subscription_tier_organization: SubscriptionTier,
        user: User,
    ) -> None:
        # then
        session.expunge_all()

        not_existing_subscription_tier = await subscription_tier_service.get_by_id(
            session, user, uuid.uuid4()
        )
        assert not_existing_subscription_tier is None

        not_accessible_subscription_tier = await subscription_tier_service.get_by_id(
            session, user, subscription_tier_private_repository.id
        )
        assert not_accessible_subscription_tier is None

        accessible_subscription_tier = await subscription_tier_service.get_by_id(
            session, user, subscription_tier_organization.id
        )
        assert accessible_subscription_tier is not None
        assert accessible_subscription_tier.id == subscription_tier_organization.id

    async def test_user_organization(
        self,
        session: AsyncSession,
        subscription_tier_private_repository: SubscriptionTier,
        subscription_tier_organization: SubscriptionTier,
        user: User,
        user_organization: UserOrganization,
    ) -> None:
        # then
        session.expunge_all()

        not_existing_subscription_tier = await subscription_tier_service.get_by_id(
            session, user, uuid.uuid4()
        )
        assert not_existing_subscription_tier is None

        private_subscription_tier = await subscription_tier_service.get_by_id(
            session, user, subscription_tier_private_repository.id
        )
        assert private_subscription_tier is not None
        assert private_subscription_tier.id == subscription_tier_private_repository.id

        accessible_subscription_tier = await subscription_tier_service.get_by_id(
            session, user, subscription_tier_organization.id
        )
        assert accessible_subscription_tier is not None
        assert accessible_subscription_tier.id == subscription_tier_organization.id


@pytest.mark.asyncio
class TestUserCreate:
    async def test_not_existing_organization(
        self, session: AsyncSession, authz: Authz, user: User
    ) -> None:
        create_schema = SubscriptionTierCreate(
            type=SubscriptionTierType.individual,
            name="Subscription Tier",
            price_amount=1000,
            price_currency="USD",
            organization_id=uuid.uuid4(),
        )

        # then
        session.expunge_all()

        with pytest.raises(OrganizationDoesNotExist):
            await subscription_tier_service.user_create(
                session, authz, create_schema, user
            )

    async def test_not_writable_organization(
        self,
        session: AsyncSession,
        authz: Authz,
        user: User,
        organization: Organization,
    ) -> None:
        create_schema = SubscriptionTierCreate(
            type=SubscriptionTierType.individual,
            name="Subscription Tier",
            price_amount=1000,
            price_currency="USD",
            organization_id=organization.id,
        )

        # then
        session.expunge_all()

        with pytest.raises(OrganizationDoesNotExist):
            await subscription_tier_service.user_create(
                session, authz, create_schema, user
            )

    async def test_valid_organization(
        self,
        session: AsyncSession,
        authz: Authz,
        user: User,
        organization: Organization,
        user_organization_admin: UserOrganization,
        stripe_service_mock: MagicMock,
    ) -> None:
        create_product_with_price_mock: (
            MagicMock
        ) = stripe_service_mock.create_product_with_price
        create_product_with_price_mock.return_value = SimpleNamespace(
            id="PRODUCT_ID", default_price="PRICE_ID"
        )

        create_schema = SubscriptionTierCreate(
            type=SubscriptionTierType.individual,
            name="Subscription Tier",
            price_amount=1000,
            price_currency="USD",
            organization_id=organization.id,
        )

        # then
        session.expunge_all()

        subscription_tier = await subscription_tier_service.user_create(
            session, authz, create_schema, user
        )
        assert subscription_tier.organization_id == organization.id

        create_product_with_price_mock.assert_called_once()
        assert subscription_tier.stripe_product_id == "PRODUCT_ID"
        assert subscription_tier.stripe_price_id == "PRICE_ID"

    async def test_not_existing_repository(
        self, session: AsyncSession, authz: Authz, user: User
    ) -> None:
        create_schema = SubscriptionTierCreate(
            type=SubscriptionTierType.individual,
            name="Subscription Tier",
            price_amount=1000,
            price_currency="USD",
            repository_id=uuid.uuid4(),
        )

        # then
        session.expunge_all()

        with pytest.raises(RepositoryDoesNotExist):
            await subscription_tier_service.user_create(
                session, authz, create_schema, user
            )

    async def test_not_writable_repository(
        self,
        session: AsyncSession,
        authz: Authz,
        user: User,
        repository: Repository,
    ) -> None:
        create_schema = SubscriptionTierCreate(
            type=SubscriptionTierType.individual,
            name="Subscription Tier",
            price_amount=1000,
            price_currency="USD",
            repository_id=repository.id,
        )

        # then
        session.expunge_all()

        with pytest.raises(RepositoryDoesNotExist):
            await subscription_tier_service.user_create(
                session, authz, create_schema, user
            )

    async def test_valid_repository(
        self,
        session: AsyncSession,
        authz: Authz,
        user: User,
        repository: Repository,
        user_organization_admin: UserOrganization,
        stripe_service_mock: MagicMock,
    ) -> None:
        create_product_with_price_mock: (
            MagicMock
        ) = stripe_service_mock.create_product_with_price
        create_product_with_price_mock.return_value = SimpleNamespace(
            id="PRODUCT_ID", default_price="PRICE_ID"
        )

        create_schema = SubscriptionTierCreate(
            type=SubscriptionTierType.individual,
            name="Subscription Tier",
            price_amount=1000,
            price_currency="USD",
            repository_id=repository.id,
        )

        # then
        session.expunge_all()

        subscription_tier = await subscription_tier_service.user_create(
            session, authz, create_schema, user
        )
        assert subscription_tier.repository_id == repository.id

        create_product_with_price_mock.assert_called_once()
        assert subscription_tier.stripe_product_id == "PRODUCT_ID"
        assert subscription_tier.stripe_price_id == "PRICE_ID"

    async def test_stripe_error(
        self,
        session: AsyncSession,
        authz: Authz,
        user: User,
        organization: Organization,
        user_organization_admin: UserOrganization,
        stripe_service_mock: MagicMock,
    ) -> None:
        create_product_with_price_mock: (
            MagicMock
        ) = stripe_service_mock.create_product_with_price
        create_product_with_price_mock.side_effect = StripeError()

        create_schema = SubscriptionTierCreate(
            type=SubscriptionTierType.individual,
            name="Subscription Tier",
            price_amount=1000,
            price_currency="USD",
            organization_id=organization.id,
        )

        # then
        session.expunge_all()

        with pytest.raises(StripeError):
            await subscription_tier_service.user_create(
                session, authz, create_schema, user
            )

        subscription_tier = await subscription_tier_service.get_by(
            session, name="Subscription Tier"
        )
        assert subscription_tier is None

    async def test_valid_highlighted(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        authz: Authz,
        user: User,
        organization: Organization,
        user_organization_admin: UserOrganization,
        stripe_service_mock: MagicMock,
    ) -> None:
        highlighted_subscription_tier = await create_subscription_tier(
            save_fixture, organization=organization, is_highlighted=True
        )
        await create_subscription_tier(
            save_fixture, organization=organization, is_highlighted=False
        )
        create_product_with_price_mock: (
            MagicMock
        ) = stripe_service_mock.create_product_with_price
        create_product_with_price_mock.return_value = SimpleNamespace(
            id="PRODUCT_ID", default_price="PRICE_ID"
        )

        create_schema = SubscriptionTierCreate(
            type=SubscriptionTierType.individual,
            name="Subscription Tier",
            price_amount=1000,
            price_currency="USD",
            organization_id=organization.id,
            is_highlighted=True,
        )

        # then
        session.expunge_all()

        subscription_tier = await subscription_tier_service.user_create(
            session, authz, create_schema, user
        )
        assert subscription_tier.is_highlighted

        updated_highlighted_subscription_tier = await subscription_tier_service.get(
            session, highlighted_subscription_tier.id
        )
        assert updated_highlighted_subscription_tier is not None
        assert not updated_highlighted_subscription_tier.is_highlighted

    async def test_empty_description(
        self,
        session: AsyncSession,
        authz: Authz,
        user: User,
        repository: Repository,
        user_organization_admin: UserOrganization,
        stripe_service_mock: MagicMock,
    ) -> None:
        create_product_with_price_mock: (
            MagicMock
        ) = stripe_service_mock.create_product_with_price
        create_product_with_price_mock.return_value = SimpleNamespace(
            id="PRODUCT_ID", default_price="PRICE_ID"
        )

        create_schema = SubscriptionTierCreate(
            type=SubscriptionTierType.individual,
            name="Subscription Tier",
            description="",
            price_amount=1000,
            price_currency="USD",
            repository_id=repository.id,
        )

        # then
        session.expunge_all()

        subscription_tier = await subscription_tier_service.user_create(
            session, authz, create_schema, user
        )
        assert subscription_tier.description is None


@pytest.mark.asyncio
class TestUserUpdate:
    async def test_not_writable_subscription_tier(
        self,
        session: AsyncSession,
        authz: Authz,
        user: User,
        subscription_tier_organization: SubscriptionTier,
    ) -> None:
        # then
        session.expunge_all()

        # load
        subscription_tier_organization_loaded = await subscription_tier_service.get(
            session, subscription_tier_organization.id
        )
        assert subscription_tier_organization_loaded

        update_schema = SubscriptionTierUpdate(name="Subscription Tier Update")
        with pytest.raises(NotPermitted):
            await subscription_tier_service.user_update(
                session,
                authz,
                subscription_tier_organization_loaded,
                update_schema,
                user,
            )

    async def test_valid_name_change(
        self,
        session: AsyncSession,
        authz: Authz,
        user: User,
        subscription_tier_organization: SubscriptionTier,
        organization: Organization,
        user_organization_admin: UserOrganization,
        stripe_service_mock: MagicMock,
    ) -> None:
        update_product_mock: MagicMock = stripe_service_mock.update_product

        # then
        session.expunge_all()

        # load
        subscription_tier_organization_loaded = await subscription_tier_service.get(
            session, subscription_tier_organization.id
        )
        assert subscription_tier_organization_loaded

        update_schema = SubscriptionTierUpdate(name="Subscription Tier Update")
        updated_subscription_tier = await subscription_tier_service.user_update(
            session, authz, subscription_tier_organization_loaded, update_schema, user
        )
        assert updated_subscription_tier.name == "Subscription Tier Update"

        update_product_mock.assert_called_once_with(
            updated_subscription_tier.stripe_product_id,
            name=f"{organization.name} - Subscription Tier Update",
        )

    async def test_valid_description_change(
        self,
        session: AsyncSession,
        authz: Authz,
        user: User,
        subscription_tier_organization: SubscriptionTier,
        user_organization_admin: UserOrganization,
        stripe_service_mock: MagicMock,
    ) -> None:
        update_product_mock: MagicMock = stripe_service_mock.update_product

        # then
        session.expunge_all()

        # load
        subscription_tier_organization_loaded = await subscription_tier_service.get(
            session, subscription_tier_organization.id
        )
        assert subscription_tier_organization_loaded

        update_schema = SubscriptionTierUpdate(description="Description update")
        updated_subscription_tier = await subscription_tier_service.user_update(
            session, authz, subscription_tier_organization_loaded, update_schema, user
        )
        assert updated_subscription_tier.description == "Description update"

        update_product_mock.assert_called_once_with(
            updated_subscription_tier.stripe_product_id,
            description="Description update",
        )

    async def test_empty_description_update(
        self,
        session: AsyncSession,
        authz: Authz,
        user: User,
        subscription_tier_organization: SubscriptionTier,
        user_organization_admin: UserOrganization,
        stripe_service_mock: MagicMock,
    ) -> None:
        update_product_mock: MagicMock = stripe_service_mock.update_product

        # then
        session.expunge_all()

        # load
        subscription_tier_organization_loaded = await subscription_tier_service.get(
            session, subscription_tier_organization.id
        )
        assert subscription_tier_organization_loaded

        update_schema = SubscriptionTierUpdate(description="")
        updated_subscription_tier = await subscription_tier_service.user_update(
            session, authz, subscription_tier_organization_loaded, update_schema, user
        )
        assert (
            updated_subscription_tier.description
            == subscription_tier_organization.description
        )

        update_product_mock.assert_not_called()

    async def test_valid_price_change(
        self,
        session: AsyncSession,
        authz: Authz,
        user: User,
        subscription_tier_organization: SubscriptionTier,
        user_organization_admin: UserOrganization,
        stripe_service_mock: MagicMock,
    ) -> None:
        create_price_for_product_mock: (
            MagicMock
        ) = stripe_service_mock.create_price_for_product
        create_price_for_product_mock.return_value = SimpleNamespace(id="NEW_PRICE_ID")
        archive_price_mock: MagicMock = stripe_service_mock.archive_price

        old_price_id = subscription_tier_organization.stripe_price_id

        # then
        session.expunge_all()

        # load
        subscription_tier_organization_loaded = await subscription_tier_service.get(
            session, subscription_tier_organization.id
        )
        assert subscription_tier_organization_loaded

        update_schema = SubscriptionTierUpdate(price_amount=1500)
        updated_subscription_tier = await subscription_tier_service.user_update(
            session, authz, subscription_tier_organization_loaded, update_schema, user
        )

        create_price_for_product_mock.assert_called_once()
        archive_price_mock.assert_called_once_with(old_price_id)

        assert updated_subscription_tier.price_amount == 1500
        assert updated_subscription_tier.stripe_price_id == "NEW_PRICE_ID"

    async def test_valid_highlighted(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        authz: Authz,
        user: User,
        organization: Organization,
        subscription_tier_organization: SubscriptionTier,
        user_organization_admin: UserOrganization,
        stripe_service_mock: MagicMock,
    ) -> None:
        highlighted_subscription_tier = await create_subscription_tier(
            save_fixture, organization=organization, is_highlighted=True
        )

        create_price_for_product_mock: (
            MagicMock
        ) = stripe_service_mock.create_price_for_product
        create_price_for_product_mock.return_value = SimpleNamespace(id="NEW_PRICE_ID")

        # then
        session.expunge_all()

        # load
        subscription_tier_organization_loaded = await subscription_tier_service.get(
            session, subscription_tier_organization.id
        )
        assert subscription_tier_organization_loaded

        update_schema = SubscriptionTierUpdate(is_highlighted=True)
        updated_subscription_tier = await subscription_tier_service.user_update(
            session, authz, subscription_tier_organization_loaded, update_schema, user
        )

        assert updated_subscription_tier.is_highlighted

        updated_highlighted_subscription_tier = await subscription_tier_service.get(
            session, highlighted_subscription_tier.id
        )
        assert updated_highlighted_subscription_tier is not None
        assert not updated_highlighted_subscription_tier.is_highlighted


@pytest.mark.asyncio
class TestCreateFree:
    async def test_already_exists(
        self,
        session: AsyncSession,
        enqueue_job_mock: AsyncMock,
        organization: Organization,
        subscription_tier_organization_free: SubscriptionTier,
    ) -> None:
        # then
        session.expunge_all()

        subscription_tier = await subscription_tier_service.create_free(
            session, benefits=[], organization=organization
        )

        assert subscription_tier.id == subscription_tier_organization_free.id

        enqueue_job_mock.assert_called_once_with(
            "subscription.subscription.update_subscription_tier_benefits_grants",
            subscription_tier.id,
        )

    async def test_create(
        self,
        session: AsyncSession,
        enqueue_job_mock: AsyncMock,
        subscription_benefit_organization: SubscriptionBenefit,
        organization: Organization,
    ) -> None:
        # then
        session.expunge_all()

        free_subscription_tier = await subscription_tier_service.create_free(
            session,
            benefits=[subscription_benefit_organization],
            organization=organization,
        )

        assert free_subscription_tier.type == SubscriptionTierType.free
        assert free_subscription_tier.organization_id == organization.id
        assert free_subscription_tier.price_amount == 0
        assert len(free_subscription_tier.benefits) == 1
        assert (
            free_subscription_tier.benefits[0].id
            == subscription_benefit_organization.id
        )

        enqueue_job_mock.assert_called_once_with(
            "subscription.subscription.update_subscription_tier_benefits_grants",
            free_subscription_tier.id,
        )


@pytest.mark.asyncio
class TestUpdateBenefits:
    async def test_not_writable_subscription_tier(
        self,
        session: AsyncSession,
        authz: Authz,
        user: User,
        subscription_tier_organization: SubscriptionTier,
    ) -> None:
        # then
        session.expunge_all()

        # load
        subscription_tier_organization_loaded = await subscription_tier_service.get(
            session, subscription_tier_organization.id
        )
        assert subscription_tier_organization_loaded

        with pytest.raises(NotPermitted):
            await subscription_tier_service.update_benefits(
                session, authz, subscription_tier_organization_loaded, [], user
            )

    async def test_not_existing_benefit(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        authz: Authz,
        user: User,
        user_organization_admin: UserOrganization,
        subscription_tier_organization: SubscriptionTier,
        subscription_benefits: list[SubscriptionBenefit],
    ) -> None:
        subscription_tier_organization = await add_subscription_benefits(
            save_fixture,
            subscription_tier=subscription_tier_organization,
            subscription_benefits=subscription_benefits,
        )

        # then
        session.expunge_all()

        # load
        subscription_tier_organization_loaded = await subscription_tier_service.get(
            session, subscription_tier_organization.id
        )
        assert subscription_tier_organization_loaded

        with pytest.raises(SubscriptionBenefitDoesNotExist):
            await subscription_tier_service.update_benefits(
                session,
                authz,
                subscription_tier_organization_loaded,
                [uuid.uuid4()],
                user,
            )

        await session.refresh(subscription_tier_organization_loaded)

        assert len(
            subscription_tier_organization_loaded.subscription_tier_benefits
        ) == len(subscription_benefits)

    async def test_added_benefits(
        self,
        session: AsyncSession,
        enqueue_job_mock: AsyncMock,
        authz: Authz,
        user: User,
        user_organization_admin: UserOrganization,
        subscription_tier_organization: SubscriptionTier,
        subscription_benefits: list[SubscriptionBenefit],
    ) -> None:
        # then
        session.expunge_all()

        # load
        subscription_tier_organization_loaded = await subscription_tier_service.get(
            session, subscription_tier_organization.id
        )
        assert subscription_tier_organization_loaded

        (
            subscription_tier,
            added,
            deleted,
        ) = await subscription_tier_service.update_benefits(
            session,
            authz,
            subscription_tier_organization_loaded,
            [benefit.id for benefit in subscription_benefits],
            user,
        )
        await session.flush()

        assert len(subscription_tier.subscription_tier_benefits) == len(
            subscription_benefits
        )
        for (
            i,
            subscription_tier_benefit,
        ) in enumerate(subscription_tier.subscription_tier_benefits):
            assert subscription_tier_benefit.order == i
            assert (
                subscription_benefits[i].id
                == subscription_tier_benefit.subscription_benefit_id
            )

        assert len(added) == len(subscription_benefits)
        assert len(deleted) == 0

        enqueue_job_mock.assert_called_once_with(
            "subscription.subscription.update_subscription_tier_benefits_grants",
            subscription_tier_organization.id,
        )

    async def test_order(
        self,
        session: AsyncSession,
        enqueue_job_mock: AsyncMock,
        authz: Authz,
        user: User,
        user_organization_admin: UserOrganization,
        subscription_tier_organization: SubscriptionTier,
        subscription_benefits: list[SubscriptionBenefit],
    ) -> None:
        # then
        session.expunge_all()

        # load
        subscription_tier_organization_loaded = await subscription_tier_service.get(
            session, subscription_tier_organization.id
        )
        assert subscription_tier_organization_loaded

        (
            subscription_tier,
            added,
            deleted,
        ) = await subscription_tier_service.update_benefits(
            session,
            authz,
            subscription_tier_organization_loaded,
            [benefit.id for benefit in subscription_benefits[::-1]],
            user,
        )
        await session.flush()

        assert len(subscription_tier.subscription_tier_benefits) == len(
            subscription_benefits
        )
        for (
            i,
            subscription_tier_benefit,
        ) in enumerate(subscription_tier.subscription_tier_benefits):
            assert subscription_tier_benefit.order == i
            assert (
                subscription_benefits[-i - 1].id
                == subscription_tier_benefit.subscription_benefit_id
            )

        assert len(added) == len(subscription_benefits)
        assert len(deleted) == 0

        enqueue_job_mock.assert_called_once_with(
            "subscription.subscription.update_subscription_tier_benefits_grants",
            subscription_tier_organization.id,
        )

    async def test_deleted(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        enqueue_job_mock: AsyncMock,
        authz: Authz,
        user: User,
        user_organization_admin: UserOrganization,
        subscription_tier_organization: SubscriptionTier,
        subscription_benefits: list[SubscriptionBenefit],
    ) -> None:
        subscription_tier_organization = await add_subscription_benefits(
            save_fixture,
            subscription_tier=subscription_tier_organization,
            subscription_benefits=subscription_benefits,
        )

        # then
        session.expunge_all()

        # load
        subscription_tier_organization_loaded = await subscription_tier_service.get(
            session, subscription_tier_organization.id
        )
        assert subscription_tier_organization_loaded

        (
            subscription_tier,
            added,
            deleted,
        ) = await subscription_tier_service.update_benefits(
            session, authz, subscription_tier_organization_loaded, [], user
        )
        await session.flush()

        assert len(subscription_tier.subscription_tier_benefits) == 0
        assert len(added) == 0
        assert len(deleted) == len(subscription_benefits)

        enqueue_job_mock.assert_called_once_with(
            "subscription.subscription.update_subscription_tier_benefits_grants",
            subscription_tier_organization.id,
        )

    async def test_reordering(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        enqueue_job_mock: AsyncMock,
        authz: Authz,
        user: User,
        user_organization_admin: UserOrganization,
        subscription_tier_organization: SubscriptionTier,
        subscription_benefits: list[SubscriptionBenefit],
    ) -> None:
        subscription_tier_organization = await add_subscription_benefits(
            save_fixture,
            subscription_tier=subscription_tier_organization,
            subscription_benefits=subscription_benefits,
        )

        # then
        session.expunge_all()

        # load
        subscription_tier_organization_loaded = await subscription_tier_service.get(
            session, subscription_tier_organization.id
        )
        assert subscription_tier_organization_loaded

        (
            subscription_tier,
            added,
            deleted,
        ) = await subscription_tier_service.update_benefits(
            session,
            authz,
            subscription_tier_organization_loaded,
            [benefit.id for benefit in subscription_benefits[::-1]],
            user,
        )
        await session.flush()

        assert len(subscription_tier.subscription_tier_benefits) == len(
            subscription_benefits
        )
        for (
            i,
            subscription_tier_benefit,
        ) in enumerate(subscription_tier.subscription_tier_benefits):
            assert subscription_tier_benefit.order == i
            assert (
                subscription_benefits[-i - 1].id
                == subscription_tier_benefit.subscription_benefit_id
            )

        assert len(added) == 0
        assert len(deleted) == 0

        enqueue_job_mock.assert_called_once_with(
            "subscription.subscription.update_subscription_tier_benefits_grants",
            subscription_tier_organization.id,
        )

    async def test_add_not_selectable(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        authz: Authz,
        user: User,
        user_organization_admin: UserOrganization,
        organization: Organization,
        subscription_tier_organization: SubscriptionTier,
    ) -> None:
        not_selectable_benefit = await create_subscription_benefit(
            save_fixture,
            type=SubscriptionBenefitType.articles,
            is_tax_applicable=True,
            organization=organization,
            selectable=False,
        )

        # then
        session.expunge_all()

        # load
        subscription_tier_organization_loaded = await subscription_tier_service.get(
            session, subscription_tier_organization.id
        )
        assert subscription_tier_organization_loaded

        with pytest.raises(SubscriptionBenefitIsNotSelectable):
            await subscription_tier_service.update_benefits(
                session,
                authz,
                subscription_tier_organization_loaded,
                [not_selectable_benefit.id],
                user,
            )

    async def test_remove_not_selectable(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        authz: Authz,
        user: User,
        user_organization_admin: UserOrganization,
        organization: Organization,
        subscription_tier_organization: SubscriptionTier,
    ) -> None:
        not_selectable_benefit = await create_subscription_benefit(
            save_fixture,
            type=SubscriptionBenefitType.articles,
            is_tax_applicable=True,
            organization=organization,
            selectable=False,
        )

        subscription_tier_organization = await add_subscription_benefits(
            save_fixture,
            subscription_tier=subscription_tier_organization,
            subscription_benefits=[not_selectable_benefit],
        )

        # then
        session.expunge_all()

        # load
        subscription_tier_organization_loaded = await subscription_tier_service.get(
            session, subscription_tier_organization.id
        )
        assert subscription_tier_organization_loaded

        with pytest.raises(SubscriptionBenefitIsNotSelectable):
            await subscription_tier_service.update_benefits(
                session,
                authz,
                subscription_tier_organization_loaded,
                [],
                user,
            )

    async def test_add_with_existing_not_selectable(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        enqueue_job_mock: AsyncMock,
        authz: Authz,
        user: User,
        user_organization_admin: UserOrganization,
        organization: Organization,
        subscription_tier_organization: SubscriptionTier,
    ) -> None:
        not_selectable_benefit = await create_subscription_benefit(
            save_fixture,
            type=SubscriptionBenefitType.articles,
            is_tax_applicable=True,
            organization=organization,
            selectable=False,
        )
        selectable_benefit = await create_subscription_benefit(
            save_fixture,
            type=SubscriptionBenefitType.custom,
            is_tax_applicable=True,
            organization=organization,
            description="SELECTABLE",
        )
        subscription_tier_organization = await add_subscription_benefits(
            save_fixture,
            subscription_tier=subscription_tier_organization,
            subscription_benefits=[not_selectable_benefit],
        )

        # then
        session.expunge_all()

        # load
        subscription_tier_organization_loaded = await subscription_tier_service.get(
            session, subscription_tier_organization.id
        )
        assert subscription_tier_organization_loaded

        (
            _,
            added,
            deleted,
        ) = await subscription_tier_service.update_benefits(
            session,
            authz,
            subscription_tier_organization_loaded,
            [not_selectable_benefit.id, selectable_benefit.id],
            user,
        )
        assert len(added) == 1
        assert selectable_benefit.id in [a.id for a in added]
        assert len(deleted) == 0

        enqueue_job_mock.assert_called_once_with(
            "subscription.subscription.update_subscription_tier_benefits_grants",
            subscription_tier_organization.id,
        )


@pytest.mark.asyncio
class TestArchive:
    async def test_not_writable_subscription_tier(
        self,
        session: AsyncSession,
        authz: Authz,
        user: User,
        subscription_tier_organization: SubscriptionTier,
    ) -> None:
        # then
        session.expunge_all()

        # load
        subscription_tier_organization_loaded = await subscription_tier_service.get(
            session, subscription_tier_organization.id
        )
        assert subscription_tier_organization_loaded

        with pytest.raises(NotPermitted):
            await subscription_tier_service.archive(
                session, authz, subscription_tier_organization_loaded, user
            )

    async def test_free_tier(
        self,
        session: AsyncSession,
        authz: Authz,
        user: User,
        subscription_tier_organization_free: SubscriptionTier,
        user_organization_admin: UserOrganization,
    ) -> None:
        # then
        session.expunge_all()

        # load
        subscription_tier_organization_free_loaded = (
            await subscription_tier_service.get(
                session, subscription_tier_organization_free.id
            )
        )
        assert subscription_tier_organization_free_loaded

        with pytest.raises(FreeTierIsNotArchivable):
            await subscription_tier_service.archive(
                session, authz, subscription_tier_organization_free_loaded, user
            )

    async def test_valid(
        self,
        session: AsyncSession,
        authz: Authz,
        user: User,
        subscription_tier_organization: SubscriptionTier,
        user_organization_admin: UserOrganization,
        stripe_service_mock: MagicMock,
    ) -> None:
        archive_product_mock: MagicMock = stripe_service_mock.archive_product

        # then
        session.expunge_all()

        # load
        subscription_tier_organization_loaded = await subscription_tier_service.get(
            session, subscription_tier_organization.id
        )
        assert subscription_tier_organization_loaded

        updated_subscription_tier = await subscription_tier_service.archive(
            session, authz, subscription_tier_organization_loaded, user
        )

        archive_product_mock.assert_called_once_with(
            subscription_tier_organization.stripe_product_id
        )

        assert updated_subscription_tier.is_archived
