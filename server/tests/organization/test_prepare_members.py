import uuid

import pytest
from sqlalchemy import select

from polar.enums import SubscriptionRecurringInterval
from polar.kit.db.postgres import AsyncSession
from polar.kit.utils import utc_now
from polar.models import Account, CustomerSeat, Product
from polar.models.customer import CustomerType
from polar.models.customer_seat import SeatStatus
from polar.models.member import Member, MemberRole
from polar.organization.tasks import (
    OrganizationDoesNotExist,
    prepare_members,
)
from tests.fixtures.database import SaveFixture
from tests.fixtures.random_objects import (
    create_customer,
    create_customer_seat,
    create_organization,
    create_product,
    create_subscription_with_seats,
)


@pytest.mark.asyncio
class TestPrepareMembers:
    async def test_not_existing_organization(self, session: AsyncSession) -> None:
        session.expunge_all()
        with pytest.raises(OrganizationDoesNotExist):
            await prepare_members(uuid.uuid4())

    async def test_creates_owner_members_for_customers_with_email(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        account: Account,
    ) -> None:
        organization = await create_organization(
            save_fixture, account, feature_settings={"member_model_enabled": False}
        )
        c1 = await create_customer(
            save_fixture,
            organization=organization,
            email="alice@prep.com",
            stripe_customer_id="stripe_prep_1",
        )
        c2 = await create_customer(
            save_fixture,
            organization=organization,
            email="bob@prep.com",
            stripe_customer_id="stripe_prep_2",
        )

        session.expunge_all()
        await prepare_members(organization.id)

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
        account: Account,
    ) -> None:
        organization = await create_organization(
            save_fixture, account, feature_settings={"member_model_enabled": False}
        )
        customer = await create_customer(
            save_fixture,
            organization=organization,
            email="has-owner@prep.com",
            stripe_customer_id="stripe_prep_existing",
        )

        existing_member = Member(
            customer_id=customer.id,
            organization_id=organization.id,
            email=customer.email,
            role=MemberRole.owner,
        )
        await save_fixture(existing_member)

        session.expunge_all()
        await prepare_members(organization.id)

        stmt = select(Member).where(
            Member.customer_id == customer.id,
            Member.role == MemberRole.owner,
            Member.deleted_at.is_(None),
        )
        result = await session.execute(stmt)
        members = result.scalars().all()
        assert len(members) == 1
        assert members[0].id == existing_member.id

    async def test_skips_email_less_customers_without_crashing(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        account: Account,
    ) -> None:
        """Regression: an email-less team customer (legacy, created with an
        owner but no email) formerly crashed prepare_members permanently,
        because ``_backfill_owner_members`` called ``create_owner_member``
        with no ``owner_email`` and the email-required check raised. The task
        is documented as non-destructive and safe to run pre-flip, so it must
        skip these customers instead of aborting."""
        organization = await create_organization(
            save_fixture, account, feature_settings={"member_model_enabled": False}
        )
        no_email_customer = await create_customer(
            save_fixture,
            organization=organization,
            email=None,
            name="No Email Team",
            stripe_customer_id="stripe_prep_no_email",
        )
        no_email_customer.type = CustomerType.team
        await save_fixture(no_email_customer)

        session.expunge_all()
        # Must not raise PolarRequestValidationError
        await prepare_members(organization.id)

        # The email-less customer must not get an owner member
        stmt = select(Member).where(
            Member.customer_id == no_email_customer.id,
            Member.role == MemberRole.owner,
            Member.deleted_at.is_(None),
        )
        result = await session.execute(stmt)
        assert len(result.scalars().all()) == 0

    async def test_handles_mixed_email_and_email_less_customers(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        account: Account,
    ) -> None:
        """prepare_members completes even when both an email-less team customer
        and an email customer need an owner member, and the email customer
        still gets one. Before the fix, the email-less customer aborted the
        whole run, so the email customer never received its owner either."""
        organization = await create_organization(
            save_fixture, account, feature_settings={"member_model_enabled": False}
        )
        no_email_customer = await create_customer(
            save_fixture,
            organization=organization,
            email=None,
            name="No Email Team",
            stripe_customer_id="stripe_prep_mixed_no_email",
        )
        no_email_customer.type = CustomerType.team
        await save_fixture(no_email_customer)

        with_email_customer = await create_customer(
            save_fixture,
            organization=organization,
            email="mixed@prep.com",
            stripe_customer_id="stripe_prep_mixed_email",
        )

        session.expunge_all()
        await prepare_members(organization.id)

        # email-less customer: no owner member
        stmt_no = select(Member).where(
            Member.customer_id == no_email_customer.id,
            Member.role == MemberRole.owner,
            Member.deleted_at.is_(None),
        )
        assert len((await session.execute(stmt_no)).scalars().all()) == 0

        # email customer: owner member created
        stmt_yes = select(Member).where(
            Member.customer_id == with_email_customer.id,
            Member.role == MemberRole.owner,
            Member.deleted_at.is_(None),
        )
        assert len((await session.execute(stmt_yes)).scalars().all()) == 1

    async def test_non_destructive_seat_customer_id_unchanged(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        account: Account,
    ) -> None:
        """Unlike backfill_members, prepare_members must NOT rewrite
        seat.customer_id — it only populates member_id and email."""
        organization = await create_organization(
            save_fixture, account, feature_settings={"member_model_enabled": False}
        )
        billing_customer = await create_customer(
            save_fixture,
            organization=organization,
            email="billing@prep.com",
            stripe_customer_id="stripe_prep_billing",
        )
        product: Product = await create_product(
            save_fixture,
            organization=organization,
            recurring_interval=SubscriptionRecurringInterval.month,
            prices=[("seat", 1000, "usd")],
        )
        subscription = await create_subscription_with_seats(
            save_fixture, product=product, customer=billing_customer, seats=1
        )
        seat = await create_customer_seat(
            save_fixture,
            subscription=subscription,
            status=SeatStatus.claimed,
            customer=billing_customer,
            claimed_at=utc_now(),
        )
        original_customer_id = seat.customer_id

        session.expunge_all()
        await prepare_members(organization.id)

        refreshed_seat = await session.get(CustomerSeat, seat.id)
        assert refreshed_seat is not None
        # member_id populated (owner of the billing customer)
        assert refreshed_seat.member_id is not None
        assert refreshed_seat.email is not None
        # customer_id must be untouched (non-destructive)
        assert refreshed_seat.customer_id == original_customer_id
        assert refreshed_seat.customer_id == billing_customer.id
