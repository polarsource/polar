import uuid

import pytest
from sqlalchemy import select

from polar.enums import SubscriptionRecurringInterval
from polar.kit.db.postgres import AsyncSession
from polar.kit.utils import utc_now
from polar.models import Customer, CustomerSeat
from polar.models.benefit import BenefitType
from polar.models.benefit_grant import BenefitGrant
from polar.models.customer import (
    CustomerOAuthAccount,
    CustomerOAuthPlatform,
    CustomerType,
)
from polar.models.customer_seat import SeatStatus
from polar.models.license_key import LicenseKey
from polar.models.member import Member, MemberRole
from polar.models.subscription import SubscriptionStatus
from polar.organization.tasks import (
    OrganizationDoesNotExist,
    backfill_members,
)
from tests.fixtures.database import SaveFixture
from tests.fixtures.random_objects import (
    create_benefit,
    create_benefit_grant,
    create_customer,
    create_customer_seat,
    create_order,
    create_organization,
    create_product,
    create_subscription,
    create_subscription_with_seats,
)


@pytest.mark.asyncio
class TestBackfillMembers:
    async def test_not_existing_organization(self, session: AsyncSession) -> None:
        session.expunge_all()
        with pytest.raises(OrganizationDoesNotExist):
            await backfill_members(uuid.uuid4())

    async def test_skips_when_flag_disabled(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
    ) -> None:
        organization = await create_organization(
            save_fixture, feature_settings={"member_model_enabled": False}
        )
        customer = await create_customer(
            save_fixture, organization=organization, email="c@test.com"
        )

        session.expunge_all()
        await backfill_members(organization.id)

        # No owner members should be created
        stmt = select(Member).where(
            Member.organization_id == organization.id,
            Member.role == MemberRole.owner,
        )
        result = await session.execute(stmt)
        assert len(result.scalars().all()) == 0

    async def test_creates_owner_members_for_all_customers(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
    ) -> None:
        organization = await create_organization(
            save_fixture, feature_settings={"member_model_enabled": True}
        )
        c1 = await create_customer(
            save_fixture,
            organization=organization,
            email="alice@test.com",
            stripe_customer_id="stripe_1",
        )
        c2 = await create_customer(
            save_fixture,
            organization=organization,
            email="bob@test.com",
            stripe_customer_id="stripe_2",
        )

        session.expunge_all()
        await backfill_members(organization.id)

        # Both customers should now have owner members
        stmt = select(Member).where(
            Member.organization_id == organization.id,
            Member.role == MemberRole.owner,
            Member.deleted_at.is_(None),
        )
        result = await session.execute(stmt)
        members = result.scalars().all()
        assert len(members) == 2

        member_customer_ids = {m.customer_id for m in members}
        assert c1.id in member_customer_ids
        assert c2.id in member_customer_ids

    async def test_skips_customers_with_existing_owner_member(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
    ) -> None:
        organization = await create_organization(
            save_fixture, feature_settings={"member_model_enabled": True}
        )
        customer = await create_customer(
            save_fixture, organization=organization, email="has-owner@test.com"
        )

        # Pre-create an owner member
        existing_member = Member(
            customer_id=customer.id,
            organization_id=organization.id,
            email=customer.email,
            role=MemberRole.owner,
        )
        await save_fixture(existing_member)

        session.expunge_all()
        await backfill_members(organization.id)

        # Should still be exactly 1 owner member, not 2
        stmt = select(Member).where(
            Member.customer_id == customer.id,
            Member.role == MemberRole.owner,
            Member.deleted_at.is_(None),
        )
        result = await session.execute(stmt)
        members = result.scalars().all()
        assert len(members) == 1
        assert members[0].id == existing_member.id

    async def test_idempotent_run_twice(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
    ) -> None:
        organization = await create_organization(
            save_fixture, feature_settings={"member_model_enabled": True}
        )
        await create_customer(
            save_fixture,
            organization=organization,
            email="idem@test.com",
            stripe_customer_id="stripe_idem",
        )

        session.expunge_all()
        await backfill_members(organization.id)
        await backfill_members(organization.id)

        # Should still be exactly 1 owner member
        stmt = select(Member).where(
            Member.organization_id == organization.id,
            Member.role == MemberRole.owner,
            Member.deleted_at.is_(None),
        )
        result = await session.execute(stmt)
        members = result.scalars().all()
        assert len(members) == 1

    async def test_migrates_claimed_seat_billing_manager_is_holder(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
    ) -> None:
        """When billing manager holds the seat, customer_id stays the same
        and member_id points to their owner member."""
        organization = await create_organization(
            save_fixture,
            feature_settings={
                "member_model_enabled": True,
                "seat_based_pricing_enabled": True,
            },
        )
        billing_customer = await create_customer(
            save_fixture,
            organization=organization,
            email="billing@test.com",
            stripe_customer_id="stripe_billing",
        )
        product = await create_product(
            save_fixture,
            organization=organization,
            recurring_interval=SubscriptionRecurringInterval.month,
            prices=[("seat", 1000, "usd")],
        )
        subscription = await create_subscription_with_seats(
            save_fixture,
            product=product,
            customer=billing_customer,
            seats=1,
        )

        # Billing manager holds their own seat (legacy pattern)
        seat = await create_customer_seat(
            save_fixture,
            subscription=subscription,
            status=SeatStatus.claimed,
            customer=billing_customer,
            claimed_at=utc_now(),
        )

        session.expunge_all()
        await backfill_members(organization.id)

        # Reload the seat
        refreshed_seat = await session.get(CustomerSeat, seat.id)
        assert refreshed_seat is not None
        assert refreshed_seat.customer_id == billing_customer.id
        assert refreshed_seat.member_id is not None
        assert refreshed_seat.email is not None

        # Verify member is the billing customer's owner member
        member = await session.get(Member, refreshed_seat.member_id)
        assert member is not None
        assert member.customer_id == billing_customer.id
        assert member.role == MemberRole.owner

    async def test_migrates_claimed_seat_different_holder(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
    ) -> None:
        """When someone else holds the seat, customer_id changes to billing
        customer and a new member is created under the billing customer."""
        organization = await create_organization(
            save_fixture,
            feature_settings={
                "member_model_enabled": True,
                "seat_based_pricing_enabled": True,
            },
        )
        billing_customer = await create_customer(
            save_fixture,
            organization=organization,
            email="billing@test.com",
            stripe_customer_id="stripe_billing_2",
        )
        seat_holder_customer = await create_customer(
            save_fixture,
            organization=organization,
            email="seat-holder@test.com",
            stripe_customer_id="stripe_holder",
        )
        product = await create_product(
            save_fixture,
            organization=organization,
            recurring_interval=SubscriptionRecurringInterval.month,
            prices=[("seat", 1000, "usd")],
        )
        subscription = await create_subscription_with_seats(
            save_fixture,
            product=product,
            customer=billing_customer,
            seats=2,
        )

        # Seat held by a different customer (legacy pattern)
        seat = await create_customer_seat(
            save_fixture,
            subscription=subscription,
            status=SeatStatus.claimed,
            customer=seat_holder_customer,
            claimed_at=utc_now(),
        )

        session.expunge_all()
        await backfill_members(organization.id)

        refreshed_seat = await session.get(CustomerSeat, seat.id)
        assert refreshed_seat is not None
        # customer_id should be migrated to billing customer
        assert refreshed_seat.customer_id == billing_customer.id
        assert refreshed_seat.member_id is not None
        assert refreshed_seat.email == "seat-holder@test.com"

        # Verify the member is under the billing customer with member role
        member = await session.get(Member, refreshed_seat.member_id)
        assert member is not None
        assert member.customer_id == billing_customer.id
        assert member.email == "seat-holder@test.com"
        assert member.role == MemberRole.member

    async def test_migrates_pending_seat_with_holder(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
    ) -> None:
        """Pending seats held by a different customer: customer_id migrated
        to billing customer, email preserved, member created."""
        organization = await create_organization(
            save_fixture,
            feature_settings={
                "member_model_enabled": True,
                "seat_based_pricing_enabled": True,
            },
        )
        billing_customer = await create_customer(
            save_fixture,
            organization=organization,
            email="billing@test.com",
            stripe_customer_id="stripe_billing_p",
        )
        seat_holder_customer = await create_customer(
            save_fixture,
            organization=organization,
            email="pending-holder@test.com",
            stripe_customer_id="stripe_pending_holder",
        )
        product = await create_product(
            save_fixture,
            organization=organization,
            recurring_interval=SubscriptionRecurringInterval.month,
            prices=[("seat", 1000, "usd")],
        )
        subscription = await create_subscription_with_seats(
            save_fixture,
            product=product,
            customer=billing_customer,
            seats=1,
        )

        seat = await create_customer_seat(
            save_fixture,
            subscription=subscription,
            status=SeatStatus.pending,
            customer=seat_holder_customer,
        )

        session.expunge_all()
        await backfill_members(organization.id)

        refreshed_seat = await session.get(CustomerSeat, seat.id)
        assert refreshed_seat is not None
        assert refreshed_seat.customer_id == billing_customer.id
        assert refreshed_seat.email == "pending-holder@test.com"
        assert refreshed_seat.member_id is not None

        # Verify the member is under the billing customer with member role
        member = await session.get(Member, refreshed_seat.member_id)
        assert member is not None
        assert member.customer_id == billing_customer.id
        assert member.email == "pending-holder@test.com"
        assert member.role == MemberRole.member

    async def test_migrates_pending_seat_no_holder(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
    ) -> None:
        """Pending seats with no holder: customer_id migrated,
        member_id stays NULL since there's no email."""
        organization = await create_organization(
            save_fixture,
            feature_settings={
                "member_model_enabled": True,
                "seat_based_pricing_enabled": True,
            },
        )
        billing_customer = await create_customer(
            save_fixture,
            organization=organization,
            email="billing@test.com",
            stripe_customer_id="stripe_billing_pn",
        )
        product = await create_product(
            save_fixture,
            organization=organization,
            recurring_interval=SubscriptionRecurringInterval.month,
            prices=[("seat", 1000, "usd")],
        )
        subscription = await create_subscription_with_seats(
            save_fixture,
            product=product,
            customer=billing_customer,
            seats=1,
        )

        seat = await create_customer_seat(
            save_fixture,
            subscription=subscription,
            status=SeatStatus.pending,
        )

        session.expunge_all()
        await backfill_members(organization.id)

        refreshed_seat = await session.get(CustomerSeat, seat.id)
        assert refreshed_seat is not None
        assert refreshed_seat.customer_id == billing_customer.id
        assert refreshed_seat.member_id is None

    async def test_skips_revoked_seats(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
    ) -> None:
        organization = await create_organization(
            save_fixture,
            feature_settings={
                "member_model_enabled": True,
                "seat_based_pricing_enabled": True,
            },
        )
        customer = await create_customer(
            save_fixture,
            organization=organization,
            email="revoked@test.com",
            stripe_customer_id="stripe_revoked",
        )
        product = await create_product(
            save_fixture,
            organization=organization,
            recurring_interval=SubscriptionRecurringInterval.month,
            prices=[("seat", 1000, "usd")],
        )
        subscription = await create_subscription_with_seats(
            save_fixture,
            product=product,
            customer=customer,
            seats=1,
        )

        seat = await create_customer_seat(
            save_fixture,
            subscription=subscription,
            status=SeatStatus.revoked,
            customer=customer,
        )

        session.expunge_all()
        await backfill_members(organization.id)

        refreshed_seat = await session.get(CustomerSeat, seat.id)
        assert refreshed_seat is not None
        # Revoked seats should not be modified
        assert refreshed_seat.member_id is None

    async def test_links_benefit_grants_to_owner_members(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
    ) -> None:
        organization = await create_organization(
            save_fixture, feature_settings={"member_model_enabled": True}
        )
        customer = await create_customer(
            save_fixture,
            organization=organization,
            email="granted@test.com",
            stripe_customer_id="stripe_grant",
        )
        benefit = await create_benefit(save_fixture, organization=organization)
        product = await create_product(
            save_fixture,
            organization=organization,
            recurring_interval=SubscriptionRecurringInterval.month,
        )
        subscription = (
            await create_subscription_with_seats(
                save_fixture,
                product=product,
                customer=customer,
                seats=0,
                # Use regular subscription, not seat-based
            )
            if False
            else None
        )

        # Create subscription for the grant scope (non-seat-based)
        from tests.fixtures.random_objects import create_subscription

        subscription = await create_subscription(
            save_fixture,
            product=product,
            customer=customer,
            status=SubscriptionStatus.active,
            started_at=utc_now(),
        )

        # Create a benefit grant without member_id (legacy)
        grant = await create_benefit_grant(
            save_fixture,
            customer=customer,
            benefit=benefit,
            granted=True,
            subscription=subscription,
        )
        assert grant.member_id is None

        session.expunge_all()
        await backfill_members(organization.id)

        refreshed_grant = await session.get(BenefitGrant, grant.id)
        assert refreshed_grant is not None
        assert refreshed_grant.member_id is not None

        # Verify it points to the customer's owner member
        member = await session.get(Member, refreshed_grant.member_id)
        assert member is not None
        assert member.customer_id == customer.id
        assert member.role == MemberRole.owner

    async def test_links_seat_based_grants_to_seat_member(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
    ) -> None:
        """Grants from a billing manager's subscription should be linked to the
        seat member, not the owner member, when the customer has a seat."""
        organization = await create_organization(
            save_fixture,
            feature_settings={
                "member_model_enabled": True,
                "seat_based_pricing_enabled": True,
            },
        )
        billing_customer = await create_customer(
            save_fixture,
            organization=organization,
            email="billing@test.com",
            stripe_customer_id="stripe_billing_seat_grant",
        )
        product = await create_product(
            save_fixture,
            organization=organization,
            recurring_interval=SubscriptionRecurringInterval.month,
            prices=[("seat", 1000, "usd")],
        )
        benefit = await create_benefit(
            save_fixture,
            organization=organization,
            type=BenefitType.custom,
            description="Seat benefit",
        )
        subscription = await create_subscription_with_seats(
            save_fixture,
            product=product,
            customer=billing_customer,
            seats=1,
        )

        # Billing manager holds a seat (claimed by themselves)
        seat = await create_customer_seat(
            save_fixture,
            subscription=subscription,
            status=SeatStatus.claimed,
            customer=billing_customer,
            claimed_at=utc_now(),
        )

        # Grant under billing customer, scoped to subscription (no member_id yet)
        grant = await create_benefit_grant(
            save_fixture,
            customer=billing_customer,
            benefit=benefit,
            granted=True,
            subscription=subscription,
        )
        assert grant.member_id is None

        session.expunge_all()
        await backfill_members(organization.id)

        # The seat should now have a member_id (set by Step B)
        refreshed_seat = await session.get(CustomerSeat, seat.id)
        assert refreshed_seat is not None
        assert refreshed_seat.member_id is not None

        # The grant should be linked to the seat member (which is the owner
        # member in this case, since billing manager holds their own seat)
        refreshed_grant = await session.get(BenefitGrant, grant.id)
        assert refreshed_grant is not None
        assert refreshed_grant.member_id == refreshed_seat.member_id

    async def test_does_not_modify_grants_with_existing_member_id(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
    ) -> None:
        organization = await create_organization(
            save_fixture, feature_settings={"member_model_enabled": True}
        )
        customer = await create_customer(
            save_fixture,
            organization=organization,
            email="existing-grant@test.com",
            stripe_customer_id="stripe_existing_grant",
        )
        benefit = await create_benefit(save_fixture, organization=organization)

        # Pre-create an owner member
        existing_member = Member(
            customer_id=customer.id,
            organization_id=organization.id,
            email=customer.email,
            role=MemberRole.owner,
        )
        await save_fixture(existing_member)

        # Create a grant that already has member_id set
        from tests.fixtures.random_objects import create_subscription

        product = await create_product(
            save_fixture,
            organization=organization,
            recurring_interval=SubscriptionRecurringInterval.month,
        )
        subscription = await create_subscription(
            save_fixture,
            product=product,
            customer=customer,
            status=SubscriptionStatus.active,
            started_at=utc_now(),
        )
        grant = await create_benefit_grant(
            save_fixture,
            customer=customer,
            benefit=benefit,
            granted=True,
            member=existing_member,
            subscription=subscription,
        )
        assert grant.member_id == existing_member.id

        session.expunge_all()
        await backfill_members(organization.id)

        # Grant's member_id should remain unchanged
        refreshed_grant = await session.get(BenefitGrant, grant.id)
        assert refreshed_grant is not None
        assert refreshed_grant.member_id == existing_member.id

    async def test_does_not_affect_other_organizations(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
    ) -> None:
        org1 = await create_organization(
            save_fixture,
            feature_settings={"member_model_enabled": True},
            name_prefix="org1",
        )
        org2 = await create_organization(
            save_fixture,
            feature_settings={"member_model_enabled": True},
            name_prefix="org2",
        )
        c1 = await create_customer(
            save_fixture,
            organization=org1,
            email="org1-customer@test.com",
            stripe_customer_id="stripe_org1",
        )
        c2 = await create_customer(
            save_fixture,
            organization=org2,
            email="org2-customer@test.com",
            stripe_customer_id="stripe_org2",
        )

        session.expunge_all()
        # Only backfill org1
        await backfill_members(org1.id)

        # org1 customer should have an owner member
        stmt = select(Member).where(
            Member.customer_id == c1.id,
            Member.role == MemberRole.owner,
            Member.deleted_at.is_(None),
        )
        result = await session.execute(stmt)
        assert len(result.scalars().all()) == 1

        # org2 customer should NOT have an owner member
        stmt = select(Member).where(
            Member.customer_id == c2.id,
            Member.role == MemberRole.owner,
            Member.deleted_at.is_(None),
        )
        result = await session.execute(stmt)
        assert len(result.scalars().all()) == 0

    async def test_transfers_grants_from_seat_holder_to_member(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
    ) -> None:
        """Benefit grants from the old seat-holder customer should be
        transferred to the new member under the billing customer."""
        organization = await create_organization(
            save_fixture,
            feature_settings={
                "member_model_enabled": True,
                "seat_based_pricing_enabled": True,
            },
        )
        billing_customer = await create_customer(
            save_fixture,
            organization=organization,
            email="billing@test.com",
            stripe_customer_id="stripe_billing_xfer",
        )
        seat_holder_customer = await create_customer(
            save_fixture,
            organization=organization,
            email="holder@test.com",
            stripe_customer_id="stripe_holder_xfer",
        )
        product = await create_product(
            save_fixture,
            organization=organization,
            recurring_interval=SubscriptionRecurringInterval.month,
            prices=[("seat", 1000, "usd")],
        )
        benefit = await create_benefit(
            save_fixture,
            organization=organization,
            type=BenefitType.custom,
            description="Test benefit",
        )
        subscription = await create_subscription_with_seats(
            save_fixture,
            product=product,
            customer=billing_customer,
            seats=1,
        )
        await create_customer_seat(
            save_fixture,
            subscription=subscription,
            status=SeatStatus.claimed,
            customer=seat_holder_customer,
            claimed_at=utc_now(),
        )

        # Create a grant under the old seat-holder customer
        grant = await create_benefit_grant(
            save_fixture,
            customer=seat_holder_customer,
            benefit=benefit,
            granted=True,
            subscription=subscription,
        )
        old_grant_id = grant.id

        session.expunge_all()
        await backfill_members(organization.id)

        # Grant should be transferred to the billing customer + new member
        refreshed_grant = await session.get(BenefitGrant, old_grant_id)
        assert refreshed_grant is not None
        assert refreshed_grant.customer_id == billing_customer.id
        assert refreshed_grant.member_id is not None

        # The member on the grant should be the seat-holder member
        member = await session.get(Member, refreshed_grant.member_id)
        assert member is not None
        assert member.customer_id == billing_customer.id
        assert member.email == "holder@test.com"
        assert member.role == MemberRole.member

    async def test_transfers_license_keys_from_seat_holder(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
    ) -> None:
        """License keys from the old seat-holder customer should be
        transferred to the billing customer."""
        organization = await create_organization(
            save_fixture,
            feature_settings={
                "member_model_enabled": True,
                "seat_based_pricing_enabled": True,
            },
        )
        billing_customer = await create_customer(
            save_fixture,
            organization=organization,
            email="billing@test.com",
            stripe_customer_id="stripe_billing_lk",
        )
        seat_holder_customer = await create_customer(
            save_fixture,
            organization=organization,
            email="holder-lk@test.com",
            stripe_customer_id="stripe_holder_lk",
        )
        product = await create_product(
            save_fixture,
            organization=organization,
            recurring_interval=SubscriptionRecurringInterval.month,
            prices=[("seat", 1000, "usd")],
        )
        benefit = await create_benefit(
            save_fixture,
            organization=organization,
            type=BenefitType.license_keys,
            description="License key benefit",
        )
        subscription = await create_subscription_with_seats(
            save_fixture,
            product=product,
            customer=billing_customer,
            seats=1,
        )
        await create_customer_seat(
            save_fixture,
            subscription=subscription,
            status=SeatStatus.claimed,
            customer=seat_holder_customer,
            claimed_at=utc_now(),
        )

        # Create a grant and license key under the old seat-holder customer
        grant = await create_benefit_grant(
            save_fixture,
            customer=seat_holder_customer,
            benefit=benefit,
            granted=True,
            subscription=subscription,
        )
        license_key = LicenseKey(
            organization_id=organization.id,
            customer_id=seat_holder_customer.id,
            benefit_id=benefit.id,
            key="POLAR-TEST-KEY-123",
        )
        await save_fixture(license_key)
        lk_id = license_key.id

        session.expunge_all()
        await backfill_members(organization.id)

        # License key should be transferred to the billing customer and member
        refreshed_lk = await session.get(LicenseKey, lk_id)
        assert refreshed_lk is not None
        assert refreshed_lk.customer_id == billing_customer.id
        assert refreshed_lk.member_id is not None

        # Grant should also be transferred
        refreshed_grant = await session.get(BenefitGrant, grant.id)
        assert refreshed_grant is not None
        assert refreshed_grant.customer_id == billing_customer.id
        assert refreshed_grant.member_id == refreshed_lk.member_id

    async def test_copies_oauth_accounts_to_owner_member(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
    ) -> None:
        """Customer OAuth accounts should be copied to the owner member."""
        organization = await create_organization(
            save_fixture,
            feature_settings={
                "member_model_enabled": True,
                "seat_based_pricing_enabled": True,
            },
        )
        customer = await create_customer(
            save_fixture,
            organization=organization,
            email="oauth-owner@test.com",
            stripe_customer_id="stripe_oauth_owner",
        )

        # Set OAuth account on customer
        oauth_account = CustomerOAuthAccount(
            access_token="gh_token_123",
            account_id="12345",
            account_username="ghuser",
        )
        customer.set_oauth_account(oauth_account, CustomerOAuthPlatform.github)
        await save_fixture(customer)

        session.expunge_all()
        await backfill_members(organization.id)

        # Find the owner member
        stmt = select(Member).where(
            Member.customer_id == customer.id,
            Member.role == MemberRole.owner,
            Member.deleted_at.is_(None),
        )
        result = await session.execute(stmt)
        owner_member = result.scalar_one()

        # OAuth account should be copied to the owner member
        member_oauth = owner_member.get_oauth_account(
            "12345", CustomerOAuthPlatform.github
        )
        assert member_oauth is not None
        assert member_oauth.access_token == "gh_token_123"
        assert member_oauth.account_username == "ghuser"

    async def test_copies_oauth_accounts_to_seat_member(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
    ) -> None:
        """Seat-holder customer OAuth accounts should be copied to the
        new member under the billing customer."""
        organization = await create_organization(
            save_fixture,
            feature_settings={
                "member_model_enabled": True,
                "seat_based_pricing_enabled": True,
            },
        )
        billing_customer = await create_customer(
            save_fixture,
            organization=organization,
            email="billing@test.com",
            stripe_customer_id="stripe_billing_oauth",
        )
        seat_holder_customer = await create_customer(
            save_fixture,
            organization=organization,
            email="seat-oauth@test.com",
            stripe_customer_id="stripe_seat_oauth",
        )

        # Set Discord OAuth on seat-holder customer
        oauth_account = CustomerOAuthAccount(
            access_token="discord_token_456",
            account_id="99999",
            account_username="discorduser",
            refresh_token="refresh_456",
        )
        seat_holder_customer.set_oauth_account(
            oauth_account, CustomerOAuthPlatform.discord
        )
        await save_fixture(seat_holder_customer)

        product = await create_product(
            save_fixture,
            organization=organization,
            recurring_interval=SubscriptionRecurringInterval.month,
            prices=[("seat", 1000, "usd")],
        )
        subscription = await create_subscription_with_seats(
            save_fixture,
            product=product,
            customer=billing_customer,
            seats=1,
        )
        await create_customer_seat(
            save_fixture,
            subscription=subscription,
            status=SeatStatus.claimed,
            customer=seat_holder_customer,
            claimed_at=utc_now(),
        )

        session.expunge_all()
        await backfill_members(organization.id)

        # Find the seat member under billing customer
        stmt = select(Member).where(
            Member.customer_id == billing_customer.id,
            Member.email == "seat-oauth@test.com",
            Member.role == MemberRole.member,
            Member.deleted_at.is_(None),
        )
        result = await session.execute(stmt)
        seat_member = result.scalar_one()

        # OAuth account should be copied from old seat-holder customer
        member_oauth = seat_member.get_oauth_account(
            "99999", CustomerOAuthPlatform.discord
        )
        assert member_oauth is not None
        assert member_oauth.access_token == "discord_token_456"
        assert member_oauth.account_username == "discorduser"
        assert member_oauth.refresh_token == "refresh_456"

    async def test_soft_deletes_orphaned_seat_holder_customer(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
    ) -> None:
        """Seat-holder customers with no subscriptions or orders
        should be soft-deleted after backfill."""
        organization = await create_organization(
            save_fixture,
            feature_settings={
                "member_model_enabled": True,
                "seat_based_pricing_enabled": True,
            },
        )
        billing_customer = await create_customer(
            save_fixture,
            organization=organization,
            email="billing@test.com",
            stripe_customer_id="stripe_billing_orphan",
        )
        seat_holder_customer = await create_customer(
            save_fixture,
            organization=organization,
            email="orphan@test.com",
            stripe_customer_id="stripe_orphan",
        )
        product = await create_product(
            save_fixture,
            organization=organization,
            recurring_interval=SubscriptionRecurringInterval.month,
            prices=[("seat", 1000, "usd")],
        )
        subscription = await create_subscription_with_seats(
            save_fixture,
            product=product,
            customer=billing_customer,
            seats=1,
        )
        await create_customer_seat(
            save_fixture,
            subscription=subscription,
            status=SeatStatus.claimed,
            customer=seat_holder_customer,
            claimed_at=utc_now(),
        )

        session.expunge_all()
        await backfill_members(organization.id)

        # The orphaned seat-holder customer should be soft-deleted
        refreshed_customer = await session.get(Customer, seat_holder_customer.id)
        assert refreshed_customer is not None
        assert refreshed_customer.deleted_at is not None

        # Their owner member should also be soft-deleted
        stmt = select(Member).where(
            Member.customer_id == seat_holder_customer.id,
        )
        result = await session.execute(stmt)
        members = result.scalars().all()
        for m in members:
            assert m.deleted_at is not None

    async def test_preserves_customer_with_subscriptions(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
    ) -> None:
        """Seat-holder customers that have their own subscriptions
        should NOT be soft-deleted."""
        organization = await create_organization(
            save_fixture,
            feature_settings={
                "member_model_enabled": True,
                "seat_based_pricing_enabled": True,
            },
        )
        billing_customer = await create_customer(
            save_fixture,
            organization=organization,
            email="billing@test.com",
            stripe_customer_id="stripe_billing_keep",
        )
        seat_holder_customer = await create_customer(
            save_fixture,
            organization=organization,
            email="has-sub@test.com",
            stripe_customer_id="stripe_has_sub",
        )
        product = await create_product(
            save_fixture,
            organization=organization,
            recurring_interval=SubscriptionRecurringInterval.month,
            prices=[("seat", 1000, "usd")],
        )
        subscription = await create_subscription_with_seats(
            save_fixture,
            product=product,
            customer=billing_customer,
            seats=1,
        )
        await create_customer_seat(
            save_fixture,
            subscription=subscription,
            status=SeatStatus.claimed,
            customer=seat_holder_customer,
            claimed_at=utc_now(),
        )

        # Give the seat holder their own subscription
        other_product = await create_product(
            save_fixture,
            organization=organization,
            recurring_interval=SubscriptionRecurringInterval.month,
        )
        await create_subscription(
            save_fixture,
            product=other_product,
            customer=seat_holder_customer,
            status=SubscriptionStatus.active,
            started_at=utc_now(),
        )

        session.expunge_all()
        await backfill_members(organization.id)

        # Customer should NOT be soft-deleted
        refreshed_customer = await session.get(Customer, seat_holder_customer.id)
        assert refreshed_customer is not None
        assert refreshed_customer.deleted_at is None

    async def test_preserves_customer_with_orders(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
    ) -> None:
        """Seat-holder customers that have orders should NOT be soft-deleted."""
        organization = await create_organization(
            save_fixture,
            feature_settings={
                "member_model_enabled": True,
                "seat_based_pricing_enabled": True,
            },
        )
        billing_customer = await create_customer(
            save_fixture,
            organization=organization,
            email="billing@test.com",
            stripe_customer_id="stripe_billing_order",
        )
        seat_holder_customer = await create_customer(
            save_fixture,
            organization=organization,
            email="has-order@test.com",
            stripe_customer_id="stripe_has_order",
        )
        product = await create_product(
            save_fixture,
            organization=organization,
            recurring_interval=SubscriptionRecurringInterval.month,
            prices=[("seat", 1000, "usd")],
        )
        subscription = await create_subscription_with_seats(
            save_fixture,
            product=product,
            customer=billing_customer,
            seats=1,
        )
        await create_customer_seat(
            save_fixture,
            subscription=subscription,
            status=SeatStatus.claimed,
            customer=seat_holder_customer,
            claimed_at=utc_now(),
        )

        # Give the seat holder an order
        order_product = await create_product(
            save_fixture,
            organization=organization,
            recurring_interval=None,
        )
        await create_order(
            save_fixture,
            customer=seat_holder_customer,
            product=order_product,
        )

        session.expunge_all()
        await backfill_members(organization.id)

        # Customer should NOT be soft-deleted
        refreshed_customer = await session.get(Customer, seat_holder_customer.id)
        assert refreshed_customer is not None
        assert refreshed_customer.deleted_at is None


