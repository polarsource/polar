import traceback

import pytest
import respx

from polar.integrations.resend.client import ResendAPIError, ResendClient


@pytest.mark.anyio
async def test_get_contact_server_error_excludes_identifier(
    respx_mock: respx.MockRouter,
) -> None:
    email = "user@example.com"
    respx_mock.get(path=f"/contacts/{email}").respond(530)

    with pytest.raises(ResendAPIError) as exc_info:
        await ResendClient().get_contact(email)

    assert (
        str(exc_info.value)
        == "Resend API request GET /contacts/{identifier} failed with status 530"
    )
    assert "example.com" not in "".join(traceback.format_exception(exc_info.value))
