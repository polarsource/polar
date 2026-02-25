"""
Tests for the test sales detection query in the organizations_v2 backoffice.

The test sales query should only count orders from actual org team members
(UserOrganization + User), NOT from Member entities (which are customer
usage entities).

This was a bug where the query used Member.email instead of User.email
joined through UserOrganization, causing all customer orders to be
incorrectly flagged as "test sales" when those customers had Member records.
"""

from datetime import UTC, datetime

import pytest

from polar.backoffice.organizations_v2.endpoints import count_test_sales
from polar.models import UserOrganization
from polar.models.order import OrderStatus
from polar.postgres import AsyncSession
from tests.fixtures.database import SaveFixture
from tests.fixtures.random_objects import (
    create_customer,
    create_member,
    create_order,
    create_organization,
    create_user,
)


@pytest.mark.asyncio
class TestCountTestSales:
    async def test_member_orders_not_counted_as_test_sales(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
    ) -> None:
        """
        Orders from customers who have Member records (usage entities)
        but are NOT org team members should NOT be counted as test sales.

        This is the core regression test for the bug where Member.email
        was used instead of User.email joined through UserOrganization.
        """
        org = await create_organization(save_fixture)

        # Create an org team member (the actual owner)
        owner = await create_user(save_fixture)
        owner_uo = UserOrganization(user=owner, organization=org)
        await save_fixture(owner_uo)

        # Create a regular customer who purchases a product
        customer = await create_customer(
            save_fixture,
            organization=org,
            email="paying-customer@example.com",
            stripe_customer_id="STRIPE_CUST_1",
        )
        await create_order(save_fixture, customer=customer, subtotal_amount=3900)

        # Create a Member record for this customer (usage entity)
        # This is the normal flow — customers get Member records for product access
        await create_member(
            save_fixture,
            customer=customer,
            organization=org,
            email="paying-customer@example.com",
        )

        total, unrefunded = await count_test_sales(session, org.id)

        # The customer's order should NOT be counted as a test sale
        assert total == 0
        assert unrefunded == 0

    async def test_team_member_order_counted_as_test_sale(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
    ) -> None:
        """
        Orders from actual org team members (UserOrganization) should
        be counted as test sales.
        """
        org = await create_organization(save_fixture)

        # Create an org team member
        team_user = await create_user(save_fixture)
        team_uo = UserOrganization(user=team_user, organization=org)
        await save_fixture(team_uo)

        # That team member also purchases from the org (self-test)
        customer = await create_customer(
            save_fixture,
            organization=org,
            email=team_user.email,
            stripe_customer_id="STRIPE_CUST_TEAM",
        )
        await create_order(save_fixture, customer=customer, subtotal_amount=1000)

        total, unrefunded = await count_test_sales(session, org.id)

        assert total == 1
        assert unrefunded == 1

    async def test_team_member_refunded_order_not_counted_as_unrefunded(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
    ) -> None:
        """Refunded test orders should not appear in the unrefunded count."""
        org = await create_organization(save_fixture)

        team_user = await create_user(save_fixture)
        team_uo = UserOrganization(user=team_user, organization=org)
        await save_fixture(team_uo)

        customer = await create_customer(
            save_fixture,
            organization=org,
            email=team_user.email,
            stripe_customer_id="STRIPE_CUST_REFUND",
        )
        await create_order(
            save_fixture,
            customer=customer,
            subtotal_amount=1000,
            status=OrderStatus.refunded,
        )

        total, unrefunded = await count_test_sales(session, org.id)

        assert total == 1
        assert unrefunded == 0

    async def test_zero_amount_orders_excluded(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
    ) -> None:
        """Orders with net_amount <= 0 should not be counted as test sales."""
        org = await create_organization(save_fixture)

        team_user = await create_user(save_fixture)
        team_uo = UserOrganization(user=team_user, organization=org)
        await save_fixture(team_uo)

        customer = await create_customer(
            save_fixture,
            organization=org,
            email=team_user.email,
            stripe_customer_id="STRIPE_CUST_FREE",
        )
        # Free order (net_amount = subtotal - discount = 0)
        await create_order(
            save_fixture,
            customer=customer,
            subtotal_amount=1000,
            discount_amount=1000,
        )

        total, unrefunded = await count_test_sales(session, org.id)

        assert total == 0
        assert unrefunded == 0

    async def test_many_members_not_false_positive(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
    ) -> None:
        """
        An org with many customers/members but only a few team members
        should not have customer orders flagged as test sales.

        This reproduces the real-world scenario: SellCOD had 60 Member
        records (one per customer) and only 2 actual team members, but
        all customer orders matching Member emails were flagged.
        """
        org = await create_organization(save_fixture)

        # 2 actual org team members
        team_user_1 = await create_user(save_fixture)
        team_user_2 = await create_user(save_fixture)
        await save_fixture(UserOrganization(user=team_user_1, organization=org))
        await save_fixture(UserOrganization(user=team_user_2, organization=org))

        # 5 regular customers, each with a Member record and an order
        for i in range(5):
            cust = await create_customer(
                save_fixture,
                organization=org,
                email=f"customer-{i}@example.com",
                stripe_customer_id=f"STRIPE_CUST_{i}",
            )
            await create_order(save_fixture, customer=cust, subtotal_amount=3900)
            await create_member(
                save_fixture,
                customer=cust,
                organization=org,
                email=f"customer-{i}@example.com",
            )

        total, unrefunded = await count_test_sales(session, org.id)

        # None of the 5 customer orders should be test sales
        assert total == 0
        assert unrefunded == 0

    async def test_case_insensitive_email_matching(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
    ) -> None:
        """Email matching should be case-insensitive."""
        org = await create_organization(save_fixture)

        team_user = await create_user(save_fixture)
        team_uo = UserOrganization(user=team_user, organization=org)
        await save_fixture(team_uo)

        # Customer email uses different case than User.email
        customer = await create_customer(
            save_fixture,
            organization=org,
            email=team_user.email.upper(),
            stripe_customer_id="STRIPE_CUST_CASE",
        )
        await create_order(save_fixture, customer=customer, subtotal_amount=1000)

        total, unrefunded = await count_test_sales(session, org.id)

        assert total == 1
        assert unrefunded == 1

    async def test_deleted_team_member_not_counted(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
    ) -> None:
        """
        Orders from users who were removed from the org team
        (deleted UserOrganization) should not be counted.
        """
        org = await create_organization(save_fixture)

        former_member = await create_user(save_fixture)
        uo = UserOrganization(user=former_member, organization=org)
        await save_fixture(uo)
        # Soft-delete the membership
        uo.deleted_at = datetime.now(UTC)
        await save_fixture(uo)

        customer = await create_customer(
            save_fixture,
            organization=org,
            email=former_member.email,
            stripe_customer_id="STRIPE_CUST_FORMER",
        )
        await create_order(save_fixture, customer=customer, subtotal_amount=1000)

        total, unrefunded = await count_test_sales(session, org.id)

        assert total == 0
        assert unrefunded == 0