@pytest.mark.asyncio
class TestBackfillMembersB2C:
    """B2C scenario: individual customers with direct (non-seat-based) subscriptions."""

    async def test_creates_owner_member_per_customer(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
    ) -> None:
        """Each B2C customer gets an owner member."""
        organization = await create_organization(
            save_fixture, feature_settings={"member_model_enabled": True}
        )
        c1 = await create_customer(
            save_fixture,
            organization=organization,
            email="alice@b2c.com",
            stripe_customer_id="stripe_b2c_1",
        )
        c2 = await create_customer(
            save_fixture,
            organization=organization,
            email="bob@b2c.com",
            stripe_customer_id="stripe_b2c_2",
        )

        session.expunge_all()
        await backfill_members(organization.id)

        for cid in [c1.id, c2.id]:
            stmt = select(Member).where(
                Member.customer_id == cid,
                Member.role == MemberRole.owner,
                Member.deleted_at.is_(None),
            )
            result = await session.execute(stmt)
            members = result.scalars().all()
            assert len(members) == 1

    async def test_customer_type_is_individual(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
    ) -> None:
        """B2C customers should have type=individual after backfill."""
        organization = await create_organization(
            save_fixture, feature_settings={"member_model_enabled": True}
        )
        customer = await create_customer(
            save_fixture,
            organization=organization,
            email="b2c-type@test.com",
            stripe_customer_id="stripe_b2c_type",
        )

        session.expunge_all()
        await backfill_members(organization.id)

        refreshed = await session.get(Customer, customer.id)
        assert refreshed is not None
        assert refreshed.type == CustomerType.individual

    async def test_benefits_linked_to_owner_member_same_customer(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
    ) -> None:
        """Benefits linked to owner member with customer_id unchanged."""
        organization = await create_organization(
            save_fixture, feature_settings={"member_model_enabled": True}
        )
        customer = await create_customer(
            save_fixture,
            organization=organization,
            email="b2c-benefits@test.com",
            stripe_customer_id="stripe_b2c_ben",
        )
        product = await create_product(
            save_fixture,
            organization=organization,
            recurring_interval=SubscriptionRecurringInterval.month,
        )
        subscription = await create_subscription(
            save_fixture,
            product=product,
            customer=customer,
            status=SubscriptionStatus.active,
            started_at=utc_now(),
        )
        benefit = await create_benefit(save_fixture, organization=organization)
        grant = await create_benefit_grant(
            save_fixture,
            customer=customer,
            benefit=benefit,
            granted=True,
            subscription=subscription,
        )

        session.expunge_all()
        await backfill_members(organization.id)

        refreshed_grant = await session.get(BenefitGrant, grant.id)
        assert refreshed_grant is not None
        # customer_id should remain the same (no transfer for B2C)
        assert refreshed_grant.customer_id == customer.id
        assert refreshed_grant.member_id is not None

        # Member should be the owner member of the same customer
        member = await session.get(Member, refreshed_grant.member_id)
        assert member is not None
        assert member.customer_id == customer.id
        assert member.role == MemberRole.owner

    async def test_oauth_copied_to_owner_member(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
    ) -> None:
        """OAuth accounts on customer are copied to the owner member."""
        organization = await create_organization(
            save_fixture, feature_settings={"member_model_enabled": True}
        )
        customer = await create_customer(
            save_fixture,
            organization=organization,
            email="b2c-oauth@test.com",
            stripe_customer_id="stripe_b2c_oauth",
        )
        oauth = CustomerOAuthAccount(
            access_token="gh_b2c_token",
            account_id="b2c_123",
            account_username="b2c_ghuser",
        )
        customer.set_oauth_account(oauth, CustomerOAuthPlatform.github)
        await save_fixture(customer)

        session.expunge_all()
        await backfill_members(organization.id)

        stmt = select(Member).where(
            Member.customer_id == customer.id,
            Member.role == MemberRole.owner,
            Member.deleted_at.is_(None),
        )
        result = await session.execute(stmt)
        owner = result.scalar_one()

        member_oauth = owner.get_oauth_account("b2c_123", CustomerOAuthPlatform.github)
        assert member_oauth is not None
        assert member_oauth.access_token == "gh_b2c_token"
        assert member_oauth.account_username == "b2c_ghuser"

    async def test_license_keys_linked_to_owner_member(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
    ) -> None:
        """B2C license keys should not be transferred (same customer)."""
        organization = await create_organization(
            save_fixture, feature_settings={"member_model_enabled": True}
        )
        customer = await create_customer(
            save_fixture,
            organization=organization,
            email="b2c-lk@test.com",
            stripe_customer_id="stripe_b2c_lk",
        )
        product = await create_product(
            save_fixture,
            organization=organization,
            recurring_interval=SubscriptionRecurringInterval.month,
        )
        subscription = await create_subscription(
            save_fixture,
            product=product,
            customer=customer,
            status=SubscriptionStatus.active,
            started_at=utc_now(),
        )
        benefit = await create_benefit(
            save_fixture,
            organization=organization,
            type=BenefitType.license_keys,
            description="B2C license key",
        )
        grant = await create_benefit_grant(
            save_fixture,
            customer=customer,
            benefit=benefit,
            granted=True,
            subscription=subscription,
        )
        license_key = LicenseKey(
            organization_id=organization.id,
            customer_id=customer.id,
            benefit_id=benefit.id,
            key="POLAR-B2C-KEY-001",
        )
        await save_fixture(license_key)
        lk_id = license_key.id

        session.expunge_all()
        await backfill_members(organization.id)

        # License key customer_id unchanged for B2C
        refreshed_lk = await session.get(LicenseKey, lk_id)
        assert refreshed_lk is not None
        assert refreshed_lk.customer_id == customer.id


