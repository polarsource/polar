import pytest
from sqlalchemy import select

from polar.kit.pii import hash_pii
from polar.models import Organization, TrialRedemption
from polar.postgres import AsyncSession
from scripts.hash_trial_redemption_customer_emails import hash_batch
from tests.fixtures.database import SaveFixture
from tests.fixtures.random_objects import create_customer, create_trial_redemption


async def _customer_email_hashes(session: AsyncSession) -> list[str]:
    return list(
        (await session.execute(select(TrialRedemption.customer_email_hash)))
        .scalars()
        .all()
    )


@pytest.mark.asyncio
class TestHashBatch:
    async def test_hashes_the_addresses(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        organization: Organization,
    ) -> None:
        customer = await create_customer(save_fixture, organization=organization)
        await create_trial_redemption(
            save_fixture, customer=customer, customer_email_hash="Customer@example.com"
        )

        after, count = await hash_batch(
            session, after=None, batch_size=100, execute=True
        )

        assert after is not None
        assert count == 1
        assert await _customer_email_hashes(session) == [
            hash_pii("customer@example.com")
        ]

    async def test_skips_the_hashes(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        organization: Organization,
    ) -> None:
        customer = await create_customer(save_fixture, organization=organization)
        hash = hash_pii("customer@example.com")
        await create_trial_redemption(
            save_fixture, customer=customer, customer_email_hash=hash
        )

        after, count = await hash_batch(
            session, after=None, batch_size=100, execute=True
        )

        assert after is None
        assert count == 0
        assert await _customer_email_hashes(session) == [hash]

    async def test_dry_run_leaves_the_addresses(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        organization: Organization,
    ) -> None:
        customer = await create_customer(save_fixture, organization=organization)
        await create_trial_redemption(
            save_fixture, customer=customer, customer_email_hash="customer@example.com"
        )

        after, count = await hash_batch(
            session, after=None, batch_size=100, execute=False
        )

        assert after is not None
        assert count == 1
        assert await _customer_email_hashes(session) == ["customer@example.com"]
