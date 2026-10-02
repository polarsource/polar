import traceback
from urllib.parse import quote

import pytest
import respx

from polar.config import settings
from polar.integrations.resend.client import (
    ContactDoesNotExist,
    InvalidIdentifier,
    ResendAPIError,
    ResendClient,
    ResendClientError,
)

EMAIL = "user@example.com"


@pytest.fixture
def client() -> ResendClient:
    return ResendClient()


@pytest.mark.asyncio
class TestGetContact:
    async def test_server_error(
        self, client: ResendClient, respx_mock: respx.MockRouter
    ) -> None:
        respx_mock.get(path=f"/contacts/{EMAIL}").respond(530)

        with pytest.raises(ResendAPIError) as exc:
            await client.get_contact(EMAIL)

        error = exc.value
        assert error.method == "GET"
        assert error.path == "/contacts/{identifier}"
        assert error.response_status_code == 530
        assert error.__cause__ is None
        assert error.__suppress_context__
        assert error.__context__ is None

        formatted = "".join(traceback.format_exception(error))
        for leaked in (EMAIL, quote(EMAIL, safe=""), settings.RESEND_API_BASE_URL):
            assert leaked not in str(error)
            assert leaked not in formatted

    @pytest.mark.parametrize(
        ("status_code", "exception_class"),
        [(404, ContactDoesNotExist), (422, InvalidIdentifier)],
    )
    async def test_client_error_message_omits_identifier(
        self,
        client: ResendClient,
        respx_mock: respx.MockRouter,
        status_code: int,
        exception_class: type[ResendClientError],
    ) -> None:
        respx_mock.get(path=f"/contacts/{EMAIL}").respond(status_code)

        with pytest.raises(exception_class) as exc:
            await client.get_contact(EMAIL)

        assert EMAIL not in str(exc.value)


@pytest.mark.asyncio
class TestDeleteContact:
    async def test_not_found(
        self, client: ResendClient, respx_mock: respx.MockRouter
    ) -> None:
        delete = respx_mock.delete(path="/contacts/contact-id").respond(404)

        await client.delete_contact("contact-id")

        assert delete.called

    async def test_server_error(
        self, client: ResendClient, respx_mock: respx.MockRouter
    ) -> None:
        respx_mock.delete(path="/contacts/contact-id").respond(500)

        with pytest.raises(ResendAPIError) as exc:
            await client.delete_contact("contact-id")

        assert exc.value.path == "/contacts/{contact_id}"
        assert exc.value.response_status_code == 500
