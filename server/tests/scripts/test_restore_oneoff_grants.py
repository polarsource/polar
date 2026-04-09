import pytest

from polar.kit.db.postgres import AsyncSession
from polar.kit.utils import utc_now
from polar.models import Account, Benefit, Customer, Organization, Product
from polar.models.benefit import BenefitType
from polar.models.benefit_grant import BenefitGrant
from polar.models.license_key import LicenseKey, LicenseKeyStatus
from polar.models.member import Member, MemberRole
from scripts.migrate_organizations_members import (
    find_deleted_oneoff_grants,
    restore_oneoff_grant_batch,
)
from tests.fixtures.database import SaveFixture
from tests.fixtures.random_objects import (
    create_benefit,
    create_benefit_grant,
    create_customer,
    create_order,
    create_organization,
    create_product,
    create_subscription,
)


async def _setup_org_customer_product_benefit(
    save_fixture: SaveFixture,
    account: Account,
) -> tuple[Organization, Customer, Product, Benefit, Member]:
    """Shared setup: org with member_model_enabled, customer, product, benefit, owner member."""
    organization = await create_organization(
        save_fixture, account, feature_settings={"member_model_enabled": True}
    )
    customer = await create_customer(
        save_fixture,
        organization=organization,
        email="buyer@test.com",
        stripe_customer_id="stripe_buyer",
    )
    product = await create_product(
        save_fixture, organization=organization, recurring_interval=None
    )
    benefit = await create_benefit(save_fixture, organization=organization)
    owner_member = Member(
        customer_id=customer.id,
        organization_id=organization.id,
        email=customer.email,
        role=MemberRole.owner,
    )
    await save_fixture(owner_member)
    return organization, customer, product, benefit, owner_member


