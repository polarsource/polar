import uuid

import pytest

from polar.enums import SubscriptionRecurringInterval
from polar.kit.db.postgres import AsyncSession
from polar.kit.utils import utc_now
from polar.models import Account
from polar.models.benefit import BenefitType
from polar.models.downloadable import Downloadable, DownloadableStatus
from polar.models.file import File, FileServiceTypes
from polar.models.license_key import LicenseKey
from polar.models.member import MemberRole
from polar.models.subscription import SubscriptionStatus
from scripts.migrate_organizations_members import (
    _backfill_downloadables,
    _backfill_license_keys,
)
from tests.fixtures.database import SaveFixture
from tests.fixtures.random_objects import (
    create_benefit,
    create_benefit_grant,
    create_customer,
    create_member,
    create_organization,
    create_product,
    create_subscription,
)


@pytest.mark.asyncio
class TestBackfillLicenseKeys:
    async def test_sets_member_id_from_grant(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        account: Account,
    ) -> None:
        """License key with no member_id gets it from the linked benefit grant."""
        organization = await create_organization(
            save_fixture, account, feature_settings={"member_model_enabled": True}
        )
        customer = await create_customer(
            save_fixture, organization=organization, email="alice@test.com"
        )
        member = await create_member(
            save_fixture,
            customer=customer,
            organization=organization,
            role=MemberRole.owner,
        )
        benefit = await create_benefit(
            save_fixture,
            organization=organization,
            type=BenefitType.license_keys,
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

        license_key = LicenseKey(
            organization_id=organization.id,
            customer_id=customer.id,
            benefit_id=benefit.id,
            key="POLAR-TEST-KEY-001",
        )
        await save_fixture(license_key)
        lk_id = license_key.id

        grant = await create_benefit_grant(
            save_fixture,
            customer=customer,
            benefit=benefit,
            granted=True,
            member=member,
            properties={"license_key_id": str(lk_id)},
            subscription=subscription,
        )

        session.expunge_all()
        updated = await _backfill_license_keys(session)
        await session.flush()

        assert updated == 1
        refreshed = await session.get(LicenseKey, lk_id)
        assert refreshed is not None
        assert refreshed.member_id == member.id

    async def test_skips_already_linked(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        account: Account,
    ) -> None:
        """License key that already has member_id is not touched."""
        organization = await create_organization(
            save_fixture, account, feature_settings={"member_model_enabled": True}
        )
        customer = await create_customer(
            save_fixture, organization=organization, email="bob@test.com"
        )
        member = await create_member(
            save_fixture,
            customer=customer,
            organization=organization,
            role=MemberRole.owner,
        )
        benefit = await create_benefit(
            save_fixture,
            organization=organization,
            type=BenefitType.license_keys,
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

        license_key = LicenseKey(
            organization_id=organization.id,
            customer_id=customer.id,
            benefit_id=benefit.id,
            member_id=member.id,
            key="POLAR-ALREADY-LINKED",
        )
        await save_fixture(license_key)
        lk_id = license_key.id

        await create_benefit_grant(
            save_fixture,
            customer=customer,
            benefit=benefit,
            granted=True,
            member=member,
            properties={"license_key_id": str(lk_id)},
            subscription=subscription,
        )

        session.expunge_all()
        updated = await _backfill_license_keys(session)
        await session.flush()

        assert updated == 0

    async def test_skips_grant_without_member(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        account: Account,
    ) -> None:
        """License key is not updated if the grant itself has no member_id."""
        organization = await create_organization(
            save_fixture, account, feature_settings={"member_model_enabled": True}
        )
        customer = await create_customer(
            save_fixture, organization=organization, email="carol@test.com"
        )
        benefit = await create_benefit(
            save_fixture,
            organization=organization,
            type=BenefitType.license_keys,
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

        license_key = LicenseKey(
            organization_id=organization.id,
            customer_id=customer.id,
            benefit_id=benefit.id,
            key="POLAR-NO-MEMBER-GRANT",
        )
        await save_fixture(license_key)
        lk_id = license_key.id

        await create_benefit_grant(
            save_fixture,
            customer=customer,
            benefit=benefit,
            granted=True,
            properties={"license_key_id": str(lk_id)},
            subscription=subscription,
        )

        session.expunge_all()
        updated = await _backfill_license_keys(session)
        await session.flush()

        assert updated == 0
        refreshed = await session.get(LicenseKey, lk_id)
        assert refreshed is not None
        assert refreshed.member_id is None

    async def test_skips_deleted_grant(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        account: Account,
    ) -> None:
        """Deleted grants are ignored."""
        organization = await create_organization(
            save_fixture, account, feature_settings={"member_model_enabled": True}
        )
        customer = await create_customer(
            save_fixture, organization=organization, email="dave@test.com"
        )
        member = await create_member(
            save_fixture,
            customer=customer,
            organization=organization,
            role=MemberRole.owner,
        )
        benefit = await create_benefit(
            save_fixture,
            organization=organization,
            type=BenefitType.license_keys,
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

        license_key = LicenseKey(
            organization_id=organization.id,
            customer_id=customer.id,
            benefit_id=benefit.id,
            key="POLAR-DELETED-GRANT",
        )
        await save_fixture(license_key)
        lk_id = license_key.id

        grant = await create_benefit_grant(
            save_fixture,
            customer=customer,
            benefit=benefit,
            granted=True,
            member=member,
            properties={"license_key_id": str(lk_id)},
            subscription=subscription,
        )
        grant.set_deleted_at()
        await save_fixture(grant)

        session.expunge_all()
        updated = await _backfill_license_keys(session)
        await session.flush()

        assert updated == 0
        refreshed = await session.get(LicenseKey, lk_id)
        assert refreshed is not None
        assert refreshed.member_id is None

    async def test_idempotent(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        account: Account,
    ) -> None:
        """Running twice produces the same result."""
        organization = await create_organization(
            save_fixture, account, feature_settings={"member_model_enabled": True}
        )
        customer = await create_customer(
            save_fixture, organization=organization, email="eve@test.com"
        )
        member = await create_member(
            save_fixture,
            customer=customer,
            organization=organization,
            role=MemberRole.owner,
        )
        benefit = await create_benefit(
            save_fixture,
            organization=organization,
            type=BenefitType.license_keys,
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

        license_key = LicenseKey(
            organization_id=organization.id,
            customer_id=customer.id,
            benefit_id=benefit.id,
            key="POLAR-IDEMPOTENT",
        )
        await save_fixture(license_key)
        lk_id = license_key.id

        await create_benefit_grant(
            save_fixture,
            customer=customer,
            benefit=benefit,
            granted=True,
            member=member,
            properties={"license_key_id": str(lk_id)},
            subscription=subscription,
        )

        session.expunge_all()

        first_run = await _backfill_license_keys(session)
        await session.flush()
        assert first_run == 1

        second_run = await _backfill_license_keys(session)
        await session.flush()
        assert second_run == 0

    async def test_multiple_keys_different_grants(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        account: Account,
    ) -> None:
        """Multiple license keys from different grants are all backfilled."""
        organization = await create_organization(
            save_fixture, account, feature_settings={"member_model_enabled": True}
        )
        customer = await create_customer(
            save_fixture, organization=organization, email="frank@test.com"
        )
        member = await create_member(
            save_fixture,
            customer=customer,
            organization=organization,
            role=MemberRole.owner,
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

        lk_ids = []
        for i in range(3):
            benefit = await create_benefit(
                save_fixture,
                organization=organization,
                type=BenefitType.license_keys,
                description=f"Benefit {i}",
            )
            lk = LicenseKey(
                organization_id=organization.id,
                customer_id=customer.id,
                benefit_id=benefit.id,
                key=f"POLAR-MULTI-{i}",
            )
            await save_fixture(lk)
            lk_ids.append(lk.id)

            await create_benefit_grant(
                save_fixture,
                customer=customer,
                benefit=benefit,
                granted=True,
                member=member,
                properties={"license_key_id": str(lk.id)},
                subscription=subscription,
            )

        session.expunge_all()
        updated = await _backfill_license_keys(session)
        await session.flush()

        assert updated == 3
        for lk_id in lk_ids:
            refreshed = await session.get(LicenseKey, lk_id)
            assert refreshed is not None
            assert refreshed.member_id == member.id


async def _create_file(
    save_fixture: SaveFixture,
    organization_id: uuid.UUID,
) -> File:
    file = File(
        organization_id=organization_id,
        name="test-file.zip",
        path=f"files/{uuid.uuid4()}.zip",
        mime_type="application/zip",
        size=1024,
        service=FileServiceTypes.downloadable,
    )
    await save_fixture(file)
    return file


@pytest.mark.asyncio
class TestBackfillDownloadables:
    async def test_sets_member_id_from_grant(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        account: Account,
    ) -> None:
        """Downloadable with no member_id gets it from the matching benefit grant."""
        organization = await create_organization(
            save_fixture, account, feature_settings={"member_model_enabled": True}
        )
        customer = await create_customer(
            save_fixture, organization=organization, email="alice@test.com"
        )
        member = await create_member(
            save_fixture,
            customer=customer,
            organization=organization,
            role=MemberRole.owner,
        )
        benefit = await create_benefit(
            save_fixture,
            organization=organization,
            type=BenefitType.downloadables,
            properties={"archived": {}, "files": []},
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
        file = await _create_file(save_fixture, organization.id)

        downloadable = Downloadable(
            customer_id=customer.id,
            benefit_id=benefit.id,
            file_id=file.id,
            status=DownloadableStatus.granted,
        )
        await save_fixture(downloadable)
        dl_id = downloadable.id

        await create_benefit_grant(
            save_fixture,
            customer=customer,
            benefit=benefit,
            granted=True,
            member=member,
            subscription=subscription,
        )

        session.expunge_all()
        updated = await _backfill_downloadables(session)
        await session.flush()

        assert updated == 1
        refreshed = await session.get(Downloadable, dl_id)
        assert refreshed is not None
        assert refreshed.member_id == member.id

    async def test_skips_already_linked(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        account: Account,
    ) -> None:
        """Downloadable that already has member_id is not touched."""
        organization = await create_organization(
            save_fixture, account, feature_settings={"member_model_enabled": True}
        )
        customer = await create_customer(
            save_fixture, organization=organization, email="bob@test.com"
        )
        member = await create_member(
            save_fixture,
            customer=customer,
            organization=organization,
            role=MemberRole.owner,
        )
        benefit = await create_benefit(
            save_fixture,
            organization=organization,
            type=BenefitType.downloadables,
            properties={"archived": {}, "files": []},
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
        file = await _create_file(save_fixture, organization.id)

        downloadable = Downloadable(
            customer_id=customer.id,
            benefit_id=benefit.id,
            file_id=file.id,
            status=DownloadableStatus.granted,
            member_id=member.id,
        )
        await save_fixture(downloadable)

        await create_benefit_grant(
            save_fixture,
            customer=customer,
            benefit=benefit,
            granted=True,
            member=member,
            subscription=subscription,
        )

        session.expunge_all()
        updated = await _backfill_downloadables(session)
        await session.flush()

        assert updated == 0

    async def test_skips_grant_without_member(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        account: Account,
    ) -> None:
        """Downloadable is not updated if the grant has no member_id."""
        organization = await create_organization(
            save_fixture, account, feature_settings={"member_model_enabled": True}
        )
        customer = await create_customer(
            save_fixture, organization=organization, email="carol@test.com"
        )
        benefit = await create_benefit(
            save_fixture,
            organization=organization,
            type=BenefitType.downloadables,
            properties={"archived": {}, "files": []},
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
        file = await _create_file(save_fixture, organization.id)

        downloadable = Downloadable(
            customer_id=customer.id,
            benefit_id=benefit.id,
            file_id=file.id,
            status=DownloadableStatus.granted,
        )
        await save_fixture(downloadable)
        dl_id = downloadable.id

        await create_benefit_grant(
            save_fixture,
            customer=customer,
            benefit=benefit,
            granted=True,
            subscription=subscription,
        )

        session.expunge_all()
        updated = await _backfill_downloadables(session)
        await session.flush()

        assert updated == 0
        refreshed = await session.get(Downloadable, dl_id)
        assert refreshed is not None
        assert refreshed.member_id is None

    async def test_picks_most_recent_grant(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        account: Account,
    ) -> None:
        """When multiple grants exist, the most recently granted one wins."""
        organization = await create_organization(
            save_fixture, account, feature_settings={"member_model_enabled": True}
        )
        customer = await create_customer(
            save_fixture, organization=organization, email="dave@test.com"
        )
        member_old = await create_member(
            save_fixture,
            customer=customer,
            organization=organization,
            role=MemberRole.owner,
            email="old@test.com",
            name="Old Member",
        )
        # Create a second customer+member for a different grant
        customer2 = await create_customer(
            save_fixture,
            organization=organization,
            email="dave-alt@test.com",
            stripe_customer_id="stripe_alt",
        )
        member_new = await create_member(
            save_fixture,
            customer=customer2,
            organization=organization,
            role=MemberRole.member,
            email="new@test.com",
            name="New Member",
        )

        benefit = await create_benefit(
            save_fixture,
            organization=organization,
            type=BenefitType.downloadables,
            properties={"archived": {}, "files": []},
        )
        product = await create_product(
            save_fixture,
            organization=organization,
            recurring_interval=SubscriptionRecurringInterval.month,
        )
        sub1 = await create_subscription(
            save_fixture,
            product=product,
            customer=customer,
            status=SubscriptionStatus.active,
            started_at=utc_now(),
        )
        sub2 = await create_subscription(
            save_fixture,
            product=product,
            customer=customer,
            status=SubscriptionStatus.active,
            started_at=utc_now(),
        )

        # Older grant with member_old
        grant_old = await create_benefit_grant(
            save_fixture,
            customer=customer,
            benefit=benefit,
            granted=True,
            member=member_old,
            subscription=sub1,
        )
        # Newer grant with member_new — same customer_id, same benefit_id
        grant_new = await create_benefit_grant(
            save_fixture,
            customer=customer,
            benefit=benefit,
            granted=True,
            member=member_new,
            subscription=sub2,
        )
        # Ensure granted_at ordering is correct
        grant_old.granted_at = utc_now()
        await save_fixture(grant_old)
        grant_new.granted_at = utc_now()
        await save_fixture(grant_new)

        file = await _create_file(save_fixture, organization.id)
        downloadable = Downloadable(
            customer_id=customer.id,
            benefit_id=benefit.id,
            file_id=file.id,
            status=DownloadableStatus.granted,
        )
        await save_fixture(downloadable)
        dl_id = downloadable.id

        session.expunge_all()
        updated = await _backfill_downloadables(session)
        await session.flush()

        assert updated == 1
        refreshed = await session.get(Downloadable, dl_id)
        assert refreshed is not None
        assert refreshed.member_id == member_new.id

    async def test_idempotent(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        account: Account,
    ) -> None:
        """Running twice produces the same result."""
        organization = await create_organization(
            save_fixture, account, feature_settings={"member_model_enabled": True}
        )
        customer = await create_customer(
            save_fixture, organization=organization, email="eve@test.com"
        )
        member = await create_member(
            save_fixture,
            customer=customer,
            organization=organization,
            role=MemberRole.owner,
        )
        benefit = await create_benefit(
            save_fixture,
            organization=organization,
            type=BenefitType.downloadables,
            properties={"archived": {}, "files": []},
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
        file = await _create_file(save_fixture, organization.id)

        downloadable = Downloadable(
            customer_id=customer.id,
            benefit_id=benefit.id,
            file_id=file.id,
            status=DownloadableStatus.granted,
        )
        await save_fixture(downloadable)

        await create_benefit_grant(
            save_fixture,
            customer=customer,
            benefit=benefit,
            granted=True,
            member=member,
            subscription=subscription,
        )

        session.expunge_all()

        first_run = await _backfill_downloadables(session)
        await session.flush()
        assert first_run == 1

        second_run = await _backfill_downloadables(session)
        await session.flush()
        assert second_run == 0

    async def test_multiple_files_same_benefit(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        account: Account,
    ) -> None:
        """Multiple downloadables for the same benefit all get backfilled."""
        organization = await create_organization(
            save_fixture, account, feature_settings={"member_model_enabled": True}
        )
        customer = await create_customer(
            save_fixture, organization=organization, email="frank@test.com"
        )
        member = await create_member(
            save_fixture,
            customer=customer,
            organization=organization,
            role=MemberRole.owner,
        )
        benefit = await create_benefit(
            save_fixture,
            organization=organization,
            type=BenefitType.downloadables,
            properties={"archived": {}, "files": []},
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

        dl_ids = []
        for _ in range(3):
            file = await _create_file(save_fixture, organization.id)
            dl = Downloadable(
                customer_id=customer.id,
                benefit_id=benefit.id,
                file_id=file.id,
                status=DownloadableStatus.granted,
            )
            await save_fixture(dl)
            dl_ids.append(dl.id)

        await create_benefit_grant(
            save_fixture,
            customer=customer,
            benefit=benefit,
            granted=True,
            member=member,
            subscription=subscription,
        )

        session.expunge_all()
        updated = await _backfill_downloadables(session)
        await session.flush()

        assert updated == 3
        for dl_id in dl_ids:
            refreshed = await session.get(Downloadable, dl_id)
            assert refreshed is not None
            assert refreshed.member_id == member.id

    async def test_cross_organization_isolation(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        account: Account,
    ) -> None:
        """Downloadables from different organizations don't cross-pollinate."""
        org1 = await create_organization(
            save_fixture, account, feature_settings={"member_model_enabled": True}
        )
        org2 = await create_organization(
            save_fixture, account, feature_settings={"member_model_enabled": True}
        )
        customer1 = await create_customer(
            save_fixture, organization=org1, email="org1@test.com"
        )
        customer2 = await create_customer(
            save_fixture, organization=org2, email="org2@test.com"
        )
        member1 = await create_member(
            save_fixture,
            customer=customer1,
            organization=org1,
            role=MemberRole.owner,
        )

        benefit1 = await create_benefit(
            save_fixture,
            organization=org1,
            type=BenefitType.downloadables,
            properties={"archived": {}, "files": []},
        )
        benefit2 = await create_benefit(
            save_fixture,
            organization=org2,
            type=BenefitType.downloadables,
            properties={"archived": {}, "files": []},
        )
        product1 = await create_product(
            save_fixture,
            organization=org1,
            recurring_interval=SubscriptionRecurringInterval.month,
        )
        product2 = await create_product(
            save_fixture,
            organization=org2,
            recurring_interval=SubscriptionRecurringInterval.month,
        )
        sub1 = await create_subscription(
            save_fixture,
            product=product1,
            customer=customer1,
            status=SubscriptionStatus.active,
            started_at=utc_now(),
        )
        sub2 = await create_subscription(
            save_fixture,
            product=product2,
            customer=customer2,
            status=SubscriptionStatus.active,
            started_at=utc_now(),
        )

        file1 = await _create_file(save_fixture, org1.id)
        file2 = await _create_file(save_fixture, org2.id)

        dl1 = Downloadable(
            customer_id=customer1.id,
            benefit_id=benefit1.id,
            file_id=file1.id,
            status=DownloadableStatus.granted,
        )
        await save_fixture(dl1)
        dl1_id = dl1.id

        dl2 = Downloadable(
            customer_id=customer2.id,
            benefit_id=benefit2.id,
            file_id=file2.id,
            status=DownloadableStatus.granted,
        )
        await save_fixture(dl2)
        dl2_id = dl2.id

        # Only org1's grant has a member
        await create_benefit_grant(
            save_fixture,
            customer=customer1,
            benefit=benefit1,
            granted=True,
            member=member1,
            subscription=sub1,
        )
        await create_benefit_grant(
            save_fixture,
            customer=customer2,
            benefit=benefit2,
            granted=True,
            subscription=sub2,
        )

        session.expunge_all()
        updated = await _backfill_downloadables(session)
        await session.flush()

        assert updated == 1
        refreshed1 = await session.get(Downloadable, dl1_id)
        assert refreshed1 is not None
        assert refreshed1.member_id == member1.id

        refreshed2 = await session.get(Downloadable, dl2_id)
        assert refreshed2 is not None
        assert refreshed2.member_id is None
