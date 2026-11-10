import pytest
from httpx import AsyncClient
from pytest_mock import MockerFixture

from polar.email.schemas import OrganizationEmailVerificationEmail
from polar.models import Organization, UserOrganization
from polar.organization_email.service import (
    organization_email as organization_email_service,
)
from polar.postgres import AsyncSession
from tests.fixtures.database import SaveFixture

SUPPORT_EMAIL = "support@acme.com"


@pytest.fixture
async def organization_with_email(
    save_fixture: SaveFixture, organization: Organization
) -> Organization:
    organization.email = SUPPORT_EMAIL
    await save_fixture(organization)
    return organization


@pytest.mark.anyio
class TestGetOrganizationEmail:
    async def test_anonymous(
        self, client: AsyncClient, organization: Organization
    ) -> None:
        response = await client.get(f"/v1/organizations/{organization.id}/email/")
        assert response.status_code == 401

    @pytest.mark.auth
    async def test_not_member(
        self, client: AsyncClient, organization: Organization
    ) -> None:
        response = await client.get(f"/v1/organizations/{organization.id}/email/")
        assert response.status_code == 404

    @pytest.mark.auth
    async def test_valid(
        self,
        client: AsyncClient,
        organization_with_email: Organization,
        user_organization: UserOrganization,
    ) -> None:
        response = await client.get(
            f"/v1/organizations/{organization_with_email.id}/email/"
        )
        assert response.status_code == 200
        assert response.json() == {
            "email": SUPPORT_EMAIL,
            "verified": False,
            "code_pending": False,
        }

    @pytest.mark.auth
    async def test_code_pending(
        self,
        mocker: MockerFixture,
        client: AsyncClient,
        session: AsyncSession,
        organization_with_email: Organization,
        user_organization: UserOrganization,
    ) -> None:
        mocker.patch("polar.organization_email.service.enqueue_email_template")
        await organization_email_service.send_code(session, organization_with_email)
        await session.flush()

        response = await client.get(
            f"/v1/organizations/{organization_with_email.id}/email/"
        )
        assert response.status_code == 200
        assert response.json()["code_pending"] is True


@pytest.mark.anyio
class TestSendOrganizationEmailCode:
    @pytest.mark.auth
    async def test_no_email(
        self,
        client: AsyncClient,
        organization: Organization,
        user_organization: UserOrganization,
    ) -> None:
        response = await client.post(
            f"/v1/organizations/{organization.id}/email/send-code"
        )
        assert response.status_code == 409

    @pytest.mark.auth
    async def test_valid(
        self,
        mocker: MockerFixture,
        client: AsyncClient,
        organization_with_email: Organization,
        user_organization: UserOrganization,
    ) -> None:
        enqueue_email_mock = mocker.patch(
            "polar.organization_email.service.enqueue_email_template"
        )
        response = await client.post(
            f"/v1/organizations/{organization_with_email.id}/email/send-code"
        )
        assert response.status_code == 204
        enqueue_email_mock.assert_called_once()
        assert isinstance(
            enqueue_email_mock.call_args.args[0], OrganizationEmailVerificationEmail
        )


@pytest.mark.anyio
class TestVerifyOrganizationEmail:
    @pytest.mark.auth
    async def test_invalid_code(
        self,
        client: AsyncClient,
        organization_with_email: Organization,
        user_organization: UserOrganization,
    ) -> None:
        response = await client.post(
            f"/v1/organizations/{organization_with_email.id}/email/verify",
            json={"code": "ABC123"},
        )
        assert response.status_code == 400

    @pytest.mark.auth
    async def test_valid(
        self,
        mocker: MockerFixture,
        client: AsyncClient,
        session: AsyncSession,
        organization_with_email: Organization,
        user_organization: UserOrganization,
    ) -> None:
        enqueue_email_mock = mocker.patch(
            "polar.organization_email.service.enqueue_email_template"
        )
        await organization_email_service.send_code(session, organization_with_email)
        await session.flush()
        code = enqueue_email_mock.call_args.args[0].props.code

        response = await client.post(
            f"/v1/organizations/{organization_with_email.id}/email/verify",
            json={"code": code},
        )
        assert response.status_code == 200
        assert response.json() == {
            "email": SUPPORT_EMAIL,
            "verified": True,
            "code_pending": False,
        }
