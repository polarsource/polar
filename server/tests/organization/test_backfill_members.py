import uuid

import pytest
from sqlalchemy import select

from polar.enums import SubscriptionRecurringInterval
from polar.kit.db.postgres import AsyncSession
from polar.kit.utils import utc_now
from polar.models import Customer, CustomerSeat
from polar.models.benefit import BenefitType
from polar.models.benefit_grant import BenefitGrant
from polar.models.customer import CustomerOAuthAccount, CustomerOAuthPlatform
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

        # License key should be transferred to the billing customer
        refreshed_lk = await session.get(LicenseKey, lk_id)
        assert refreshed_lk is not None
        assert refreshed_lk.customer_id == billing_customer.id

        # Grant should also be transferred
        refreshed_grant = await session.get(BenefitGrant, grant.id)
        assert refreshed_grant is not None
        assert refreshed_grant.customer_id == billing_customer.id

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
