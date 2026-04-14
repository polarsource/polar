from unittest.mock import AsyncMock, MagicMock

import pytest

from polar.integrations.polar.client import PolarSelfClient, PolarSelfClientError
from polar.kit.db.postgres import AsyncSession
from polar.models import Account, UserOrganization
from scripts.backfill_polar_self_customers import run_backfill
from tests.fixtures.database import SaveFixture
from tests.fixtures.random_objects import create_organization, create_user


def _make_client(customer_id: str = "polar-customer-123") -> AsyncMock:
    client = AsyncMock(spec=PolarSelfClient)
    client.create_customer.return_value = MagicMock(id=customer_id)
    return client


@pytest.mark.asyncio
class TestBackfillPolarSelfCustomers:
    async def test_creates_customer_and_members(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        account: Account,
    ) -> None:
        org = await create_organization(save_fixture, account, email="org@example.com")
        user1 = await create_user(save_fixture)
        user2 = await create_user(save_fixture)
        await save_fixture(UserOrganization(user=user1, organization=org))
        await save_fixture(UserOrganization(user=user2, organization=org))

        client = _make_client()

        result = await run_backfill(session=session, client=client)

        assert result.customers_created == 1
        assert result.members_created == 2
        assert result.skipped_no_email == 0
        assert result.errors == 0

        client.create_customer.assert_called_once()
        assert client.create_customer.call_args.kwargs["email"] == "org@example.com"
        client.create_free_subscription.assert_called_once()
        client.get_customer_by_external_id.assert_not_called()

        member_external_ids = {
            call.kwargs["external_id"] for call in client.add_member.call_args_list
        }
        assert member_external_ids == {str(user1.id), str(user2.id)}
        for call in client.add_member.call_args_list:
            assert call.kwargs["customer_id"] == "polar-customer-123"

    async def test_falls_back_to_first_member_email(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        account: Account,
    ) -> None:
        org = await create_organization(save_fixture, account)
        assert org.email is None
        first_user = await create_user(save_fixture)
        second_user = await create_user(save_fixture)
        await save_fixture(UserOrganization(user=first_user, organization=org))
        await save_fixture(UserOrganization(user=second_user, organization=org))

        client = _make_client()

        result = await run_backfill(session=session, client=client)

        assert result.customers_created == 1
        assert client.create_customer.call_args.kwargs["email"] == first_user.email

    async def test_skips_organization_with_no_email_and_no_members(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        account: Account,
    ) -> None:
        await create_organization(save_fixture, account)

        client = _make_client()

        result = await run_backfill(session=session, client=client)

        assert result.customers_created == 0
        assert result.skipped_no_email == 1
        assert result.errors == 0
        client.create_customer.assert_not_called()

    async def test_creates_customer_without_members_when_org_has_email(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        account: Account,
    ) -> None:
        await create_organization(save_fixture, account, email="solo@example.com")

        client = _make_client()

        result = await run_backfill(session=session, client=client)

        assert result.customers_created == 1
        assert result.members_created == 0
        assert result.skipped_no_email == 0
        client.create_customer.assert_called_once()
        client.add_member.assert_not_called()

    async def test_skips_deleted_user_organization(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        account: Account,
    ) -> None:
        org = await create_organization(save_fixture, account, email="org@example.com")
        active_user = await create_user(save_fixture)
        deleted_user = await create_user(save_fixture)
        await save_fixture(UserOrganization(user=active_user, organization=org))
        deleted_uo = UserOrganization(user=deleted_user, organization=org)
        await save_fixture(deleted_uo)
        deleted_uo.set_deleted_at()
        await save_fixture(deleted_uo)

        client = _make_client()

        result = await run_backfill(session=session, client=client)

        assert result.members_created == 1
        assert client.add_member.call_args.kwargs["external_id"] == str(active_user.id)

    async def test_skips_soft_deleted_users(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        account: Account,
    ) -> None:
        org = await create_organization(save_fixture, account, email="org@example.com")
        active_user = await create_user(save_fixture)
        deleted_user = await create_user(save_fixture)
        await save_fixture(UserOrganization(user=active_user, organization=org))
        await save_fixture(UserOrganization(user=deleted_user, organization=org))
        deleted_user.set_deleted_at()
        await save_fixture(deleted_user)

        client = _make_client()

        result = await run_backfill(session=session, client=client)

        assert result.members_created == 1
        assert client.add_member.call_args.kwargs["external_id"] == str(active_user.id)

    async def test_customer_failure_continues_to_next_organization(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        account: Account,
        account_second: Account,
    ) -> None:
        failing_org = await create_organization(
            save_fixture, account, email="fail@example.com"
        )
        ok_org = await create_organization(
            save_fixture, account_second, email="ok@example.com"
        )
        ok_user = await create_user(save_fixture)
        await save_fixture(UserOrganization(user=ok_user, organization=ok_org))

        client = _make_client()
        client.create_customer.side_effect = [
            PolarSelfClientError("create failed"),
            MagicMock(id="polar-customer-ok"),
        ]

        result = await run_backfill(session=session, client=client)

        assert result.customers_created == 1
        assert result.members_created == 1
        assert result.errors == 1
        assert client.create_customer.call_count == 2
        external_ids = [
            call.kwargs["external_id"] for call in client.create_customer.call_args_list
        ]
        assert external_ids == [str(failing_org.id), str(ok_org.id)]
        client.create_free_subscription.assert_called_once_with(
            external_customer_id=str(ok_org.id),
            product_id=client.create_free_subscription.call_args.kwargs["product_id"],
        )

    async def test_subscription_failure_still_adds_members(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        account: Account,
    ) -> None:
        org = await create_organization(save_fixture, account, email="org@example.com")
        user = await create_user(save_fixture)
        await save_fixture(UserOrganization(user=user, organization=org))

        client = _make_client()
        client.create_free_subscription.side_effect = PolarSelfClientError(
            "subscription failed"
        )

        result = await run_backfill(session=session, client=client)

        assert result.customers_created == 1
        assert result.members_created == 1
        assert result.errors == 1
        client.add_member.assert_called_once()

    async def test_member_failure_continues_with_other_members(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        account: Account,
    ) -> None:
        org = await create_organization(save_fixture, account, email="org@example.com")
        user_a = await create_user(save_fixture)
        user_b = await create_user(save_fixture)
        await save_fixture(UserOrganization(user=user_a, organization=org))
        await save_fixture(UserOrganization(user=user_b, organization=org))

        client = _make_client()
        client.add_member.side_effect = [
            PolarSelfClientError("member A failed"),
            None,
        ]

        result = await run_backfill(session=session, client=client)

        assert result.customers_created == 1
        assert result.members_created == 1
        assert result.errors == 1
        assert client.add_member.call_count == 2

    async def test_dry_run_makes_no_api_calls(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        account: Account,
    ) -> None:
        org = await create_organization(save_fixture, account, email="org@example.com")
        user = await create_user(save_fixture)
        await save_fixture(UserOrganization(user=user, organization=org))

        client = _make_client()

        result = await run_backfill(session=session, client=client, dry_run=True)

        assert result.customers_created == 0
        assert result.members_created == 0
        assert result.skipped_no_email == 0
        client.create_customer.assert_not_called()
        client.create_free_subscription.assert_not_called()
        client.add_member.assert_not_called()
