import pytest

from polar.kit.pii import hash_pii
from polar.models import Customer, Organization
from polar.postgres import AsyncSession
from polar.trial_redemption.service import trial_redemption as trial_redemption_service
from tests.fixtures.database import SaveFixture
from tests.fixtures.random_objects import create_customer, create_trial_redemption


@pytest.mark.asyncio
class TestCreateTrialRedemption:
    async def test_stores_the_hash_instead_of_the_email(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        organization: Organization,
    ) -> None:
        customer = await create_customer(
            save_fixture, organization=organization, email="Customer+1@example.com"
        )

        trial_redemption = await trial_redemption_service.create_trial_redemption(
            session, customer=customer
        )

        assert trial_redemption is not None
        assert trial_redemption.customer_email_hash == hash_pii("customer@example.com")


@pytest.mark.asyncio
class TestCheckTrialAlreadyRedeemed:
    async def test_hashed_redemption(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        organization: Organization,
        customer: Customer,
    ) -> None:
        await create_trial_redemption(
            save_fixture,
            customer=customer,
            customer_email_hash=hash_pii("customer@example.com"),
        )
        other_customer = await create_customer(
            save_fixture, organization=organization, email="Customer+1@example.com"
        )

        assert await trial_redemption_service.check_trial_already_redeemed(
            session, organization, customer=other_customer
        )

    async def test_plaintext_redemption(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        organization: Organization,
        customer: Customer,
    ) -> None:
        await create_trial_redemption(
            save_fixture,
            customer=customer,
            customer_email_hash="customer@example.com",
        )
        other_customer = await create_customer(
            save_fixture, organization=organization, email="Customer+1@example.com"
        )

        assert await trial_redemption_service.check_trial_already_redeemed(
            session, organization, customer=other_customer
        )

    async def test_another_email(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        organization: Organization,
        customer: Customer,
    ) -> None:
        await create_trial_redemption(
            save_fixture,
            customer=customer,
            customer_email_hash=hash_pii("customer@example.com"),
        )
        other_customer = await create_customer(
            save_fixture, organization=organization, email="other@example.com"
        )

        assert not await trial_redemption_service.check_trial_already_redeemed(
            session, organization, customer=other_customer
        )
