from uuid import UUID

import pytest

from polar.benefit.schemas import BenefitDownloadablesCreateProperties
from polar.file.schemas import FileRead
from polar.models import (
    Downloadable,
    Organization,
    Product,
    User,
)
from polar.models.downloadable import DownloadableStatus
from polar.postgres import AsyncSession
from tests.fixtures.database import SaveFixture
from tests.fixtures.downloadable import TestDownloadable


@pytest.mark.asyncio
@pytest.mark.http_auto_expunge
class TestDownloadblesBenefit:
    @pytest.mark.auth
    async def test_grant_one(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        user: User,
        organization: Organization,
        product: Product,
        uploaded_logo_jpg: FileRead,
    ) -> None:
        _, granted = await TestDownloadable.create_benefit_and_grant(
            session,
            save_fixture,
            user=user,
            organization=organization,
            product=product,
            properties=BenefitDownloadablesCreateProperties(
                files=[uploaded_logo_jpg.id]
            ),
        )
        assert granted["files"][0] == str(uploaded_logo_jpg.id)

        downloadables = await TestDownloadable.get_user_downloadables(session, user)
        assert downloadables
        assert len(downloadables) == 1

        downloadable = downloadables[0]
        assert downloadable.status == DownloadableStatus.granted
        assert downloadable.deleted_at is None

    @pytest.mark.auth
    async def test_grant_multiple(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        user: User,
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
            save_fixture,
            user=user,
            organization=organization,
            product=product,
            properties=BenefitDownloadablesCreateProperties(
                files=[f.id for f in files]
            ),
        )

        downloadables = await TestDownloadable.get_user_downloadables(session, user)
        assert downloadables
        assert len(downloadables) == len(files)

        for i, file in enumerate(files):
            assert granted["files"][i] == str(file.id)
            downloadable = downloadables[i]
            assert downloadable.status == DownloadableStatus.granted
            assert downloadable.file_id == file.id
            assert downloadable.deleted_at is None

    @pytest.mark.auth
    async def test_grant_unless_archived(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        user: User,
        organization: Organization,
        product: Product,
        uploaded_logo_jpg: FileRead,
        uploaded_logo_png: FileRead,
    ) -> None:
        _, granted = await TestDownloadable.create_benefit_and_grant(
            session,
            save_fixture,
            user=user,
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
        assert len(granted["files"]) == 1
        assert granted["files"][0] == str(uploaded_logo_png.id)

        downloadables = await TestDownloadable.get_user_downloadables(session, user)
        assert downloadables
        assert len(downloadables) == 1

        downloadable = downloadables[0]
        assert downloadable.status == DownloadableStatus.granted
        assert downloadable.file_id == uploaded_logo_png.id

    @pytest.mark.auth
    async def test_revoke_one(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        user: User,
        organization: Organization,
        product: Product,
        uploaded_logo_jpg: FileRead,
    ) -> None:
        benefit, granted = await TestDownloadable.create_benefit_and_grant(
            session,
            save_fixture,
            user=user,
            organization=organization,
            product=product,
            properties=BenefitDownloadablesCreateProperties(
                files=[
                    uploaded_logo_jpg.id,
                ],
            ),
        )

        # First granted
        assert len(granted["files"]) == 1
        assert granted["files"][0] == str(uploaded_logo_jpg.id)

        downloadables = await TestDownloadable.get_user_downloadables(session, user)
        assert downloadables
        assert len(downloadables) == 1

        downloadable = downloadables[0]
        assert downloadable.status == DownloadableStatus.granted
        assert downloadable.file_id == uploaded_logo_jpg.id

        await TestDownloadable.run_revoke_task(session, benefit, user)

        # Now revoked
        updated_downloadables = await TestDownloadable.get_user_downloadables(
            session, user
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
        save_fixture: SaveFixture,
        user: User,
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
            save_fixture,
            user=user,
            organization=organization,
            product=product,
            properties=BenefitDownloadablesCreateProperties(
                files=[f.id for f in files],
            ),
        )

        # First granted
        assert len(granted["files"]) == 2
        granted_downloadables = await TestDownloadable.get_user_downloadables(
            session, user
        )
        assert len(granted_downloadables) == 2
        for i, file in enumerate(files):
            grant = granted_downloadables[i]
            assert grant.file_id == file.id
            assert grant.status == DownloadableStatus.granted

        await TestDownloadable.run_revoke_task(session, benefit, user)

        # Now revoked
        revoked_downloadables = await TestDownloadable.get_user_downloadables(
            session, user
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
        save_fixture: SaveFixture,
        user: User,
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
            save_fixture,
            user=user,
            organization=organization,
            product=product,
            properties=properties,
        )

        assert len(granted["files"]) == 1
        assert granted["files"][0] == str(files[1].id)

        downloadables = await TestDownloadable.get_user_downloadables(session, user)
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
            session, benefit, user
        )

        assert len(updated_granted["files"]) == 2
        downloadables = await TestDownloadable.get_user_downloadables(session, user)
        assert downloadables
        assert len(downloadables) == 2

        def find_downloadable(file_id: UUID) -> Downloadable | None:
            for downloadable in downloadables:
                if downloadable.file_id == file_id:
                    return downloadable
            return None

        for i, file in enumerate(files):
            assert updated_granted["files"][i] == str(file.id)
            updated_downloadable = find_downloadable(file.id)
            assert updated_downloadable
            assert updated_downloadable.status == DownloadableStatus.granted
            assert updated_downloadable.file_id == file.id
            assert updated_downloadable.deleted_at is None

    @pytest.mark.auth
    async def test_archive_for_new_users(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        user: User,
        user_second: User,
        organization: Organization,
        product: Product,
        uploaded_logo_jpg: FileRead,
        uploaded_logo_png: FileRead,
    ) -> None:
        files = [
            uploaded_logo_jpg,
            uploaded_logo_png,
        ]
        benefit, user_granted = await TestDownloadable.create_benefit_and_grant(
            session,
            save_fixture,
            user=user,
            organization=organization,
            product=product,
            properties=BenefitDownloadablesCreateProperties(
                files=[f.id for f in files],
            ),
        )

        # First user granted all files
        assert len(user_granted["files"]) == 2
        user_downloadables = await TestDownloadable.get_user_downloadables(
            session, user
        )
        assert len(user_downloadables) == 2
        for i, file in enumerate(files):
            grant = user_downloadables[i]
            assert grant.file_id == file.id
            assert grant.status == DownloadableStatus.granted

        # Mimic creator disabling a file
        benefit.properties["archived"] = {
            files[0].id: True,
        }
        session.add(benefit)
        await session.flush()
        session.expunge(benefit)

        # Second user granted one file
        # Since they subscribe after the 2nd file was archived
        _, user_second_granted = await TestDownloadable.create_grant(
            session,
            save_fixture,
            benefit,
            user=user_second,
            product=product,
        )
        assert len(user_second_granted["files"]) == 1
        user_second_downloadables = await TestDownloadable.get_user_downloadables(
            session, user_second
        )
        assert len(user_second_downloadables) == 1
        assert user_second_downloadables[0].file_id == files[1].id
        assert user_second_downloadables[0].status == DownloadableStatus.granted
