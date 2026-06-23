import pytest
from httpx import AsyncClient

from polar.models import Customer, Organization, Product
from polar.models.support_case import (
    SupportCaseAudience,
    SupportCaseMessageAuthorKind,
)
from polar.models.user_organization import OrganizationRole, UserOrganization
from polar.postgres import AsyncSession
from polar.support_case.service import support_case as support_case_service
from tests.fixtures.auth import AuthSubjectFixture
from tests.fixtures.database import SaveFixture
from tests.fixtures.random_objects import (
    create_appeal_case,
    create_dispute_case,
    create_support_case_attachment_file,
)


@pytest.mark.asyncio
class TestGetSupportCase:
    async def test_anonymous(
        self,
        client: AsyncClient,
        save_fixture: SaveFixture,
        organization: Organization,
    ) -> None:
        case = await create_appeal_case(save_fixture, organization)
        response = await client.get(f"/v1/support-cases/{case.id}")
        assert response.status_code == 401

    @pytest.mark.auth
    async def test_unknown_id(
        self,
        client: AsyncClient,
        organization: Organization,
        user_organization: UserOrganization,
    ) -> None:
        response = await client.get(
            "/v1/support-cases/00000000-0000-4000-8000-000000000000"
        )
        assert response.status_code == 404

    @pytest.mark.auth
    async def test_not_found_for_member_without_manage(
        self,
        client: AsyncClient,
        save_fixture: SaveFixture,
        organization: Organization,
        user_organization: UserOrganization,
    ) -> None:
        user_organization.role = OrganizationRole.member
        await save_fixture(user_organization)
        case = await create_appeal_case(save_fixture, organization)

        response = await client.get(f"/v1/support-cases/{case.id}")
        assert response.status_code == 404

    @pytest.mark.auth
    async def test_returns_thread(
        self,
        client: AsyncClient,
        session: AsyncSession,
        save_fixture: SaveFixture,
        organization: Organization,
        user_organization: UserOrganization,
    ) -> None:
        case = await create_appeal_case(save_fixture, organization)
        await support_case_service.post_message(
            session,
            case,
            author_kind=SupportCaseMessageAuthorKind.merchant,
            body="merchant message",
            audience=[SupportCaseAudience.merchant],
        )
        await support_case_service.post_message(
            session,
            case,
            author_kind=SupportCaseMessageAuthorKind.platform,
            body="internal note",
            audience=[],
        )
        await session.flush()

        response = await client.get(f"/v1/support-cases/{case.id}")
        assert response.status_code == 200
        data = response.json()
        assert data["is_open"] is True
        bodies = [m["body"] for m in data["messages"]]
        assert "merchant message" in bodies
        assert "internal note" not in bodies

    @pytest.mark.auth(AuthSubjectFixture(subject="organization"))
    async def test_organization_subject(
        self,
        client: AsyncClient,
        save_fixture: SaveFixture,
        organization: Organization,
    ) -> None:
        case = await create_appeal_case(save_fixture, organization)
        response = await client.get(f"/v1/support-cases/{case.id}")
        assert response.status_code == 200