@pytest.mark.asyncio
class TestFindDeletedOneoffGrants:
    async def test_finds_nothing_when_no_deleted_grants(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        account: Account,
    ) -> None:
        (
            organization,
            customer,
            product,
            benefit,
            owner,
        ) = await _setup_org_customer_product_benefit(save_fixture, account)
        order1 = await create_order(save_fixture, customer=customer, product=product)
        order2 = await create_order(save_fixture, customer=customer, product=product)

        # Two healthy grants — neither deleted
        await create_benefit_grant(
            save_fixture,
            customer=customer,
            benefit=benefit,
            granted=True,
            member=owner,
            order=order1,
        )
        await create_benefit_grant(
            save_fixture,
            customer=customer,
            benefit=benefit,
            granted=True,
            member=owner,
            order=order2,
        )

        session.expunge_all()
        result = await find_deleted_oneoff_grants(session)
        assert len(result) == 0

    async def test_finds_deleted_oneoff_grant_with_surviving_sibling(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        account: Account,
    ) -> None:
        """The classic backfill bug: one grant survived with member_id,
        the other was soft-deleted without member_id."""
        (
            organization,
            customer,
            product,
            benefit,
            owner,
        ) = await _setup_org_customer_product_benefit(save_fixture, account)
        order1 = await create_order(save_fixture, customer=customer, product=product)
        order2 = await create_order(save_fixture, customer=customer, product=product)

        # Surviving grant (linked to member)
        await create_benefit_grant(
            save_fixture,
            customer=customer,
            benefit=benefit,
            granted=True,
            member=owner,
            order=order1,
        )
        # Deleted grant (no member_id, soft-deleted by backfill)
        deleted_grant = await create_benefit_grant(
            save_fixture,
            customer=customer,
            benefit=benefit,
            granted=True,
            order=order2,
        )
        deleted_grant.set_deleted_at()
        await save_fixture(deleted_grant)
        deleted_grant_id = deleted_grant.id

        session.expunge_all()
        result = await find_deleted_oneoff_grants(session)
        assert len(result) == 1
        assert result[0].id == deleted_grant_id

    async def test_ignores_subscription_scoped_deleted_grants(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        account: Account,
    ) -> None:
        """Subscription-scoped grants should NOT be restored — only one-off orders."""
        (
            organization,
            customer,
            product,
            benefit,
            owner,
        ) = await _setup_org_customer_product_benefit(save_fixture, account)
        subscription = await create_subscription(
            save_fixture,
            product=product,
            customer=customer,
            started_at=utc_now(),
        )
        order1 = await create_order(save_fixture, customer=customer, product=product)

        # Surviving grant from an order
        await create_benefit_grant(
            save_fixture,
            customer=customer,
            benefit=benefit,
            granted=True,
            member=owner,
            order=order1,
        )
        # Deleted subscription-scoped grant — should be ignored
        sub_grant = await create_benefit_grant(
            save_fixture,
            customer=customer,
            benefit=benefit,
            granted=True,
            subscription=subscription,
        )
        sub_grant.set_deleted_at()
        await save_fixture(sub_grant)

        session.expunge_all()
        result = await find_deleted_oneoff_grants(session)
        assert len(result) == 0

    async def test_ignores_grant_with_member_id_already_set(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        account: Account,
    ) -> None:
        """If the deleted grant already has member_id, it was not a backfill casualty."""
        (
            organization,
            customer,
            product,
            benefit,
            owner,
        ) = await _setup_org_customer_product_benefit(save_fixture, account)
        order1 = await create_order(save_fixture, customer=customer, product=product)
        order2 = await create_order(save_fixture, customer=customer, product=product)

        # Surviving grant
        await create_benefit_grant(
            save_fixture,
            customer=customer,
            benefit=benefit,
            granted=True,
            member=owner,
            order=order1,
        )
        # Deleted grant WITH member_id set (e.g. manually revoked, not backfill)
        deleted_grant = await create_benefit_grant(
            save_fixture,
            customer=customer,
            benefit=benefit,
            granted=True,
            member=owner,
            order=order2,
        )
        deleted_grant.set_deleted_at()
        await save_fixture(deleted_grant)

        session.expunge_all()
        result = await find_deleted_oneoff_grants(session)
        assert len(result) == 0

    async def test_ignores_deleted_grant_without_surviving_sibling(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        account: Account,
    ) -> None:
        """A lone deleted grant with no sibling is not a backfill duplicate."""
        (
            organization,
            customer,
            product,
            benefit,
            owner,
        ) = await _setup_org_customer_product_benefit(save_fixture, account)
        order1 = await create_order(save_fixture, customer=customer, product=product)

        deleted_grant = await create_benefit_grant(
            save_fixture,
            customer=customer,
            benefit=benefit,
            granted=True,
            order=order1,
        )
        deleted_grant.set_deleted_at()
        await save_fixture(deleted_grant)

        session.expunge_all()
        result = await find_deleted_oneoff_grants(session)
        assert len(result) == 0

    async def test_ignores_grant_when_sibling_was_revoked(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        account: Account,
    ) -> None:
        """If the benefit was removed from the product, the surviving sibling
        gets revoked. We must not restore the deleted grant in that case."""
        (
            organization,
            customer,
            product,
            benefit,
            owner,
        ) = await _setup_org_customer_product_benefit(save_fixture, account)
        order1 = await create_order(save_fixture, customer=customer, product=product)
        order2 = await create_order(save_fixture, customer=customer, product=product)

        # Surviving sibling — but revoked because benefit was removed
        surviving = await create_benefit_grant(
            save_fixture,
            customer=customer,
            benefit=benefit,
            granted=True,
            order=order1,
        )
        surviving.set_revoked()
        await save_fixture(surviving)

        # Backfill-deleted grant
        deleted_grant = await create_benefit_grant(
            save_fixture,
            customer=customer,
            benefit=benefit,
            granted=True,
            order=order2,
        )
        deleted_grant.set_deleted_at()
        await save_fixture(deleted_grant)

        session.expunge_all()
        result = await find_deleted_oneoff_grants(session)
        assert len(result) == 0

    async def test_finds_multiple_deleted_grants_across_customers(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        account: Account,
    ) -> None:
        """Should find affected grants across multiple customers."""
        organization = await create_organization(
            save_fixture, account, feature_settings={"member_model_enabled": True}
        )
        product = await create_product(
            save_fixture, organization=organization, recurring_interval=None
        )
        benefit = await create_benefit(save_fixture, organization=organization)

        deleted_ids = []
        for i in range(3):
            customer = await create_customer(
                save_fixture,
                organization=organization,
                email=f"multi-{i}@test.com",
                stripe_customer_id=f"stripe_multi_{i}",
            )
            member = Member(
                customer_id=customer.id,
                organization_id=organization.id,
                email=customer.email,
                role=MemberRole.owner,
            )
            await save_fixture(member)

            o1 = await create_order(save_fixture, customer=customer, product=product)
            o2 = await create_order(save_fixture, customer=customer, product=product)

            # Surviving
            await create_benefit_grant(
                save_fixture,
                customer=customer,
                benefit=benefit,
                granted=True,
                member=member,
                order=o1,
            )
            # Deleted
            g = await create_benefit_grant(
                save_fixture,
                customer=customer,
                benefit=benefit,
                granted=True,
                order=o2,
            )
            g.set_deleted_at()
            await save_fixture(g)
            deleted_ids.append(g.id)

        session.expunge_all()
        result = await find_deleted_oneoff_grants(session)
        assert len(result) == 3
        assert {r.id for r in result} == set(deleted_ids)


