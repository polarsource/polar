from uuid import UUID

import pytest

from polar.benefit.schemas import BenefitDownloadablesCreateProperties
from polar.file.schemas import FileRead
from polar.models import Customer, Downloadable, Organization, Product
from polar.models.downloadable import DownloadableStatus
from polar.postgres import AsyncSession
from polar.redis import Redis
from tests.fixtures.database import SaveFixture
from tests.fixtures.downloadable import TestDownloadable


@pytest.mark.asyncio
class TestDownloadblesBenefit:
    @pytest.mark.auth
    async def test_grant_one(
        self,
        session: AsyncSession,
        redis: Redis,
        save_fixture: SaveFixture,
        customer: Customer,
        organization: Organization,
        product: Product,
        uploaded_logo_jpg: FileRead,
    ) -> None:
        _, granted = await TestDownloadable.create_benefit_and_grant(
            session,
            redis,
            save_fixture,
            customer=customer,
            organization=organization,
            product=product,
            properties=BenefitDownloadablesCreateProperties(
                files=[uploaded_logo_jpg.id]
            ),
        )
        assert granted.get("files", [])[0] == str(uploaded_logo_jpg.id)

        downloadables = await TestDownloadable.get_customer_downloadables(
            session, customer
        )
        assert downloadables
        assert len(downloadables) == 1

        downloadable = downloadables[0]
        assert downloadable.status == DownloadableStatus.granted
        assert downloadable.deleted_at is None

    @pytest.mark.auth
    async def test_grant_multiple(
        self,
        session: AsyncSession,
        redis: Redis,
        save_fixture: SaveFixture,
        customer: Customer,
        organization: Organization,
        product: Product,
        uploaded_logo_jpg: FileRead,
        uploaded_logo_png: FileRead,
    ) -> None:
        files = [
            uploaded_logo_jpg,
            uploaded_logo_png,
        ]

        _, granted = await TestDownloadable.create_benefit_and_grant(
            session,
            redis,
            save_fixture,
            customer=customer,
            organization=organization,
            product=product,
            properties=BenefitDownloadablesCreateProperties(
                files=[f.id for f in files]
            ),
        )

        downloadables = await TestDownloadable.get_customer_downloadables(
            session, customer
        )
        assert downloadables
        assert len(downloadables) == len(files)

        for i, file in enumerate(files):
            assert granted.get("files", [])[i] == str(file.id)
            downloadable = downloadables[i]
            assert downloadable.status == DownloadableStatus.granted
            assert downloadable.file_id == file.id
            assert downloadable.deleted_at is None

    @pytest.mark.auth
    async def test_grant_unless_archived(
        self,
        session: AsyncSession,
        redis: Redis,
        save_fixture: SaveFixture,
        customer: Customer,
        organization: Organization,
        product: Product,
        uploaded_logo_jpg: FileRead,
        uploaded_logo_png: FileRead,
    ) -> None:
        _, granted = await TestDownloadable.create_benefit_and_grant(
            session,
            redis,
            save_fixture,
            customer=customer,
            organization=organization,
            product=product,
            properties=BenefitDownloadablesCreateProperties(
                archived={
                    uploaded_logo_jpg.id: True,
                },
                files=[
                    uploaded_logo_jpg.id,
                    uploaded_logo_png.id,
                ],
            ),
        )
        assert len(granted.get("files", [])) == 1
        assert granted.get("files", [])[0] == str(uploaded_logo_png.id)

        downloadables = await TestDownloadable.get_customer_downloadables(
            session, customer
        )
        assert downloadables
        assert len(downloadables) == 1

        downloadable = downloadables[0]
        assert downloadable.status == DownloadableStatus.granted
        assert downloadable.file_id == uploaded_logo_png.id

    @pytest.mark.auth
    async def test_revoke_one(
        self,
        session: AsyncSession,
        redis: Redis,
        save_fixture: SaveFixture,
        customer: Customer,
        organization: Organization,
        product: Product,
        uploaded_logo_jpg: FileRead,
    ) -> None:
        benefit, granted = await TestDownloadable.create_benefit_and_grant(
            session,
            redis,
            save_fixture,
            customer=customer,
            organization=organization,
            product=product,
            properties=BenefitDownloadablesCreateProperties(
                files=[
                    uploaded_logo_jpg.id,
                ],
            ),
        )

        # First granted
        assert len(granted.get("files", [])) == 1
        assert granted.get("files", [])[0] == str(uploaded_logo_jpg.id)

        downloadables = await TestDownloadable.get_customer_downloadables(
            session, customer
        )
        assert downloadables
        assert len(downloadables) == 1

        downloadable = downloadables[0]
        assert downloadable.status == DownloadableStatus.granted
        assert downloadable.file_id == uploaded_logo_jpg.id

        await TestDownloadable.run_revoke_task(session, redis, benefit, customer)

        # Now revoked
        updated_downloadables = await TestDownloadable.get_customer_downloadables(
            session, customer
        )
        assert updated_downloadables
        assert len(updated_downloadables) == 1

        revoked_downloadable = updated_downloadables[0]
        assert revoked_downloadable.status == DownloadableStatus.revoked
        assert revoked_downloadable.file_id == uploaded_logo_jpg.id

    @pytest.mark.auth
    async def test_revoke_multiple(
        self,
        session: AsyncSession,
        redis: Redis,
        save_fixture: SaveFixture,
        customer: Customer,
        organization: Organization,
        product: Product,
        uploaded_logo_jpg: FileRead,
        uploaded_logo_png: FileRead,
    ) -> None:
        files = [
            uploaded_logo_jpg,
            uploaded_logo_png,
        ]
        benefit, granted = await TestDownloadable.create_benefit_and_grant(
            session,
            redis,
            save_fixture,
            customer=customer,
            organization=organization,
            product=product,
            properties=BenefitDownloadablesCreateProperties(
                files=[f.id for f in files],
            ),
        )

        # First granted
        assert len(granted.get("files", [])) == 2
        granted_downloadables = await TestDownloadable.get_customer_downloadables(
            session, customer
        )
        assert len(granted_downloadables) == 2
        for i, file in enumerate(files):
            grant = granted_downloadables[i]
            assert grant.file_id == file.id
            assert grant.status == DownloadableStatus.granted

        await TestDownloadable.run_revoke_task(session, redis, benefit, customer)

        # Now revoked
        revoked_downloadables = await TestDownloadable.get_customer_downloadables(
            session, customer
        )
        assert len(revoked_downloadables) == 2
        for i, file in enumerate(files):
            revoked = revoked_downloadables[i]
            assert revoked.file_id == file.id
            assert revoked.status == DownloadableStatus.revoked

    @pytest.mark.auth
    async def test_archive_grant_retroactively(
        self,
        session: AsyncSession,
        redis: Redis,
        save_fixture: SaveFixture,
        customer: Customer,
        organization: Organization,
        product: Product,
        uploaded_logo_jpg: FileRead,
        uploaded_logo_png: FileRead,
    ) -> None:
        files = [
            uploaded_logo_jpg,
            uploaded_logo_png,
        ]
        properties = BenefitDownloadablesCreateProperties(
            archived={
                files[0].id: True,
            },
            files=[f.id for f in files],
        )
        benefit, granted = await TestDownloadable.create_benefit_and_grant(
            session,
            redis,
            save_fixture,
            customer=customer,
            organization=organization,
            product=product,
            properties=properties,
        )

        assert len(granted.get("files", [])) == 1
        assert granted.get("files", [])[0] == str(files[1].id)

        downloadables = await TestDownloadable.get_customer_downloadables(
            session, customer
        )
        assert downloadables
        assert len(downloadables) == 1

        downloadable = downloadables[0]
        assert downloadable.status == DownloadableStatus.granted
        assert downloadable.file_id == files[1].id

        # Mimic creator enabling all files again
        benefit.properties["archived"] = {}
        session.add(benefit)
        await session.flush()

        _, updated_granted = await TestDownloadable.run_grant_task(
            session, redis, benefit, customer
        )

        assert len(updated_granted.get("files", [])) == 2
        downloadables = await TestDownloadable.get_customer_downloadables(
            session, customer
        )
        assert downloadables
        assert len(downloadables) == 2

        def find_downloadable(file_id: UUID) -> Downloadable | None:
            for downloadable in downloadables:
                if downloadable.file_id == file_id:
                    return downloadable
            return None

        for i, file in enumerate(files):
            assert updated_granted.get("files", [])[i] == str(file.id)
            updated_downloadable = find_downloadable(file.id)
            assert updated_downloadable
            assert updated_downloadable.status == DownloadableStatus.granted
            assert updated_downloadable.file_id == file.id
            assert updated_downloadable.deleted_at is None

    @pytest.mark.auth
    async def test_archive_for_new_customers(
        self,
        session: AsyncSession,
        redis: Redis,
        save_fixture: SaveFixture,
        customer: Customer,
        customer_second: Customer,
        organization: Organization,
        product: Product,
        uploaded_logo_jpg: FileRead,
        uploaded_logo_png: FileRead,
    ) -> None:
        files = [
            uploaded_logo_jpg,
            uploaded_logo_png,
        ]
        benefit, customer_granted = await TestDownloadable.create_benefit_and_grant(
            session,
            redis,
            save_fixture,
            customer=customer,
            organization=organization,
            product=product,
            properties=BenefitDownloadablesCreateProperties(
                files=[f.id for f in files],
            ),
        )

        # First customer granted all files
        assert len(customer_granted.get("files", [])) == 2
        customer_downloadables = await TestDownloadable.get_customer_downloadables(
            session, customer
        )
        assert len(customer_downloadables) == 2
        for i, file in enumerate(files):
            grant = customer_downloadables[i]
            assert grant.file_id == file.id
            assert grant.status == DownloadableStatus.granted

        # Mimic creator disabling a file
        benefit.properties["archived"] = {
            files[0].id: True,
        }
        session.add(benefit)
        await session.flush()
        session.expunge(benefit)

        # Second customer granted one file
        # Since they subscribe after the 2nd file was archived
        _, customer_second_granted = await TestDownloadable.create_grant(
            session,
            redis,
            save_fixture,
            benefit,
            customer=customer_second,
            product=product,
        )
        assert len(customer_second_granted.get("files", [])) == 1
        customer_second_downloadables = (
            await TestDownloadable.get_customer_downloadables(session, customer_second)
        )
        assert len(customer_second_downloadables) == 1
        assert customer_second_downloadables[0].file_id == files[1].id
        assert customer_second_downloadables[0].status == DownloadableStatus.granted
