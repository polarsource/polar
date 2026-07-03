import pytest
from httpx import AsyncClient
from pytest_mock import MockerFixture
from sqlalchemy import select

from polar.dispute.dispute_case import DISPUTE_GREETING_DELAY_MS
from polar.models import Customer, Organization, Product
from polar.models.support_case import (
    DisputeSupportCase,
    DisputeWinReason,
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
        assert response.status_code == 201
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
        assert response.status_code == 201

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
    async def test_dispute_case_accepts_reply(
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
        assert response.status_code == 201
        assert response.json()["body"] == "my evidence"

    @pytest.mark.auth
    async def test_dispute_reply_records_win_reason(
        self,
        client: AsyncClient,
        session: AsyncSession,
        save_fixture: SaveFixture,
        organization: Organization,
        customer: Customer,
        product: Product,
        user_organization: UserOrganization,
    ) -> None:
        case = await create_dispute_case(save_fixture, organization, customer, product)
        assert case.win_reason is None

        response = await client.post(
            f"/v1/support-cases/{case.id}/messages",
            json={
                "body": "my evidence",
                "dispute_win_reason": "cardholder_withdrew",
            },
        )
        assert response.status_code == 201

        win_reason = await session.scalar(
            select(DisputeSupportCase.win_reason).where(
                DisputeSupportCase.id == case.id
            )
        )
        assert win_reason == DisputeWinReason.cardholder_withdrew

    @pytest.mark.auth
    async def test_dispute_reply_records_win_reason_other(
        self,
        client: AsyncClient,
        session: AsyncSession,
        save_fixture: SaveFixture,
        organization: Organization,
        customer: Customer,
        product: Product,
        user_organization: UserOrganization,
    ) -> None:
        case = await create_dispute_case(save_fixture, organization, customer, product)

        response = await client.post(
            f"/v1/support-cases/{case.id}/messages",
            json={
                "body": "my evidence",
                "dispute_win_reason": "other",
                "dispute_win_reason_other": "The subscription was reactivated",
            },
        )
        assert response.status_code == 201

        row = (
            await session.execute(
                select(
                    DisputeSupportCase.win_reason,
                    DisputeSupportCase.win_reason_other,
                ).where(DisputeSupportCase.id == case.id)
            )
        ).one()
        assert row.win_reason == DisputeWinReason.other
        assert row.win_reason_other == "The subscription was reactivated"

    @pytest.mark.auth
    async def test_win_reason_other_without_other_reason_rejected(
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
            f"/v1/support-cases/{case.id}/messages",
            json={
                "body": "my evidence",
                "dispute_win_reason_other": "would be silently lost",
            },
        )
        assert response.status_code == 422

    @pytest.mark.auth
    async def test_win_reason_other_required_for_other(
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
            f"/v1/support-cases/{case.id}/messages",
            json={"body": "my evidence", "dispute_win_reason": "other"},
        )
        assert response.status_code == 422

    @pytest.mark.auth
    async def test_dispute_first_reply_enqueues_greeting(
        self,
        client: AsyncClient,
        mocker: MockerFixture,
        save_fixture: SaveFixture,
        organization: Organization,
        customer: Customer,
        product: Product,
        user_organization: UserOrganization,
    ) -> None:
        case = await create_dispute_case(save_fixture, organization, customer, product)
        enqueue = mocker.patch("polar.dispute.dispute_case.enqueue_job")

        await client.post(
            f"/v1/support-cases/{case.id}/messages", json={"body": "my evidence"}
        )
        enqueue.assert_any_call(
            "dispute.post_dispute_greeting",
            case_id=case.id,
            delay=DISPUTE_GREETING_DELAY_MS,
        )

        enqueue.reset_mock()
        await client.post(
            f"/v1/support-cases/{case.id}/messages",
            json={"body": "one more thing"},
        )
        greeting_calls = [
            call
            for call in enqueue.call_args_list
            if call.args and call.args[0] == "dispute.post_dispute_greeting"
        ]
        assert greeting_calls == []


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