@pytest.mark.asyncio
class TestRestoreOneoffGrantBatch:
    async def test_restores_deleted_grant(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        account: Account,
    ) -> None:
        """Basic restore: clears deleted_at and copies member_id from sibling."""
        (
            organization,
            customer,
            product,
            benefit,
            owner,
        ) = await _setup_org_customer_product_benefit(save_fixture, account)
        order1 = await create_order(save_fixture, customer=customer, product=product)
        order2 = await create_order(save_fixture, customer=customer, product=product)

        await create_benefit_grant(
            save_fixture,
            customer=customer,
            benefit=benefit,
            granted=True,
            member=owner,
            order=order1,
        )
        deleted_grant = await create_benefit_grant(
            save_fixture,
            customer=customer,
            benefit=benefit,
            granted=True,
            order=order2,
        )
        deleted_grant.set_deleted_at()
        await save_fixture(deleted_grant)
        grant_id = deleted_grant.id
        owner_id = owner.id

        session.expunge_all()
        restored, lk_restored = await restore_oneoff_grant_batch(session, [grant_id])
        await session.flush()

        assert restored == 1
        assert lk_restored == 0

        refreshed = await session.get(BenefitGrant, grant_id)
        assert refreshed is not None
        assert refreshed.deleted_at is None
        assert refreshed.member_id == owner_id
        assert refreshed.granted_at is not None
        assert refreshed.revoked_at is None

    async def test_restores_revoked_grant(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        account: Account,
    ) -> None:
        """If the deleted grant also had revoked_at set, it should be cleared."""
        (
            organization,
            customer,
            product,
            benefit,
            owner,
        ) = await _setup_org_customer_product_benefit(save_fixture, account)
        order1 = await create_order(save_fixture, customer=customer, product=product)
        order2 = await create_order(save_fixture, customer=customer, product=product)

        await create_benefit_grant(
            save_fixture,
            customer=customer,
            benefit=benefit,
            granted=True,
            member=owner,
            order=order1,
        )
        deleted_grant = await create_benefit_grant(
            save_fixture,
            customer=customer,
            benefit=benefit,
            granted=True,
            order=order2,
        )
        # Simulate: revoked then deleted
        deleted_grant.set_revoked()
        deleted_grant.set_deleted_at()
        await save_fixture(deleted_grant)
        grant_id = deleted_grant.id

        session.expunge_all()
        restored, _ = await restore_oneoff_grant_batch(session, [grant_id])
        await session.flush()

        assert restored == 1
        refreshed = await session.get(BenefitGrant, grant_id)
        assert refreshed is not None
        assert refreshed.deleted_at is None
        assert refreshed.revoked_at is None
        assert refreshed.granted_at is not None

    async def test_restores_license_key(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        account: Account,
    ) -> None:
        """License key referenced by the grant should be un-deleted and re-granted."""
        (
            organization,
            customer,
            product,
            benefit,
            owner,
        ) = await _setup_org_customer_product_benefit(save_fixture, account)
        order1 = await create_order(save_fixture, customer=customer, product=product)
        order2 = await create_order(save_fixture, customer=customer, product=product)

        # Create license key for the second order's grant
        license_key = LicenseKey(
            organization_id=organization.id,
            customer_id=customer.id,
            benefit_id=benefit.id,
            key="POLAR-RESTORE-TEST-KEY",
            status=LicenseKeyStatus.revoked,
        )
        license_key.set_deleted_at()
        await save_fixture(license_key)
        lk_id = license_key.id

        # Surviving grant
        await create_benefit_grant(
            save_fixture,
            customer=customer,
            benefit=benefit,
            granted=True,
            member=owner,
            order=order1,
        )
        # Deleted grant referencing the license key
        deleted_grant = await create_benefit_grant(
            save_fixture,
            customer=customer,
            benefit=benefit,
            granted=True,
            order=order2,
            properties={
                "license_key_id": str(lk_id),
                "display_key": "****-TEST01",
            },
        )
        deleted_grant.set_deleted_at()
        await save_fixture(deleted_grant)
        grant_id = deleted_grant.id
        owner_id = owner.id

        session.expunge_all()
        restored, lk_restored = await restore_oneoff_grant_batch(session, [grant_id])
        await session.flush()

        assert restored == 1
        assert lk_restored == 1

        refreshed_lk = await session.get(LicenseKey, lk_id)
        assert refreshed_lk is not None
        assert refreshed_lk.deleted_at is None
        assert refreshed_lk.status == LicenseKeyStatus.granted
        assert refreshed_lk.member_id == owner_id

    async def test_sets_granted_at_if_missing(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        account: Account,
    ) -> None:
        """If granted_at was cleared, restore should set it."""
        (
            organization,
            customer,
            product,
            benefit,
            owner,
        ) = await _setup_org_customer_product_benefit(save_fixture, account)
        order1 = await create_order(save_fixture, customer=customer, product=product)
        order2 = await create_order(save_fixture, customer=customer, product=product)

        await create_benefit_grant(
            save_fixture,
            customer=customer,
            benefit=benefit,
            granted=True,
            member=owner,
            order=order1,
        )
        # Grant that never had granted_at set (edge case)
        deleted_grant = await create_benefit_grant(
            save_fixture,
            customer=customer,
            benefit=benefit,
            order=order2,
        )
        deleted_grant.set_deleted_at()
        await save_fixture(deleted_grant)
        grant_id = deleted_grant.id

        session.expunge_all()
        await restore_oneoff_grant_batch(session, [grant_id])
        await session.flush()

        refreshed = await session.get(BenefitGrant, grant_id)
        assert refreshed is not None
        assert refreshed.granted_at is not None

    async def test_license_key_already_healthy_not_counted(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        account: Account,
    ) -> None:
        """If the license key is already in good shape, lk_restored should be 0."""
        (
            organization,
            customer,
            product,
            benefit,
            owner,
        ) = await _setup_org_customer_product_benefit(save_fixture, account)
        order1 = await create_order(save_fixture, customer=customer, product=product)
        order2 = await create_order(save_fixture, customer=customer, product=product)

        # Healthy license key (not deleted, status granted, correct member)
        license_key = LicenseKey(
            organization_id=organization.id,
            customer_id=customer.id,
            benefit_id=benefit.id,
            member_id=owner.id,
            key="POLAR-HEALTHY-KEY-001",
            status=LicenseKeyStatus.granted,
        )
        await save_fixture(license_key)
        lk_id = license_key.id

        await create_benefit_grant(
            save_fixture,
            customer=customer,
            benefit=benefit,
            granted=True,
            member=owner,
            order=order1,
        )
        deleted_grant = await create_benefit_grant(
            save_fixture,
            customer=customer,
            benefit=benefit,
            granted=True,
            order=order2,
            properties={
                "license_key_id": str(lk_id),
                "display_key": "****-HEALTH",
            },
        )
        deleted_grant.set_deleted_at()
        await save_fixture(deleted_grant)
        grant_id = deleted_grant.id

        session.expunge_all()
        _, lk_restored = await restore_oneoff_grant_batch(session, [grant_id])

        assert lk_restored == 0

    async def test_no_sibling_member_id_leaves_grant_unlinked(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        account: Account,
    ) -> None:
        """If the surviving sibling also has no member_id, the restored grant
        stays unlinked (repair command can link it later)."""
        (
            organization,
            customer,
            product,
            benefit,
            _,
        ) = await _setup_org_customer_product_benefit(save_fixture, account)
        order1 = await create_order(save_fixture, customer=customer, product=product)
        order2 = await create_order(save_fixture, customer=customer, product=product)

        # Surviving grant WITHOUT member_id
        await create_benefit_grant(
            save_fixture,
            customer=customer,
            benefit=benefit,
            granted=True,
            order=order1,
        )
        deleted_grant = await create_benefit_grant(
            save_fixture,
            customer=customer,
            benefit=benefit,
            granted=True,
            order=order2,
        )
        deleted_grant.set_deleted_at()
        await save_fixture(deleted_grant)
        grant_id = deleted_grant.id

        session.expunge_all()
        restored, _ = await restore_oneoff_grant_batch(session, [grant_id])
        await session.flush()

        assert restored == 1
        refreshed = await session.get(BenefitGrant, grant_id)
        assert refreshed is not None
        assert refreshed.deleted_at is None
        assert refreshed.member_id is None  # No sibling member to copy from

    async def test_multiple_grants_in_single_batch(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        account: Account,
    ) -> None:
        """Multiple grants from different customers restored in one batch."""
        organization = await create_organization(
            save_fixture, account, feature_settings={"member_model_enabled": True}
        )
        product = await create_product(
            save_fixture, organization=organization, recurring_interval=None
        )
        benefit = await create_benefit(save_fixture, organization=organization)

        grant_ids = []
        expected_member_ids = []

        for i in range(3):
            customer = await create_customer(
                save_fixture,
                organization=organization,
                email=f"batch-{i}@test.com",
                stripe_customer_id=f"stripe_batch_{i}",
            )
            member = Member(
                customer_id=customer.id,
                organization_id=organization.id,
                email=customer.email,
                role=MemberRole.owner,
            )
            await save_fixture(member)

            o1 = await create_order(save_fixture, customer=customer, product=product)
            o2 = await create_order(save_fixture, customer=customer, product=product)

            await create_benefit_grant(
                save_fixture,
                customer=customer,
                benefit=benefit,
                granted=True,
                member=member,
                order=o1,
            )
            g = await create_benefit_grant(
                save_fixture,
                customer=customer,
                benefit=benefit,
                granted=True,
                order=o2,
            )
            g.set_deleted_at()
            await save_fixture(g)
            grant_ids.append(g.id)
            expected_member_ids.append(member.id)

        session.expunge_all()
        restored, _ = await restore_oneoff_grant_batch(session, grant_ids)
        await session.flush()

        assert restored == 3
        for grant_id, expected_member_id in zip(
            grant_ids, expected_member_ids, strict=True
        ):
            refreshed = await session.get(BenefitGrant, grant_id)
            assert refreshed is not None
            assert refreshed.deleted_at is None
            assert refreshed.member_id == expected_member_id

    async def test_skips_license_key_with_wrong_customer(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        account: Account,
    ) -> None:
        """License key belonging to a different customer should not be restored."""
        (
            organization,
            customer,
            product,
            benefit,
            owner,
        ) = await _setup_org_customer_product_benefit(save_fixture, account)
        other_customer = await create_customer(
            save_fixture,
            organization=organization,
            email="other@test.com",
            stripe_customer_id="stripe_other",
        )
        order1 = await create_order(save_fixture, customer=customer, product=product)
        order2 = await create_order(save_fixture, customer=customer, product=product)

        # License key owned by a DIFFERENT customer
        wrong_lk = LicenseKey(
            organization_id=organization.id,
            customer_id=other_customer.id,
            benefit_id=benefit.id,
            key="POLAR-WRONG-OWNER-KEY",
            status=LicenseKeyStatus.revoked,
        )
        wrong_lk.set_deleted_at()
        await save_fixture(wrong_lk)
        wrong_lk_id = wrong_lk.id

        await create_benefit_grant(
            save_fixture,
            customer=customer,
            benefit=benefit,
            granted=True,
            member=owner,
            order=order1,
        )
        deleted_grant = await create_benefit_grant(
            save_fixture,
            customer=customer,
            benefit=benefit,
            granted=True,
            order=order2,
            properties={
                "license_key_id": str(wrong_lk_id),
                "display_key": "****-WRONG1",
            },
        )
        deleted_grant.set_deleted_at()
        await save_fixture(deleted_grant)
        grant_id = deleted_grant.id

        session.expunge_all()
        restored, lk_restored = await restore_oneoff_grant_batch(session, [grant_id])
        await session.flush()

        # Grant should be restored, but the mismatched license key should NOT
        assert restored == 1
        assert lk_restored == 0

        refreshed_lk = await session.get(LicenseKey, wrong_lk_id)
        assert refreshed_lk is not None
        assert refreshed_lk.deleted_at is not None  # Still deleted
        assert refreshed_lk.status == LicenseKeyStatus.revoked  # Still revoked

    async def test_skips_non_qualifying_grant_ids(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        account: Account,
    ) -> None:
        """Passing IDs of healthy grants should not restore/mutate them."""
        (
            organization,
            customer,
            product,
            benefit,
            owner,
        ) = await _setup_org_customer_product_benefit(save_fixture, account)
        order1 = await create_order(save_fixture, customer=customer, product=product)

        # A healthy, non-deleted grant
        healthy_grant = await create_benefit_grant(
            save_fixture,
            customer=customer,
            benefit=benefit,
            granted=True,
            member=owner,
            order=order1,
        )
        healthy_id = healthy_grant.id

        session.expunge_all()
        restored, _ = await restore_oneoff_grant_batch(session, [healthy_id])

        # Should not process it since it doesn't match qualifying filters
        assert restored == 0


