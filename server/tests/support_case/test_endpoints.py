import pytest
import pytest_asyncio
from httpx import AsyncClient

from polar.dispute.dispute_case import dispute_case as dispute_case_service
from polar.models import (
    Customer,
    Dispute,
    File,
    Organization,
    Product,
    UserOrganization,
)
from polar.models.file import FileServiceTypes
from polar.models.support_case import (
    DisputeSupportCase,
    SupportCaseMessageAuthorKind,
)
from polar.postgres import AsyncSession
from polar.support_case.service import support_case as support_case_service
from tests.fixtures.database import SaveFixture
from tests.fixtures.random_objects import (
    create_dispute,
    create_order,
    create_payment,
)

MERCHANT_REPLY = "This was a legitimate purchase — receipt attached."


@pytest_asyncio.fixture
async def dispute(
    save_fixture: SaveFixture, product: Product, customer: Customer
) -> Dispute:
    order = await create_order(save_fixture, product=product, customer=customer)
    payment = await create_payment(save_fixture, product.organization, order=order)
    return await create_dispute(save_fixture, order, payment)


async def _open_case(
    session: AsyncSession,
    dispute: Dispute,
    organization: Organization,
    *,
    with_message: bool = True,
) -> DisputeSupportCase:
    case = await dispute_case_service.open_case(
        session, dispute, organization=organization
    )
    if with_message:
        await support_case_service.add_reply(
            session,
            case,
            author_kind=SupportCaseMessageAuthorKind.merchant,
            body=MERCHANT_REPLY,
        )
    await session.flush()
    return case


async def _uploaded_attachment_file(
    save_fixture: SaveFixture,
    organization: Organization,
    *,
    service: FileServiceTypes = FileServiceTypes.support_case_attachment,
) -> File:
    file = File(
        organization=organization,
        name="evidence.pdf",
        path="support_case_attachment/evidence.pdf",
        mime_type="application/pdf",
        size=1234,
        service=service,
        is_uploaded=True,
        is_enabled=True,
    )
    await save_fixture(file)
    return file


@pytest.mark.asyncio
class TestGetCase:
    async def test_unauthorized(
        self,
        client: AsyncClient,
        session: AsyncSession,
        organization: Organization,
        dispute: Dispute,
    ) -> None:
        case = await _open_case(session, dispute, organization)
        response = await client.get(f"/v1/cases/{case.id}")
        assert response.status_code == 401

    @pytest.mark.auth
    async def test_returns_thread(
        self,
        client: AsyncClient,
        session: AsyncSession,
        organization: Organization,
        dispute: Dispute,
        user_organization: UserOrganization,
    ) -> None:
        case = await _open_case(session, dispute, organization)
        response = await client.get(f"/v1/cases/{case.id}")
        assert response.status_code == 200
        data = response.json()
        assert data["case"]["type"] == "dispute"
        assert data["is_open"] is True
        assert MERCHANT_REPLY in [m["body"] for m in data["messages"]]

    @pytest.mark.auth
    async def test_other_org_case_not_found(
        self,
        client: AsyncClient,
        session: AsyncSession,
        save_fixture: SaveFixture,
        organization: Organization,
        product_organization_second: Product,
        customer_organization_second: Customer,
        user_organization: UserOrganization,
    ) -> None:
        # A case whose org the authenticated user isn't a member of → 404.
        order = await create_order(
            save_fixture,
            product=product_organization_second,
            customer=customer_organization_second,
        )
        payment = await create_payment(
            save_fixture, product_organization_second.organization, order=order
        )
        other_dispute = await create_dispute(save_fixture, order, payment)
        other_case = await _open_case(
            session, other_dispute, product_organization_second.organization
        )

        response = await client.get(f"/v1/cases/{other_case.id}")
        assert response.status_code == 404


@pytest.mark.asyncio
class TestReplyToCase:
    @pytest.mark.auth
    async def test_valid(
        self,
        client: AsyncClient,
        session: AsyncSession,
        organization: Organization,
        dispute: Dispute,
        user_organization: UserOrganization,
    ) -> None:
        case = await _open_case(session, dispute, organization)
        response = await client.post(
            f"/v1/cases/{case.id}/messages",
            json={"body": "Here is the delivery confirmation."},
        )
        assert response.status_code == 200
        assert response.json()["body"] == "Here is the delivery confirmation."

    @pytest.mark.auth
    async def test_with_attachment(
        self,
        client: AsyncClient,
        session: AsyncSession,
        save_fixture: SaveFixture,
        organization: Organization,
        dispute: Dispute,
        user_organization: UserOrganization,
    ) -> None:
        case = await _open_case(session, dispute, organization)
        file = await _uploaded_attachment_file(save_fixture, organization)
        await session.flush()
        response = await client.post(
            f"/v1/cases/{case.id}/messages",
            json={"body": "see attached", "file_ids": [str(file.id)]},
        )
        assert response.status_code == 200

        thread = await client.get(f"/v1/cases/{case.id}")
        attachments = thread.json()["attachments"]
        assert len(attachments) == 1
        assert attachments[0]["file"]["name"] == "evidence.pdf"

    @pytest.mark.auth
    async def test_file_not_found(
        self,
        client: AsyncClient,
        session: AsyncSession,
        organization: Organization,
        dispute: Dispute,
        user_organization: UserOrganization,
    ) -> None:
        case = await _open_case(session, dispute, organization)
        response = await client.post(
            f"/v1/cases/{case.id}/messages",
            json={"file_ids": ["11111111-1111-4111-8111-111111111111"]},
        )
        assert response.status_code == 404

    @pytest.mark.auth
    async def test_closed_case(
        self,
        client: AsyncClient,
        session: AsyncSession,
        organization: Organization,
        dispute: Dispute,
        user_organization: UserOrganization,
    ) -> None:
        case = await _open_case(session, dispute, organization)
        await dispute_case_service.resolve(session, case, won=False)
        await session.flush()
        response = await client.post(
            f"/v1/cases/{case.id}/messages",
            json={"body": "please reconsider"},
        )
        assert response.status_code == 409


@pytest.mark.asyncio
class TestDownloadCaseAttachment:
    @pytest.mark.auth
    async def test_valid(
        self,
        client: AsyncClient,
        session: AsyncSession,
        save_fixture: SaveFixture,
        organization: Organization,
        dispute: Dispute,
        user_organization: UserOrganization,
    ) -> None:
        case = await _open_case(session, dispute, organization)
        file = await _uploaded_attachment_file(save_fixture, organization)
        await session.flush()
        await client.post(
            f"/v1/cases/{case.id}/messages",
            json={"file_ids": [str(file.id)]},
        )
        thread = await client.get(f"/v1/cases/{case.id}")
        attachment_id = thread.json()["attachments"][0]["id"]

        response = await client.get(
            f"/v1/cases/{case.id}/attachments/{attachment_id}/download"
        )
        assert response.status_code == 302
        assert response.headers["location"]

    @pytest.mark.auth
    async def test_not_found(
        self,
        client: AsyncClient,
        session: AsyncSession,
        organization: Organization,
        dispute: Dispute,
        user_organization: UserOrganization,
    ) -> None:
        case = await _open_case(session, dispute, organization)
        response = await client.get(
            f"/v1/cases/{case.id}"
            "/attachments/00000000-0000-0000-0000-000000000000/download"
        )
        assert response.status_code == 404
