from typing import cast
from uuid import UUID, uuid4

import pytest

from polar.auth.models import AuthSubject
from polar.benefit.strategies.base.service import BenefitPropertiesValidationError
from polar.benefit.strategies.downloadables.properties import (
    BenefitDownloadablesProperties,
)
from polar.benefit.strategies.downloadables.schemas import (
    BenefitDownloadablesCreateProperties,
)
from polar.benefit.strategies.downloadables.service import BenefitDownloadablesService
from polar.file.schemas import FileRead
from polar.models import (
    Benefit,
    Customer,
    Downloadable,
    Member,
    Organization,
    Product,
    User,
    UserOrganization,
)
from polar.models.benefit import BenefitType
from polar.models.downloadable import DownloadableStatus
from polar.postgres import AsyncSession
from polar.redis import Redis
from tests.fixtures.database import SaveFixture
from tests.fixtures.downloadable import TestDownloadable
from tests.fixtures.file import TestFile, uploaded_fixture
from tests.fixtures.random_objects import create_benefit, create_member


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
        cast(BenefitDownloadablesProperties, benefit.properties)["archived"] = {}
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
        cast(BenefitDownloadablesProperties, benefit.properties)["archived"] = {
            files[0].id: True
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

    @pytest.mark.auth
    async def test_grant_update_revokes_removed_files(
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
        files = [uploaded_logo_jpg, uploaded_logo_png]
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
        assert len(granted.get("files", [])) == 2

        cast(BenefitDownloadablesProperties, benefit.properties)["files"] = [
            uploaded_logo_jpg.id
        ]
        session.add(benefit)
        await session.flush()

        _, updated = await TestDownloadable.run_update_grant_task(
            session, redis, benefit, customer, granted
        )
        assert updated.get("files", []) == [str(uploaded_logo_jpg.id)]

        downloadables = await TestDownloadable.get_customer_downloadables(
            session, customer
        )
        assert len(downloadables) == 2

        by_file = {d.file_id: d for d in downloadables}
        assert by_file[uploaded_logo_jpg.id].status == DownloadableStatus.granted
        assert by_file[uploaded_logo_png.id].status == DownloadableStatus.revoked

    @pytest.mark.auth
    async def test_grant_update_no_change_keeps_grants(
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
        files = [uploaded_logo_jpg, uploaded_logo_png]
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

        _, updated = await TestDownloadable.run_update_grant_task(
            session, redis, benefit, customer, granted
        )
        assert set(updated.get("files", [])) == {str(f.id) for f in files}

        downloadables = await TestDownloadable.get_customer_downloadables(
            session, customer
        )
        assert len(downloadables) == 2
        for downloadable in downloadables:
            assert downloadable.status == DownloadableStatus.granted

    @pytest.mark.auth
    async def test_grant_update_revokes_archived_file(
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
        files = [uploaded_logo_jpg, uploaded_logo_png]
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
        assert len(granted.get("files", [])) == 2

        cast(BenefitDownloadablesProperties, benefit.properties)["archived"] = {
            uploaded_logo_png.id: True
        }
        session.add(benefit)
        await session.flush()

        _, updated = await TestDownloadable.run_update_grant_task(
            session, redis, benefit, customer, granted
        )
        assert updated.get("files", []) == [str(uploaded_logo_jpg.id)]

        downloadables = await TestDownloadable.get_customer_downloadables(
            session, customer
        )
        by_file = {d.file_id: d for d in downloadables}
        assert by_file[uploaded_logo_jpg.id].status == DownloadableStatus.granted
        assert by_file[uploaded_logo_png.id].status == DownloadableStatus.revoked


@pytest.mark.asyncio
class TestMemberLevelDownloadables:
    async def _create_benefit_and_members(
        self,
        save_fixture: SaveFixture,
        customer: Customer,
        organization: Organization,
        uploaded_logo_jpg: FileRead,
    ) -> tuple[Benefit, Member, Member]:
        benefit = await create_benefit(
            save_fixture,
            type=BenefitType.downloadables,
            organization=organization,
            properties=BenefitDownloadablesCreateProperties(
                files=[uploaded_logo_jpg.id]
            ).model_dump(mode="json"),
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
        return benefit, member_a, member_b

    @pytest.mark.auth
    async def test_grant_creates_distinct_row_per_member(
        self,
        session: AsyncSession,
        redis: Redis,
        save_fixture: SaveFixture,
        customer: Customer,
        organization: Organization,
        uploaded_logo_jpg: FileRead,
    ) -> None:
        benefit, member_a, member_b = await self._create_benefit_and_members(
            save_fixture, customer, organization, uploaded_logo_jpg
        )

        await TestDownloadable.run_grant_task(
            session, redis, benefit, customer, member=member_a
        )
        # Before the member-level constraint, this second grant collided on the
        # shared (customer, file, benefit) row and member_b got nothing.
        await TestDownloadable.run_grant_task(
            session, redis, benefit, customer, member=member_b
        )

        downloadables = await TestDownloadable.get_customer_downloadables(
            session, customer
        )
        assert len(downloadables) == 2
        assert {d.member_id for d in downloadables} == {member_a.id, member_b.id}
        for downloadable in downloadables:
            assert downloadable.file_id == uploaded_logo_jpg.id
            assert downloadable.status == DownloadableStatus.granted

    @pytest.mark.auth
    async def test_each_member_sees_their_own_downloadable(
        self,
        session: AsyncSession,
        redis: Redis,
        save_fixture: SaveFixture,
        customer: Customer,
        organization: Organization,
        uploaded_logo_jpg: FileRead,
    ) -> None:
        benefit, member_a, member_b = await self._create_benefit_and_members(
            save_fixture, customer, organization, uploaded_logo_jpg
        )
        await TestDownloadable.run_grant_task(
            session, redis, benefit, customer, member=member_a
        )
        await TestDownloadable.run_grant_task(
            session, redis, benefit, customer, member=member_b
        )

        member_a_downloadables = await TestDownloadable.get_member_downloadables(
            session, member_a
        )
        member_b_downloadables = await TestDownloadable.get_member_downloadables(
            session, member_b
        )

        assert len(member_a_downloadables) == 1
        assert member_a_downloadables[0].member_id == member_a.id
        assert member_a_downloadables[0].file_id == uploaded_logo_jpg.id

        assert len(member_b_downloadables) == 1
        assert member_b_downloadables[0].member_id == member_b.id
        assert member_b_downloadables[0].file_id == uploaded_logo_jpg.id

    @pytest.mark.auth
    async def test_revoke_is_scoped_to_member(
        self,
        session: AsyncSession,
        redis: Redis,
        save_fixture: SaveFixture,
        customer: Customer,
        organization: Organization,
        uploaded_logo_jpg: FileRead,
    ) -> None:
        benefit, member_a, member_b = await self._create_benefit_and_members(
            save_fixture, customer, organization, uploaded_logo_jpg
        )
        await TestDownloadable.run_grant_task(
            session, redis, benefit, customer, member=member_a
        )
        await TestDownloadable.run_grant_task(
            session, redis, benefit, customer, member=member_b
        )

        await TestDownloadable.run_revoke_task(
            session, redis, benefit, customer, member=member_a
        )

        assert await TestDownloadable.get_member_downloadables(session, member_a) == []

        member_b_downloadables = await TestDownloadable.get_member_downloadables(
            session, member_b
        )
        assert len(member_b_downloadables) == 1
        assert member_b_downloadables[0].status == DownloadableStatus.granted


@pytest.mark.asyncio
class TestValidateProperties:
    @pytest.mark.auth
    async def test_valid(
        self,
        session: AsyncSession,
        redis: Redis,
        auth_subject: AuthSubject[User],
        organization: Organization,
        user_organization: UserOrganization,
        uploaded_logo_jpg: FileRead,
    ) -> None:
        service = BenefitDownloadablesService(session, redis)

        properties = await service.validate_properties(
            auth_subject,
            organization,
            {"archived": {}, "files": [str(uploaded_logo_jpg.id)]},
        )

        assert properties["files"] == [str(uploaded_logo_jpg.id)]

    @pytest.mark.auth
    async def test_file_from_other_organization(
        self,
        session: AsyncSession,
        redis: Redis,
        auth_subject: AuthSubject[User],
        organization: Organization,
        user_organization: UserOrganization,
        organization_second: Organization,
    ) -> None:
        other_file = await uploaded_fixture(
            session, organization_second, TestFile("logo.jpg")
        )
        service = BenefitDownloadablesService(session, redis)

        with pytest.raises(BenefitPropertiesValidationError):
            await service.validate_properties(
                auth_subject,
                organization,
                {"archived": {}, "files": [str(other_file.id)]},
            )

    @pytest.mark.auth
    async def test_unknown_file(
        self,
        session: AsyncSession,
        redis: Redis,
        auth_subject: AuthSubject[User],
        organization: Organization,
        user_organization: UserOrganization,
    ) -> None:
        service = BenefitDownloadablesService(session, redis)

        with pytest.raises(BenefitPropertiesValidationError):
            await service.validate_properties(
                auth_subject,
                organization,
                {"archived": {}, "files": [str(uuid4())]},
            )
