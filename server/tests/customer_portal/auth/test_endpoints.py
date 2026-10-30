from collections.abc import AsyncIterator
from unittest.mock import MagicMock

import httpx
import pytest
from fastapi import FastAPI
from pytest_mock import MockerFixture

from polar.config import settings
from polar.models import Customer, Member, Organization
from polar.postgres import AsyncSession
from tests.fixtures.base import IsolatedSessionTestClient
from tests.fixtures.database import SaveFixture
from tests.fixtures.random_objects import create_customer, create_member


@pytest.fixture
async def portal_client(
    app: FastAPI, session: AsyncSession
) -> AsyncIterator[httpx.AsyncClient]:
    async with IsolatedSessionTestClient(
        session=session,
        auto_expunge=False,
        transport=httpx.ASGITransport(app=app),
        base_url="http://127.0.0.1",
    ) as client:
        yield client


@pytest.fixture(autouse=True)
def send_code(mocker: MockerFixture) -> MagicMock:
    return mocker.patch(
        "polar.customer_portal.auth.factors.customer_session_service.send_code",
        autospec=True,
    )


def sent_code(send_code: MagicMock) -> str:
    return send_code.call_args.args[2]


async def start(client: httpx.AsyncClient, organization: Organization) -> None:
    response = await client.post(
        "/v1/customer-portal/customer-session/start",
        json={"organization_id": str(organization.id)},
    )
    assert response.status_code == 201
    assert settings.CUSTOMER_SESSION_AUTHENTICATION_SESSION_COOKIE_KEY in (
        client.cookies
    )


async def request_code(
    client: httpx.AsyncClient, email: str, customer: Customer | None = None
) -> httpx.Response:
    return await client.post(
        "/v1/customer-portal/customer-session/email-otp/request",
        json={
            "email": email,
            **({"customer_id": str(customer.id)} if customer else {}),
        },
    )


async def verify(client: httpx.AsyncClient, code: str) -> httpx.Response:
    return await client.post(
        "/v1/customer-portal/customer-session/email-otp/verify",
        json={"code": code},
    )


@pytest.mark.anyio
class TestEmailOTPRequest:
    async def test_without_authentication_session(
        self, portal_client: httpx.AsyncClient
    ) -> None:
        response = await request_code(portal_client, "customer@example.com")

        assert response.status_code == 401

    async def test_unknown_email(
        self,
        portal_client: httpx.AsyncClient,
        organization: Organization,
        send_code: MagicMock,
    ) -> None:
        await start(portal_client, organization)

        response = await request_code(portal_client, "unknown@example.com")

        assert response.status_code == 202
        send_code.assert_not_called()

    async def test_customer_selection(
        self,
        portal_client: httpx.AsyncClient,
        save_fixture: SaveFixture,
        organization: Organization,
        send_code: MagicMock,
    ) -> None:
        customer_1 = await create_customer(
            save_fixture, organization=organization, email="a@example.com"
        )
        customer_2 = await create_customer(
            save_fixture, organization=organization, email="b@example.com"
        )
        for customer in (customer_1, customer_2):
            await create_member(
                save_fixture,
                customer=customer,
                organization=organization,
                email="shared@example.com",
            )
        await start(portal_client, organization)

        response = await request_code(portal_client, "shared@example.com")
        assert response.status_code == 409
        assert {c["id"] for c in response.json()["customers"]} == {
            str(customer_1.id),
            str(customer_2.id),
        }

        response = await request_code(portal_client, "shared@example.com", customer_2)
        assert response.status_code == 202
        send_code.assert_called_once()


@pytest.mark.anyio
class TestEmailOTPVerify:
    async def test_valid(
        self,
        portal_client: httpx.AsyncClient,
        session: AsyncSession,
        organization: Organization,
        customer: Customer,
        member_owner: Member,
        send_code: MagicMock,
    ) -> None:
        await start(portal_client, organization)
        await request_code(portal_client, member_owner.email)

        response = await verify(portal_client, sent_code(send_code))

        assert response.status_code == 200
        assert response.json()["token"].startswith("polar_mst_")
        assert (
            settings.CUSTOMER_SESSION_AUTHENTICATION_SESSION_COOKIE_KEY
            not in portal_client.cookies
        )
        await session.refresh(customer)
        assert customer.email_verified is True

    async def test_code_from_another_authentication_session(
        self,
        app: FastAPI,
        session: AsyncSession,
        portal_client: httpx.AsyncClient,
        organization: Organization,
        member_owner: Member,
        send_code: MagicMock,
    ) -> None:
        await start(portal_client, organization)
        await request_code(portal_client, member_owner.email)
        code = sent_code(send_code)

        async with IsolatedSessionTestClient(
            session=session,
            auto_expunge=False,
            transport=httpx.ASGITransport(app=app),
            base_url="http://127.0.0.1",
        ) as attacker_client:
            await start(attacker_client, organization)
            response = await verify(attacker_client, code)

        assert response.status_code == 401

    async def test_new_request_invalidates_previous_code(
        self,
        portal_client: httpx.AsyncClient,
        organization: Organization,
        member_owner: Member,
        send_code: MagicMock,
    ) -> None:
        await start(portal_client, organization)
        await request_code(portal_client, member_owner.email)
        previous_code = sent_code(send_code)
        await request_code(portal_client, member_owner.email)

        response = await verify(portal_client, previous_code)

        assert response.status_code == 401
