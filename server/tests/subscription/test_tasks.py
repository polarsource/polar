import uuid
from datetime import timedelta

import pytest
from pytest_mock import MockerFixture

from polar.kit.utils import utc_now
from polar.models import Customer, Organization, Product, Subscription
from polar.models.organization import OrganizationStatus
from polar.models.subscription import SubscriptionStatus
from polar.postgres import AsyncSession
from polar.subscription.service import SubscriptionService
from polar.subscription.tasks import (  # type: ignore[attr-defined]
    SubscriptionDoesNotExist,
    SubscriptionTierDoesNotExist,
    subscription_cancel_for_organization,
    subscription_enqueue_benefits_grants,
    subscription_resume,
    subscription_service,
    subscription_update_product_benefits_grants,
)
from tests.fixtures.database import SaveFixture
from tests.fixtures.random_objects import (
    create_active_subscription,
    create_subscription,
)


@pytest.mark.asyncio
class TestSubscriptionCancelForOrganization:
    async def test_cancels_organization_subscriptions(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        organization: Organization,
        product: Product,
        customer: Customer,
    ) -> None:
        organization.status = OrganizationStatus.DENIED
        await save_fixture(organization)
        subscription = await create_active_subscription(
            save_fixture, product=product, customer=customer
        )

        session.expunge_all()

        await subscription_cancel_for_organization(product.organization_id)

        refreshed = await session.get(Subscription, subscription.id)
        assert refreshed is not None
        assert refreshed.status == SubscriptionStatus.canceled

    async def test_reenqueues_when_work_remains(
        self,
        mocker: MockerFixture,
        session: AsyncSession,
    ) -> None:
        organization_id = uuid.uuid4()
        mocker.patch.object(
            subscription_service,
            "cancel_for_organization",
            return_value=True,
        )
        enqueue_job_mock = mocker.patch("polar.subscription.tasks.enqueue_job")

        session.expunge_all()

        await subscription_cancel_for_organization(organization_id)

        enqueue_job_mock.assert_called_once_with(
            "subscription.cancel_for_organization", organization_id=organization_id
        )

    async def test_does_not_reenqueue_when_done(
        self,
        mocker: MockerFixture,
        session: AsyncSession,
    ) -> None:
        mocker.patch.object(
            subscription_service,
            "cancel_for_organization",
            return_value=False,
        )
        enqueue_job_mock = mocker.patch("polar.subscription.tasks.enqueue_job")

        session.expunge_all()

        await subscription_cancel_for_organization(uuid.uuid4())

        enqueue_job_mock.assert_not_called()


@pytest.mark.asyncio
class TestSubscriptionUpdateProductBenefitsGrants:
    async def test_not_existing_subscription_tier(self, session: AsyncSession) -> None:
        # then
        session.expunge_all()

        with pytest.raises(SubscriptionTierDoesNotExist):
            await subscription_update_product_benefits_grants(uuid.uuid4())

    async def test_existing_subscription_tier(
        self,
        mocker: MockerFixture,
        product: Product,
        session: AsyncSession,
    ) -> None:
        update_product_benefits_grants_mock = mocker.patch.object(
            subscription_service,
            "update_product_benefits_grants",
            spec=SubscriptionService.update_product_benefits_grants,
        )

        # then
        session.expunge_all()

        await subscription_update_product_benefits_grants(product.id)

        update_product_benefits_grants_mock.assert_called_once()


@pytest.mark.asyncio
class TestSubscriptionEnqueueBenefitsGrants:
    async def test_not_existing_subscription(self, session: AsyncSession) -> None:
        session.expunge_all()

        with pytest.raises(SubscriptionDoesNotExist):
            await subscription_enqueue_benefits_grants(uuid.uuid4())

    async def test_existing_subscription(
        self,
        mocker: MockerFixture,
        save_fixture: SaveFixture,
        session: AsyncSession,
        product: Product,
        customer: Customer,
    ) -> None:
        subscription = await create_subscription(
            save_fixture, product=product, customer=customer
        )
        enqueue_benefits_grants_mock = mocker.patch.object(
            subscription_service,
            "enqueue_benefits_grants",
            spec=SubscriptionService.enqueue_benefits_grants,
        )

        session.expunge_all()

        await subscription_enqueue_benefits_grants(subscription.id)

        enqueue_benefits_grants_mock.assert_called_once()


@pytest.mark.asyncio
class TestSubscriptionResume:
    async def test_not_existing_subscription(self, session: AsyncSession) -> None:
        session.expunge_all()

        with pytest.raises(SubscriptionDoesNotExist):
            await subscription_resume(uuid.uuid4())

    async def test_due_paused_subscription_is_resumed(
        self,
        mocker: MockerFixture,
        save_fixture: SaveFixture,
        session: AsyncSession,
        product: Product,
        customer: Customer,
    ) -> None:
        subscription = await create_subscription(
            save_fixture,
            product=product,
            customer=customer,
            status=SubscriptionStatus.paused,
        )
        subscription.resumes_at = utc_now() - timedelta(hours=1)
        await save_fixture(subscription)
        resume_mock = mocker.patch.object(
            subscription_service, "resume", spec=SubscriptionService.resume
        )
        session.expunge_all()

        await subscription_resume(subscription.id)

        resume_mock.assert_called_once()

    async def test_not_paused_subscription_is_skipped(
        self,
        mocker: MockerFixture,
        save_fixture: SaveFixture,
        session: AsyncSession,
        product: Product,
        customer: Customer,
    ) -> None:
        subscription = await create_active_subscription(
            save_fixture, product=product, customer=customer
        )
        resume_mock = mocker.patch.object(
            subscription_service, "resume", spec=SubscriptionService.resume
        )
        session.expunge_all()

        await subscription_resume(subscription.id)

        resume_mock.assert_not_called()

    async def test_indefinite_pause_is_skipped(
        self,
        mocker: MockerFixture,
        save_fixture: SaveFixture,
        session: AsyncSession,
        product: Product,
        customer: Customer,
    ) -> None:
        subscription = await create_subscription(
            save_fixture,
            product=product,
            customer=customer,
            status=SubscriptionStatus.paused,
        )
        resume_mock = mocker.patch.object(
            subscription_service, "resume", spec=SubscriptionService.resume
        )
        session.expunge_all()

        await subscription_resume(subscription.id)

        resume_mock.assert_not_called()

    async def test_postponed_resume_is_skipped(
        self,
        mocker: MockerFixture,
        save_fixture: SaveFixture,
        session: AsyncSession,
        product: Product,
        customer: Customer,
    ) -> None:
        subscription = await create_subscription(
            save_fixture,
            product=product,
            customer=customer,
            status=SubscriptionStatus.paused,
            scheduler_locked_at=utc_now(),
        )
        subscription.resumes_at = utc_now() + timedelta(days=1)
        await save_fixture(subscription)
        resume_mock = mocker.patch.object(
            subscription_service, "resume", spec=SubscriptionService.resume
        )
        session.expunge_all()

        await subscription_resume(subscription.id)

        resume_mock.assert_not_called()