@pytest.mark.asyncio
class TestBackfillMembersB2B:
    """B2B scenario: team customers with seat-based subscriptions."""

    async def test_creates_owner_member_for_billing_customer(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
    ) -> None:
        """Billing customer gets an owner member."""
        organization = await create_organization(
            save_fixture,
            feature_settings={
                "member_model_enabled": True,
                "seat_based_pricing_enabled": True,
            },
        )
        billing = await create_customer(
            save_fixture,
            organization=organization,
            email="billing@b2b.com",
            stripe_customer_id="stripe_b2b_owner",
        )
        product = await create_product(
            save_fixture,
            organization=organization,
            recurring_interval=SubscriptionRecurringInterval.month,
            prices=[("seat", 1000, "usd")],
        )
        await create_subscription_with_seats(
            save_fixture, product=product, customer=billing, seats=2
        )

        session.expunge_all()
        await backfill_members(organization.id)

        stmt = select(Member).where(
            Member.customer_id == billing.id,
            Member.role == MemberRole.owner,
            Member.deleted_at.is_(None),
        )
        result = await session.execute(stmt)
        assert len(result.scalars().all()) == 1

    async def test_customer_type_set_to_team(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
    ) -> None:
        """Billing customer with seats should have type=team after backfill."""
        organization = await create_organization(
            save_fixture,
            feature_settings={
                "member_model_enabled": True,
                "seat_based_pricing_enabled": True,
            },
        )
        billing = await create_customer(
            save_fixture,
            organization=organization,
            email="billing-type@b2b.com",
            stripe_customer_id="stripe_b2b_type",
        )
        seat_holder = await create_customer(
            save_fixture,
            organization=organization,
            email="holder-type@b2b.com",
            stripe_customer_id="stripe_b2b_holder_type",
        )
        product = await create_product(
            save_fixture,
            organization=organization,
            recurring_interval=SubscriptionRecurringInterval.month,
            prices=[("seat", 1000, "usd")],
        )
        subscription = await create_subscription_with_seats(
            save_fixture, product=product, customer=billing, seats=1
        )
        await create_customer_seat(
            save_fixture,
            subscription=subscription,
            status=SeatStatus.claimed,
            customer=seat_holder,
            claimed_at=utc_now(),
        )

        session.expunge_all()
        await backfill_members(organization.id)

        refreshed = await session.get(Customer, billing.id)
        assert refreshed is not None
        assert refreshed.type == CustomerType.team

    async def test_seat_creates_member_under_billing_customer(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
    ) -> None:
        """Each seat holder gets a member under the billing customer."""
        organization = await create_organization(
            save_fixture,
            feature_settings={
                "member_model_enabled": True,
                "seat_based_pricing_enabled": True,
            },
        )
        billing = await create_customer(
            save_fixture,
            organization=organization,
            email="billing@b2b.com",
            stripe_customer_id="stripe_b2b_seat_member",
        )
        holder1 = await create_customer(
            save_fixture,
            organization=organization,
            email="holder1@b2b.com",
            stripe_customer_id="stripe_b2b_h1",
        )
        holder2 = await create_customer(
            save_fixture,
            organization=organization,
            email="holder2@b2b.com",
            stripe_customer_id="stripe_b2b_h2",
        )
        product = await create_product(
            save_fixture,
            organization=organization,
            recurring_interval=SubscriptionRecurringInterval.month,
            prices=[("seat", 1000, "usd")],
        )
        subscription = await create_subscription_with_seats(
            save_fixture, product=product, customer=billing, seats=2
        )
        await create_customer_seat(
            save_fixture,
            subscription=subscription,
            status=SeatStatus.claimed,
            customer=holder1,
            claimed_at=utc_now(),
        )
        await create_customer_seat(
            save_fixture,
            subscription=subscription,
            status=SeatStatus.claimed,
            customer=holder2,
            claimed_at=utc_now(),
        )

        session.expunge_all()
        await backfill_members(organization.id)

        # Each seat holder should have a member (role=member) under billing customer
        stmt = select(Member).where(
            Member.customer_id == billing.id,
            Member.role == MemberRole.member,
            Member.deleted_at.is_(None),
        )
        result = await session.execute(stmt)
        members = result.scalars().all()
        assert len(members) == 2

        member_emails = {m.email for m in members}
        assert "holder1@b2b.com" in member_emails
        assert "holder2@b2b.com" in member_emails

    async def test_seat_assigned_to_member(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
    ) -> None:
        """After backfill, each seat has member_id pointing to its member."""
        organization = await create_organization(
            save_fixture,
            feature_settings={
                "member_model_enabled": True,
                "seat_based_pricing_enabled": True,
            },
        )
        billing = await create_customer(
            save_fixture,
            organization=organization,
            email="billing@b2b.com",
            stripe_customer_id="stripe_b2b_seat_assign",
        )
        holder = await create_customer(
            save_fixture,
            organization=organization,
            email="holder@b2b.com",
            stripe_customer_id="stripe_b2b_holder_assign",
        )
        product = await create_product(
            save_fixture,
            organization=organization,
            recurring_interval=SubscriptionRecurringInterval.month,
            prices=[("seat", 1000, "usd")],
        )
        subscription = await create_subscription_with_seats(
            save_fixture, product=product, customer=billing, seats=1
        )
        seat = await create_customer_seat(
            save_fixture,
            subscription=subscription,
            status=SeatStatus.claimed,
            customer=holder,
            claimed_at=utc_now(),
        )

        session.expunge_all()
        await backfill_members(organization.id)

        refreshed_seat = await session.get(CustomerSeat, seat.id)
        assert refreshed_seat is not None
        assert refreshed_seat.member_id is not None

        # Member should be under billing customer with holder's email
        member = await session.get(Member, refreshed_seat.member_id)
        assert member is not None
        assert member.customer_id == billing.id
        assert member.email == "holder@b2b.com"
        assert member.role == MemberRole.member

    async def test_seat_customer_id_points_to_billing_customer(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
    ) -> None:
        """After backfill, seat customer_id is updated to billing customer."""
        organization = await create_organization(
            save_fixture,
            feature_settings={
                "member_model_enabled": True,
                "seat_based_pricing_enabled": True,
            },
        )
        billing = await create_customer(
            save_fixture,
            organization=organization,
            email="billing@b2b.com",
            stripe_customer_id="stripe_b2b_seat_cid",
        )
        holder = await create_customer(
            save_fixture,
            organization=organization,
            email="holder@b2b.com",
            stripe_customer_id="stripe_b2b_holder_cid",
        )
        product = await create_product(
            save_fixture,
            organization=organization,
            recurring_interval=SubscriptionRecurringInterval.month,
            prices=[("seat", 1000, "usd")],
        )
        subscription = await create_subscription_with_seats(
            save_fixture, product=product, customer=billing, seats=1
        )
        seat = await create_customer_seat(
            save_fixture,
            subscription=subscription,
            status=SeatStatus.claimed,
            customer=holder,
            claimed_at=utc_now(),
        )

        # Before backfill, seat points to holder
        assert seat.customer_id == holder.id

        session.expunge_all()
        await backfill_members(organization.id)

        refreshed_seat = await session.get(CustomerSeat, seat.id)
        assert refreshed_seat is not None
        assert refreshed_seat.customer_id == billing.id

    async def test_benefits_moved_to_seat_member(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
    ) -> None:
        """Seat holder benefits are transferred to the billing customer
        and linked to the seat member."""
        organization = await create_organization(
            save_fixture,
            feature_settings={
                "member_model_enabled": True,
                "seat_based_pricing_enabled": True,
            },
        )
        billing = await create_customer(
            save_fixture,
            organization=organization,
            email="billing@b2b.com",
            stripe_customer_id="stripe_b2b_ben_move",
        )
        holder = await create_customer(
            save_fixture,
            organization=organization,
            email="holder@b2b.com",
            stripe_customer_id="stripe_b2b_holder_ben",
        )
        product = await create_product(
            save_fixture,
            organization=organization,
            recurring_interval=SubscriptionRecurringInterval.month,
            prices=[("seat", 1000, "usd")],
        )
        benefit = await create_benefit(
            save_fixture,
            organization=organization,
            type=BenefitType.custom,
            description="B2B seat benefit",
        )
        subscription = await create_subscription_with_seats(
            save_fixture, product=product, customer=billing, seats=1
        )
        await create_customer_seat(
            save_fixture,
            subscription=subscription,
            status=SeatStatus.claimed,
            customer=holder,
            claimed_at=utc_now(),
        )

        # Grant under old seat-holder customer
        grant = await create_benefit_grant(
            save_fixture,
            customer=holder,
            benefit=benefit,
            granted=True,
            subscription=subscription,
        )

        session.expunge_all()
        await backfill_members(organization.id)

        refreshed_grant = await session.get(BenefitGrant, grant.id)
        assert refreshed_grant is not None
        # customer_id transferred to billing customer
        assert refreshed_grant.customer_id == billing.id
        # member_id points to seat member
        assert refreshed_grant.member_id is not None

        member = await session.get(Member, refreshed_grant.member_id)
        assert member is not None
        assert member.customer_id == billing.id
        assert member.email == "holder@b2b.com"
        assert member.role == MemberRole.member

    async def test_license_keys_moved_to_seat_member(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
    ) -> None:
        """B2B license keys are transferred from seat holder to billing
        customer and linked to the seat member."""
        organization = await create_organization(
            save_fixture,
            feature_settings={
                "member_model_enabled": True,
                "seat_based_pricing_enabled": True,
            },
        )
        billing = await create_customer(
            save_fixture,
            organization=organization,
            email="billing@b2b.com",
            stripe_customer_id="stripe_b2b_lk_move",
        )
        holder = await create_customer(
            save_fixture,
            organization=organization,
            email="holder-lk@b2b.com",
            stripe_customer_id="stripe_b2b_holder_lk",
        )
        product = await create_product(
            save_fixture,
            organization=organization,
            recurring_interval=SubscriptionRecurringInterval.month,
            prices=[("seat", 1000, "usd")],
        )
        benefit = await create_benefit(
            save_fixture,
            organization=organization,
            type=BenefitType.license_keys,
            description="B2B license key benefit",
        )
        subscription = await create_subscription_with_seats(
            save_fixture, product=product, customer=billing, seats=1
        )
        await create_customer_seat(
            save_fixture,
            subscription=subscription,
            status=SeatStatus.claimed,
            customer=holder,
            claimed_at=utc_now(),
        )

        # Grant and license key under old seat holder
        await create_benefit_grant(
            save_fixture,
            customer=holder,
            benefit=benefit,
            granted=True,
            subscription=subscription,
        )
        license_key = LicenseKey(
            organization_id=organization.id,
            customer_id=holder.id,
            benefit_id=benefit.id,
            key="POLAR-B2B-KEY-001",
        )
        await save_fixture(license_key)
        lk_id = license_key.id

        session.expunge_all()
        await backfill_members(organization.id)

        refreshed_lk = await session.get(LicenseKey, lk_id)
        assert refreshed_lk is not None
        # License key transferred to billing customer
        assert refreshed_lk.customer_id == billing.id
        # License key linked to seat member
        assert refreshed_lk.member_id is not None

        member = await session.get(Member, refreshed_lk.member_id)
        assert member is not None
        assert member.customer_id == billing.id
        assert member.email == "holder-lk@b2b.com"
        assert member.role == MemberRole.member

    async def test_oauth_copied_to_seat_member(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
    ) -> None:
        """Seat holder OAuth accounts are copied to the seat member."""
        organization = await create_organization(
            save_fixture,
            feature_settings={
                "member_model_enabled": True,
                "seat_based_pricing_enabled": True,
            },
        )
        billing = await create_customer(
            save_fixture,
            organization=organization,
            email="billing@b2b.com",
            stripe_customer_id="stripe_b2b_oauth_move",
        )
        holder = await create_customer(
            save_fixture,
            organization=organization,
            email="holder-oauth@b2b.com",
            stripe_customer_id="stripe_b2b_holder_oauth",
        )
        oauth = CustomerOAuthAccount(
            access_token="discord_b2b_token",
            account_id="b2b_discord_99",
            account_username="b2b_discord_user",
            refresh_token="b2b_refresh",
        )
        holder.set_oauth_account(oauth, CustomerOAuthPlatform.discord)
        await save_fixture(holder)

        product = await create_product(
            save_fixture,
            organization=organization,
            recurring_interval=SubscriptionRecurringInterval.month,
            prices=[("seat", 1000, "usd")],
        )
        subscription = await create_subscription_with_seats(
            save_fixture, product=product, customer=billing, seats=1
        )
        await create_customer_seat(
            save_fixture,
            subscription=subscription,
            status=SeatStatus.claimed,
            customer=holder,
            claimed_at=utc_now(),
        )

        session.expunge_all()
        await backfill_members(organization.id)

        # Find seat member
        stmt = select(Member).where(
            Member.customer_id == billing.id,
            Member.email == "holder-oauth@b2b.com",
            Member.role == MemberRole.member,
            Member.deleted_at.is_(None),
        )
        result = await session.execute(stmt)
        seat_member = result.scalar_one()

        member_oauth = seat_member.get_oauth_account(
            "b2b_discord_99", CustomerOAuthPlatform.discord
        )
        assert member_oauth is not None
        assert member_oauth.access_token == "discord_b2b_token"
        assert member_oauth.account_username == "b2b_discord_user"
        assert member_oauth.refresh_token == "b2b_refresh"

    async def test_orphaned_seat_holders_soft_deleted(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
    ) -> None:
        """Seat holder customers with no own subscriptions/orders are soft-deleted."""
        organization = await create_organization(
            save_fixture,
            feature_settings={
                "member_model_enabled": True,
                "seat_based_pricing_enabled": True,
            },
        )
        billing = await create_customer(
            save_fixture,
            organization=organization,
            email="billing@b2b.com",
            stripe_customer_id="stripe_b2b_orphan",
        )
        holder = await create_customer(
            save_fixture,
            organization=organization,
            email="orphan@b2b.com",
            stripe_customer_id="stripe_b2b_holder_orphan",
        )
        product = await create_product(
            save_fixture,
            organization=organization,
            recurring_interval=SubscriptionRecurringInterval.month,
            prices=[("seat", 1000, "usd")],
        )
        subscription = await create_subscription_with_seats(
            save_fixture, product=product, customer=billing, seats=1
        )
        await create_customer_seat(
            save_fixture,
            subscription=subscription,
            status=SeatStatus.claimed,
            customer=holder,
            claimed_at=utc_now(),
        )

        session.expunge_all()
        await backfill_members(organization.id)

        refreshed = await session.get(Customer, holder.id)
        assert refreshed is not None
        assert refreshed.deleted_at is not None

        # Billing customer should NOT be soft-deleted
        billing_refreshed = await session.get(Customer, billing.id)
        assert billing_refreshed is not None
        assert billing_refreshed.deleted_at is None


