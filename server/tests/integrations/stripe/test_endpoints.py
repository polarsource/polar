import uuid

import pytest
import stripe as stripe_lib
from fastapi import HTTPException
from httpx import AsyncClient
from pytest_mock import MockerFixture
from starlette.requests import Request

from polar.config import settings
from polar.integrations.stripe.endpoints import WebhookEventGetter
from polar.integrations.stripe.service import StripeService
from polar.models import Organization, User
from tests.fixtures.database import SaveFixture
from tests.fixtures.random_objects import create_payout_account


@pytest.fixture
def stripe_service_mock(mocker: MockerFixture) -> StripeService:
    mock = mocker.MagicMock(spec=StripeService)
    mocker.patch("polar.payout_account.service.stripe", new=mock)
    return mock


@pytest.mark.asyncio
class TestStripeConnectRefresh:
    async def test_missing_return_path(self, client: AsyncClient) -> None:
        response = await client.get("/v1/integrations/stripe/refresh")

        assert response.status_code == 404

    async def test_valid_return_path(self, client: AsyncClient) -> None:
        return_path = "/dashboard/acme/finance/account"
        response = await client.get(
            "/v1/integrations/stripe/refresh", params={"return_path": return_path}
        )

        assert response.status_code == 307
        assert response.headers["location"] == settings.generate_frontend_url(
            return_path
        )

    @pytest.mark.parametrize(
        "return_path",
        [
            "@evil.com",
            "https://evil.com/phish",
            "//evil.com",
            "evil.com",
        ],
    )
    async def test_unsafe_return_path(
        self, client: AsyncClient, return_path: str
    ) -> None:
        response = await client.get(
            "/v1/integrations/stripe/refresh", params={"return_path": return_path}
        )

        assert response.status_code == 307
        assert response.headers["location"] == settings.generate_frontend_url(
            settings.FRONTEND_DEFAULT_RETURN_PATH
        )

    @pytest.mark.auth
    async def test_mints_a_new_account_link(
        self,
        client: AsyncClient,
        save_fixture: SaveFixture,
        organization: Organization,
        user: User,
        stripe_service_mock: StripeService,
    ) -> None:
        payout_account = await create_payout_account(save_fixture, organization, user)
        stripe_service_mock.create_account_link.return_value = (  # type: ignore[attr-defined]
            stripe_lib.AccountLink.construct_from(
                {"url": "https://connect.stripe.com/setup/fresh"}, None
            )
        )

        response = await client.get(
            "/v1/integrations/stripe/refresh",
            params={
                "return_path": "/dashboard/acme/finance/account",
                "id": str(payout_account.id),
            },
        )

        assert response.status_code == 307
        assert response.headers["location"] == "https://connect.stripe.com/setup/fresh"

    async def test_anonymous_falls_back_to_dashboard(self, client: AsyncClient) -> None:
        return_path = "/dashboard/acme/finance/account"

        response = await client.get(
            "/v1/integrations/stripe/refresh",
            params={"return_path": return_path, "id": str(uuid.uuid4())},
        )

        assert response.status_code == 307
        assert response.headers["location"] == settings.generate_frontend_url(
            return_path
        )

    @pytest.mark.auth
    async def test_other_users_account_falls_back_to_dashboard(
        self,
        client: AsyncClient,
        save_fixture: SaveFixture,
        organization: Organization,
        user_second: User,
        stripe_service_mock: StripeService,
    ) -> None:
        return_path = "/dashboard/acme/finance/account"
        payout_account = await create_payout_account(
            save_fixture, organization, user_second
        )

        response = await client.get(
            "/v1/integrations/stripe/refresh",
            params={"return_path": return_path, "id": str(payout_account.id)},
        )

        assert response.status_code == 307
        assert response.headers["location"] == settings.generate_frontend_url(
            return_path
        )
        stripe_service_mock.create_account_link.assert_not_called()  # type: ignore[attr-defined]

    @pytest.mark.auth
    async def test_stripe_error_falls_back_to_dashboard(
        self,
        client: AsyncClient,
        save_fixture: SaveFixture,
        organization: Organization,
        user: User,
        stripe_service_mock: StripeService,
    ) -> None:
        return_path = "/dashboard/acme/finance/account"
        payout_account = await create_payout_account(save_fixture, organization, user)
        stripe_service_mock.create_account_link.side_effect = (  # type: ignore[attr-defined]
            stripe_lib.APIConnectionError("boom")
        )

        response = await client.get(
            "/v1/integrations/stripe/refresh",
            params={"return_path": return_path, "id": str(payout_account.id)},
        )

        assert response.status_code == 307
        assert response.headers["location"] == settings.generate_frontend_url(
            return_path
        )


@pytest.mark.asyncio
class TestWebhookAccountRisk:
    async def test_disabled_when_secret_unset(self, client: AsyncClient) -> None:
        # STRIPE_ACCOUNT_RISK_WEBHOOK_SECRET defaults to "" in tests; the endpoint
        # must reject rather than verify a forgeable empty-key signature.
        assert settings.STRIPE_ACCOUNT_RISK_WEBHOOK_SECRET == ""

        response = await client.post(
            "/v1/integrations/stripe/webhook-account-risk",
            headers={"Stripe-Signature": "t=1,v1=forged"},
            content=b"{}",
        )

        assert response.status_code == 404


def _request_without_signature() -> Request:
    async def receive() -> dict[str, object]:
        return {"type": "http.request", "body": b"{}", "more_body": False}

    return Request({"type": "http", "headers": []}, receive)


@pytest.mark.asyncio
class TestWebhookEventGetter:
    async def test_empty_secret_returns_404(self) -> None:
        with pytest.raises(HTTPException) as exc_info:
            await WebhookEventGetter("")(_request_without_signature())
        assert exc_info.value.status_code == 404

    async def test_missing_signature_header_returns_400(self) -> None:
        with pytest.raises(HTTPException) as exc_info:
            await WebhookEventGetter("whsec_test")(_request_without_signature())
        assert exc_info.value.status_code == 400
