import pytest
from sqlalchemy import select

from polar.config import settings
from polar.enums import SubscriptionRecurringInterval
from polar.kit.db.postgres import AsyncSession
from polar.models import (
    Account,
    Customer,
    Member,
    Organization,
    Subscription,
    UserOrganization,
)
from polar.worker._enqueue import _job_queue_manager
from scripts.backfill_polar_self_customers import run_backfill
from tests.fixtures.database import SaveFixture
from tests.fixtures.random_objects import (
    create_account,
    create_customer,
    create_organization,
    create_product,
    create_user,
)


async def _setup_self_org(
    save_fixture: SaveFixture,
    account: Account,
    monkeypatch: pytest.MonkeyPatch,
) -> Organization:
    self_org = await create_organization(
        save_fixture,
        account,
        name_prefix="polar-self",
        feature_settings={
            "member_model_enabled": True,
            "seat_based_pricing_enabled": True,
        },
    )
    free_product = await create_product(
        save_fixture,
        organization=self_org,
        recurring_interval=SubscriptionRecurringInterval.month,
        prices=[(None, "usd")],
    )
    monkeypatch.setattr(settings, "POLAR_ORGANIZATION_ID", str(self_org.id))
    monkeypatch.setattr(settings, "POLAR_FREE_PRODUCT_ID", str(free_product.id))
    return self_org


@pytest.mark.asyncio
class TestBackfillPolarSelfCustomers:
    async def test_creates_customers_members_and_subscriptions(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        account: Account,
        account_second: Account,
        monkeypatch: pytest.MonkeyPatch,
    ) -> None:
        self_org = await _setup_self_org(save_fixture, account, monkeypatch)

        target_org = await create_organization(save_fixture, account_second)
        user_a = await create_user(save_fixture)
        user_b = await create_user(save_fixture)
        await save_fixture(UserOrganization(user=user_a, organization=target_org))
        await save_fixture(UserOrganization(user=user_b, organization=target_org))

        await run_backfill(session=session)

        customer = (
            await session.execute(
                select(Customer).where(Customer.external_id == str(target_org.id))
            )
        ).scalar_one()
        assert customer.organization_id == self_org.id
        assert customer.name == target_org.name

        members = (
            (
                await session.execute(
                    select(Member).where(Member.customer_id == customer.id)
                )
            )
            .scalars()
            .all()
        )
        assert {m.email for m in members} == {user_a.email, user_b.email}
        assert {m.external_id for m in members} == {str(user_a.id), str(user_b.id)}

        subscription = (
            await session.execute(
                select(Subscription).where(Subscription.customer_id == customer.id)
            )
        ).scalar_one()
        assert subscription.product_id is not None

        # Regression guard for missing JobQueueManager in production: the
        # services enqueue jobs during create. If a real manager isn't set up
        # they raise at runtime. Assert the manager observed the enqueues.
        manager = _job_queue_manager.get()
        assert manager is not None
        assert len(manager._enqueued_jobs) > 0

    async def test_skips_existing_customer(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        account: Account,
        account_second: Account,
        monkeypatch: pytest.MonkeyPatch,
    ) -> None:
        self_org = await _setup_self_org(save_fixture, account, monkeypatch)

        target_org = await create_organization(save_fixture, account_second)
        user = await create_user(save_fixture)
        await save_fixture(UserOrganization(user=user, organization=target_org))

        pre_existing = await create_customer(
            save_fixture,
            organization=self_org,
            external_id=str(target_org.id),
            email="preexisting@example.com",
            name="Pre-existing",
        )

        await run_backfill(session=session)

        customers = (
            (
                await session.execute(
                    select(Customer).where(
                        Customer.organization_id == self_org.id,
                        Customer.external_id == str(target_org.id),
                    )
                )
            )
            .scalars()
            .all()
        )
        assert len(customers) == 1
        assert customers[0].id == pre_existing.id

        members = (
            (
                await session.execute(
                    select(Member).where(Member.customer_id == pre_existing.id)
                )
            )
            .scalars()
            .all()
        )
        assert members == []

    async def test_skips_organization_with_no_members(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        account: Account,
        account_second: Account,
        monkeypatch: pytest.MonkeyPatch,
    ) -> None:
        self_org = await _setup_self_org(save_fixture, account, monkeypatch)

        target_org = await create_organization(save_fixture, account_second)

        await run_backfill(session=session)

        customers = (
            (
                await session.execute(
                    select(Customer).where(
                        Customer.organization_id == self_org.id,
                        Customer.external_id == str(target_org.id),
                    )
                )
            )
            .scalars()
            .all()
        )
        assert customers == []

    async def test_error_isolation_across_organizations(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        account: Account,
        account_second: Account,
        monkeypatch: pytest.MonkeyPatch,
    ) -> None:
        self_org = await _setup_self_org(save_fixture, account, monkeypatch)

        failing_org = await create_organization(save_fixture, account_second)
        failing_user = await create_user(save_fixture)
        await save_fixture(
            UserOrganization(user=failing_user, organization=failing_org)
        )

        # Block failing_org by occupying its email slot in self_org's unique index.
        await create_customer(
            save_fixture,
            organization=self_org,
            external_id="blocker-external-id",
            email=failing_user.email,
            name="Blocker",
        )

        ok_account = await create_account(save_fixture, await create_user(save_fixture))
        ok_org = await create_organization(save_fixture, ok_account)
        ok_user = await create_user(save_fixture)
        await save_fixture(UserOrganization(user=ok_user, organization=ok_org))

        result = await run_backfill(session=session)

        assert result.errors == 1
        assert result.customers_created == 1
        assert result.members_created == 1
        assert result.subscriptions_created == 1

        failing_customer = (
            await session.execute(
                select(Customer).where(Customer.external_id == str(failing_org.id))
            )
        ).scalar_one_or_none()
        assert failing_customer is None

        ok_customer = (
            await session.execute(
                select(Customer).where(Customer.external_id == str(ok_org.id))
            )
        ).scalar_one()
        assert ok_customer.organization_id == self_org.id

        ok_subscription = (
            await session.execute(
                select(Subscription).where(Subscription.customer_id == ok_customer.id)
            )
        ).scalar_one()
        assert ok_subscription.customer_id == ok_customer.id

    async def test_dry_run_creates_nothing(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        account: Account,
        account_second: Account,
        monkeypatch: pytest.MonkeyPatch,
    ) -> None:
        self_org = await _setup_self_org(save_fixture, account, monkeypatch)

        target_org = await create_organization(save_fixture, account_second)
        user = await create_user(save_fixture)
        await save_fixture(UserOrganization(user=user, organization=target_org))

        await run_backfill(session=session, dry_run=True)

        customers = (
            (
                await session.execute(
                    select(Customer).where(Customer.organization_id == self_org.id)
                )
            )
            .scalars()
            .all()
        )
        assert customers == []