@pytest.mark.asyncio
class TestBackfillBenefitGrantsDuplicates:
    """When a member-linked grant already exists for the same
    (subscription, member, benefit), the old unlinked grant should be
    soft-deleted to avoid violating the benefit_grants_smb_key constraint.
    Properties from the old grant are carried over if the existing one has none."""

    async def test_soft_deletes_old_grant_when_member_linked_grant_exists(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
    ) -> None:
        """Old grant (member_id=NULL) should be soft-deleted when a
        member-linked grant already exists for the same unique key."""
        organization = await create_organization(
            save_fixture, feature_settings={"member_model_enabled": True}
        )
        customer = await create_customer(
            save_fixture,
            organization=organization,
            email="dup@test.com",
            stripe_customer_id="stripe_dup",
        )
        product = await create_product(
            save_fixture,
            organization=organization,
            recurring_interval=SubscriptionRecurringInterval.month,
        )
        subscription = await create_subscription(
            save_fixture,
            product=product,
            customer=customer,
            status=SubscriptionStatus.canceled,
            started_at=utc_now(),
        )
        benefit = await create_benefit(save_fixture, organization=organization)

        # Pre-create the owner member (as if a prior migration already ran)
        owner_member = Member(
            customer_id=customer.id,
            organization_id=organization.id,
            email=customer.email,
            role=MemberRole.owner,
        )
        await save_fixture(owner_member)

        # Old grant: no member_id, granted (stale — subscription is canceled)
        old_grant = await create_benefit_grant(
            save_fixture,
            customer=customer,
            benefit=benefit,
            granted=True,
            subscription=subscription,
        )

        # New grant: has member_id, revoked (created post-migration)
        new_grant = await create_benefit_grant(
            save_fixture,
            customer=customer,
            benefit=benefit,
            granted=False,
            member=owner_member,
            subscription=subscription,
        )

        session.expunge_all()
        await backfill_members(organization.id)

        # Old grant should be soft-deleted
        refreshed_old = await session.get(BenefitGrant, old_grant.id)
        assert refreshed_old is not None
        assert refreshed_old.deleted_at is not None

        # New grant should be kept untouched
        refreshed_new = await session.get(BenefitGrant, new_grant.id)
        assert refreshed_new is not None
        assert refreshed_new.deleted_at is None
        assert refreshed_new.member_id == owner_member.id

    async def test_carries_over_properties_from_old_grant(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
    ) -> None:
        """When the old grant has properties but the existing member-linked
        grant has empty properties, the properties should be carried over."""
        organization = await create_organization(
            save_fixture, feature_settings={"member_model_enabled": True}
        )
        customer = await create_customer(
            save_fixture,
            organization=organization,
            email="props@test.com",
            stripe_customer_id="stripe_props",
        )
        product = await create_product(
            save_fixture,
            organization=organization,
            recurring_interval=SubscriptionRecurringInterval.month,
        )
        subscription = await create_subscription(
            save_fixture,
            product=product,
            customer=customer,
            status=SubscriptionStatus.canceled,
            started_at=utc_now(),
        )
        benefit = await create_benefit(save_fixture, organization=organization)

        owner_member = Member(
            customer_id=customer.id,
            organization_id=organization.id,
            email=customer.email,
            role=MemberRole.owner,
        )
        await save_fixture(owner_member)

        # Old grant with properties (e.g. file references)
        old_grant = await create_benefit_grant(
            save_fixture,
            customer=customer,
            benefit=benefit,
            granted=True,
            properties={"files": ["abc-123"]},
            subscription=subscription,
        )

        # New grant: member-linked but empty properties (created during revocation)
        new_grant = await create_benefit_grant(
            save_fixture,
            customer=customer,
            benefit=benefit,
            granted=False,
            member=owner_member,
            properties={},
            subscription=subscription,
        )

        session.expunge_all()
        await backfill_members(organization.id)

        # Old grant should be soft-deleted
        refreshed_old = await session.get(BenefitGrant, old_grant.id)
        assert refreshed_old is not None
        assert refreshed_old.deleted_at is not None

        # New grant should have inherited the properties
        refreshed_new = await session.get(BenefitGrant, new_grant.id)
        assert refreshed_new is not None
        assert refreshed_new.deleted_at is None
        assert dict(refreshed_new.properties) == {"files": ["abc-123"]}

    async def test_does_not_overwrite_existing_properties(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
    ) -> None:
        """When both grants have properties, the existing grant's
        properties should not be overwritten."""
        organization = await create_organization(
            save_fixture, feature_settings={"member_model_enabled": True}
        )
        customer = await create_customer(
            save_fixture,
            organization=organization,
            email="both-props@test.com",
            stripe_customer_id="stripe_both_props",
        )
        product = await create_product(
            save_fixture,
            organization=organization,
            recurring_interval=SubscriptionRecurringInterval.month,
        )
        subscription = await create_subscription(
            save_fixture,
            product=product,
            customer=customer,
            status=SubscriptionStatus.active,
            started_at=utc_now(),
        )
        benefit = await create_benefit(save_fixture, organization=organization)

        owner_member = Member(
            customer_id=customer.id,
            organization_id=organization.id,
            email=customer.email,
            role=MemberRole.owner,
        )
        await save_fixture(owner_member)

        # Old grant with old properties
        old_grant = await create_benefit_grant(
            save_fixture,
            customer=customer,
            benefit=benefit,
            granted=False,
            properties={"license_key_id": "old-key"},
            subscription=subscription,
        )

        # New grant with its own properties
        new_grant = await create_benefit_grant(
            save_fixture,
            customer=customer,
            benefit=benefit,
            granted=True,
            member=owner_member,
            properties={"license_key_id": "new-key"},
            subscription=subscription,
        )

        session.expunge_all()
        await backfill_members(organization.id)

        # Old grant soft-deleted
        refreshed_old = await session.get(BenefitGrant, old_grant.id)
        assert refreshed_old is not None
        assert refreshed_old.deleted_at is not None

        # New grant keeps its own properties (not overwritten)
        refreshed_new = await session.get(BenefitGrant, new_grant.id)
        assert refreshed_new is not None
        assert dict(refreshed_new.properties) == {"license_key_id": "new-key"}

    async def test_no_duplicate_links_normally_when_no_conflict(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
    ) -> None:
        """When there is no conflicting member-linked grant, the old
        grant should be linked to the member normally."""
        organization = await create_organization(
            save_fixture, feature_settings={"member_model_enabled": True}
        )
        customer = await create_customer(
            save_fixture,
            organization=organization,
            email="no-conflict@test.com",
            stripe_customer_id="stripe_no_conflict",
        )
        product = await create_product(
            save_fixture,
            organization=organization,
            recurring_interval=SubscriptionRecurringInterval.month,
        )
        subscription = await create_subscription(
            save_fixture,
            product=product,
            customer=customer,
            status=SubscriptionStatus.active,
            started_at=utc_now(),
        )
        benefit = await create_benefit(save_fixture, organization=organization)

        grant = await create_benefit_grant(
            save_fixture,
            customer=customer,
            benefit=benefit,
            granted=True,
            subscription=subscription,
        )
        assert grant.member_id is None

        session.expunge_all()
        await backfill_members(organization.id)

        refreshed = await session.get(BenefitGrant, grant.id)
        assert refreshed is not None
        assert refreshed.deleted_at is None
        assert refreshed.member_id is not None

        member = await session.get(Member, refreshed.member_id)
        assert member is not None
        assert member.customer_id == customer.id
        assert member.role == MemberRole.owner