@pytest.mark.asyncio
class TestFindAndRestoreEndToEnd:
    async def test_full_flow(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        account: Account,
    ) -> None:
        """End-to-end: find → restore → verify grants and license keys."""
        (
            organization,
            customer,
            product,
            benefit,
            owner,
        ) = await _setup_org_customer_product_benefit(save_fixture, account)

        benefit_lk = await create_benefit(
            save_fixture,
            organization=organization,
            type=BenefitType.license_keys,
            properties={
                "prefix": "TEST",
                "expires": None,
                "activations": None,
                "limit_usage": None,
            },
        )

        order1 = await create_order(save_fixture, customer=customer, product=product)
        order2 = await create_order(save_fixture, customer=customer, product=product)

        # License keys for both orders
        lk1 = LicenseKey(
            organization_id=organization.id,
            customer_id=customer.id,
            benefit_id=benefit_lk.id,
            member_id=owner.id,
            key="POLAR-SURVIVED-KEY",
            status=LicenseKeyStatus.granted,
        )
        await save_fixture(lk1)

        lk2 = LicenseKey(
            organization_id=organization.id,
            customer_id=customer.id,
            benefit_id=benefit_lk.id,
            key="POLAR-DELETED-KEY-01",
            status=LicenseKeyStatus.revoked,
        )
        lk2.set_deleted_at()
        await save_fixture(lk2)
        lk2_id = lk2.id

        # Surviving grant
        await create_benefit_grant(
            save_fixture,
            customer=customer,
            benefit=benefit_lk,
            granted=True,
            member=owner,
            order=order1,
            properties={
                "license_key_id": str(lk1.id),
                "display_key": lk1.display_key,
            },
        )
        # Deleted grant
        deleted_grant = await create_benefit_grant(
            save_fixture,
            customer=customer,
            benefit=benefit_lk,
            granted=True,
            order=order2,
            properties={
                "license_key_id": str(lk2.id),
                "display_key": lk2.display_key,
            },
        )
        deleted_grant.set_deleted_at()
        await save_fixture(deleted_grant)
        deleted_grant_id = deleted_grant.id
        owner_id = owner.id

        session.expunge_all()

        # Step 1: Find
        found = await find_deleted_oneoff_grants(session)
        assert len(found) == 1
        assert found[0].id == deleted_grant_id

        # Step 2: Restore
        restored, lk_restored = await restore_oneoff_grant_batch(
            session, [deleted_grant_id]
        )
        await session.flush()

        assert restored == 1
        assert lk_restored == 1

        # Step 3: Verify grant
        refreshed_grant = await session.get(BenefitGrant, deleted_grant_id)
        assert refreshed_grant is not None
        assert refreshed_grant.deleted_at is None
        assert refreshed_grant.member_id == owner_id
        assert refreshed_grant.granted_at is not None
        assert refreshed_grant.revoked_at is None

        # Step 4: Verify license key
        refreshed_lk = await session.get(LicenseKey, lk2_id)
        assert refreshed_lk is not None
        assert refreshed_lk.deleted_at is None
        assert refreshed_lk.status == LicenseKeyStatus.granted
        assert refreshed_lk.member_id == owner_id

        # Step 5: Running find again should return nothing
        found_again = await find_deleted_oneoff_grants(session)
        assert len(found_again) == 0
