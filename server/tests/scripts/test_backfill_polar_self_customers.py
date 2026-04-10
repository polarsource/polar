from unittest.mock import AsyncMock, MagicMock

import pytest

from polar.integrations.polar.client import PolarSelfClient
from polar.kit.db.postgres import AsyncSession
from polar.models import Account, UserOrganization
from scripts.backfill_polar_self_customers import run_backfill
from tests.fixtures.database import SaveFixture
from tests.fixtures.random_objects import create_organization, create_user


@pytest.mark.asyncio
class TestBackfillPolarSelfCustomers:
    async def test_creates_customer_and_members(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        account: Account,
    ) -> None:
        org = await create_organization(save_fixture, account)
        user1 = await create_user(save_fixture)
        user2 = await create_user(save_fixture)
        await save_fixture(UserOrganization(user=user1, organization=org))
        await save_fixture(UserOrganization(user=user2, organization=org))

        fake_customer = MagicMock(id="polar-customer-123")
        client = AsyncMock(spec=PolarSelfClient)
        client.get_customer_by_external_id.return_value = fake_customer

        result = await run_backfill(session=session, client=client)

        assert result.created == 1
        assert result.errors == 0

        client.create_customer.assert_called_once()
        client.create_free_subscription.assert_called_once()
        client.get_customer_by_external_id.assert_called_once_with(str(org.id))

        assert client.add_member.call_count == 2
        member_external_ids = {
            call.kwargs["external_id"] for call in client.add_member.call_args_list
        }
        assert member_external_ids == {str(user1.id), str(user2.id)}
        for call in client.add_member.call_args_list:
            assert call.kwargs["customer_id"] == "polar-customer-123"

    async def test_skips_deleted_members(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        account: Account,
    ) -> None:
        org = await create_organization(save_fixture, account)
        active_user = await create_user(save_fixture)
        deleted_user = await create_user(save_fixture)
        await save_fixture(UserOrganization(user=active_user, organization=org))
        deleted_uo = UserOrganization(user=deleted_user, organization=org)
        await save_fixture(deleted_uo)
        deleted_uo.set_deleted_at()
        await save_fixture(deleted_uo)

        fake_customer = MagicMock(id="polar-customer-456")
        client = AsyncMock(spec=PolarSelfClient)
        client.get_customer_by_external_id.return_value = fake_customer

        result = await run_backfill(session=session, client=client)

        assert result.created == 1
        assert client.add_member.call_count == 1
        assert client.add_member.call_args.kwargs["external_id"] == str(active_user.id)
