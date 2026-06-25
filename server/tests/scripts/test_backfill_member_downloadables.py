import pytest
from sqlalchemy import select

from polar.models import (
    Benefit,
    Customer,
    Downloadable,
    File,
    Member,
    Organization,
    Product,
)
from polar.models.benefit import BenefitType
from polar.models.downloadable import DownloadableStatus
from polar.models.subscription import SubscriptionStatus
from polar.postgres import AsyncSession
from scripts.backfill_member_downloadables import run_backfill
from tests.fixtures.database import SaveFixture
from tests.fixtures.random_objects import (
    create_benefit,
    create_benefit_grant,
    create_member,
    create_subscription,
)


@pytest.mark.asyncio
class TestBackfillMemberDownloadables:
    async def _legacy_state(
        self,
        save_fixture: SaveFixture,
        customer: Customer,
        organization: Organization,
        product: Product,
        file: File,
        null_anchor: bool = False,
    ) -> tuple[Benefit, tuple[Member, Member]]:
        """A downloadables benefit granted to two members, but only one shared
        row exists (the pre-fix state). ``null_anchor`` seeds that row with
        member_id NULL (customer-level shared row) instead of the first member."""
        benefit = await create_benefit(
            save_fixture,
            type=BenefitType.downloadables,
            organization=organization,
            properties={"files": [str(file.id)], "archived": {}},
        )
        member_a = await create_member(
            save_fixture,
            customer=customer,
            organization=organization,
            email="member-a@example.com",
        )
        member_b = await create_member(
            save_fixture,
            customer=customer,
            organization=organization,
            email="member-b@example.com",
        )
        subscription = await create_subscription(
            save_fixture,
            product=product,
            customer=customer,
            status=SubscriptionStatus.active,
        )
        for member in (member_a, member_b):
            await create_benefit_grant(
                save_fixture,
                customer,
                benefit,
                granted=True,
                member=member,
                subscription=subscription,
            )
        await save_fixture(
            Downloadable(
                file_id=file.id,
                customer_id=customer.id,
                benefit_id=benefit.id,
                member_id=None if null_anchor else member_a.id,
                status=DownloadableStatus.granted,
            )
        )
        return benefit, (member_a, member_b)

    async def test_dry_run_reports_without_creating(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        customer: Customer,
        organization: Organization,
        product: Product,
        uploaded_logo_jpg: File,
    ) -> None:
        benefit, (member_a, member_b) = await self._legacy_state(
            save_fixture, customer, organization, product, uploaded_logo_jpg
        )

        pending = await run_backfill(session, dry_run=True)
        assert pending == 1  # only member_b is missing a row

        result = await session.execute(
            select(Downloadable).where(Downloadable.benefit_id == benefit.id)
        )
        assert {d.member_id for d in result.scalars().all()} == {member_a.id}

    async def test_execute_creates_missing_member_rows(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        customer: Customer,
        organization: Organization,
        product: Product,
        uploaded_logo_jpg: File,
    ) -> None:
        benefit, (member_a, member_b) = await self._legacy_state(
            save_fixture, customer, organization, product, uploaded_logo_jpg
        )

        created = await run_backfill(session, dry_run=False)
        assert created == 1

        result = await session.execute(
            select(Downloadable).where(Downloadable.benefit_id == benefit.id)
        )
        downloadables = result.scalars().all()
        assert {d.member_id for d in downloadables} == {member_a.id, member_b.id}
        assert all(d.file_id == uploaded_logo_jpg.id for d in downloadables)
        # Idempotent: member_a's existing row is not duplicated.
        assert len([d for d in downloadables if d.member_id == member_a.id]) == 1

        # Re-running is a no-op.
        assert await run_backfill(session, dry_run=False) == 0

    async def test_execute_from_null_member_anchor(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        customer: Customer,
        organization: Organization,
        product: Product,
        uploaded_logo_jpg: File,
    ) -> None:
        # The common legacy shape: a single customer-level shared row (member_id
        # NULL) with no member attributed yet.
        benefit, (member_a, member_b) = await self._legacy_state(
            save_fixture, customer, organization, product, uploaded_logo_jpg, True
        )

        created = await run_backfill(session, dry_run=False)
        assert created == 2

        result = await session.execute(
            select(Downloadable).where(Downloadable.benefit_id == benefit.id)
        )
        member_ids = {d.member_id for d in result.scalars().all()}
        # Both members now have a row; the original shared row is left intact.
        assert member_ids == {None, member_a.id, member_b.id}