@pytest.mark.asyncio
class TestReplyToSupportCase:
    async def test_anonymous(
        self,
        client: AsyncClient,
        save_fixture: SaveFixture,
        organization: Organization,
    ) -> None:
        case = await create_appeal_case(save_fixture, organization)
        response = await client.post(
            f"/v1/support-cases/{case.id}/messages", json={"body": "hello"}
        )
        assert response.status_code == 401

    @pytest.mark.auth
    async def test_valid_body(
        self,
        client: AsyncClient,
        save_fixture: SaveFixture,
        organization: Organization,
        user_organization: UserOrganization,
    ) -> None:
        case = await create_appeal_case(save_fixture, organization)
        response = await client.post(
            f"/v1/support-cases/{case.id}/messages",
            json={"body": "here is more detail"},
        )
        assert response.status_code == 200
        assert response.json()["body"] == "here is more detail"

    @pytest.mark.auth
    async def test_valid_with_files(
        self,
        client: AsyncClient,
        session: AsyncSession,
        save_fixture: SaveFixture,
        organization: Organization,
        user_organization: UserOrganization,
    ) -> None:
        case = await create_appeal_case(save_fixture, organization)
        file = await create_support_case_attachment_file(save_fixture, organization)
        await session.flush()

        response = await client.post(
            f"/v1/support-cases/{case.id}/messages",
            json={"body": "see attached", "file_ids": [str(file.id)]},
        )
        assert response.status_code == 200

        thread = await client.get(f"/v1/support-cases/{case.id}")
        attachments = thread.json()["attachments"]
        assert len(attachments) == 1
        assert attachments[0]["file"]["name"] == "evidence.pdf"

    @pytest.mark.auth
    async def test_file_from_other_org_rejected(
        self,
        client: AsyncClient,
        session: AsyncSession,
        save_fixture: SaveFixture,
        organization: Organization,
        organization_second: Organization,
        user_organization: UserOrganization,
    ) -> None:
        case = await create_appeal_case(save_fixture, organization)
        file = await create_support_case_attachment_file(
            save_fixture, organization_second
        )
        await session.flush()

        response = await client.post(
            f"/v1/support-cases/{case.id}/messages",
            json={"file_ids": [str(file.id)]},
        )
        assert response.status_code == 404

    @pytest.mark.auth
    async def test_closed_case(
        self,
        client: AsyncClient,
        session: AsyncSession,
        save_fixture: SaveFixture,
        organization: Organization,
        user_organization: UserOrganization,
    ) -> None:
        case = await create_appeal_case(save_fixture, organization)
        await support_case_service.close(
            session,
            case,
            author_kind=SupportCaseMessageAuthorKind.platform,
            audience=[SupportCaseAudience.merchant],
        )
        await session.flush()

        response = await client.post(
            f"/v1/support-cases/{case.id}/messages", json={"body": "reopen?"}
        )
        assert response.status_code == 409

    @pytest.mark.auth
    async def test_dispute_case_is_read_only(
        self,
        client: AsyncClient,
        save_fixture: SaveFixture,
        organization: Organization,
        customer: Customer,
        product: Product,
        user_organization: UserOrganization,
    ) -> None:
        case = await create_dispute_case(save_fixture, organization, customer, product)
        response = await client.post(
            f"/v1/support-cases/{case.id}/messages", json={"body": "my evidence"}
        )
        assert response.status_code == 409


@pytest.mark.asyncio
class TestDownloadSupportCaseAttachment:
    @pytest.mark.auth
    async def test_valid(
        self,
        client: AsyncClient,
        session: AsyncSession,
        save_fixture: SaveFixture,
        organization: Organization,
        user_organization: UserOrganization,
    ) -> None:
        case = await create_appeal_case(save_fixture, organization)
        file = await create_support_case_attachment_file(save_fixture, organization)
        await session.flush()
        await client.post(
            f"/v1/support-cases/{case.id}/messages",
            json={"file_ids": [str(file.id)]},
        )

        thread = await client.get(f"/v1/support-cases/{case.id}")
        attachment_id = thread.json()["attachments"][0]["id"]

        response = await client.get(
            f"/v1/support-cases/{case.id}/attachments/{attachment_id}/download"
        )
        assert response.status_code == 302
        assert response.headers["location"]

    @pytest.mark.auth
    async def test_internal_attachment_hidden(
        self,
        client: AsyncClient,
        session: AsyncSession,
        save_fixture: SaveFixture,
        organization: Organization,
        user_organization: UserOrganization,
    ) -> None:
        case = await create_appeal_case(save_fixture, organization)
        file = await create_support_case_attachment_file(save_fixture, organization)
        attachment = await support_case_service.add_attachment(
            session, case, file=file, audience=[]
        )
        await session.flush()

        response = await client.get(
            f"/v1/support-cases/{case.id}/attachments/{attachment.id}/download"
        )
        assert response.status_code == 404

    @pytest.mark.auth
    async def test_unknown_attachment(
        self,
        client: AsyncClient,
        save_fixture: SaveFixture,
        organization: Organization,
        user_organization: UserOrganization,
    ) -> None:
        case = await create_appeal_case(save_fixture, organization)
        response = await client.get(
            f"/v1/support-cases/{case.id}/attachments/"
            "00000000-0000-4000-8000-000000000000/download"
        )
        assert response.status_code == 404
