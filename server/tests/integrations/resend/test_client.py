import traceback
from unittest.mock import Mock

import httpx2
import pytest

from polar.integrations.resend.client import ResendAPIError, ResendClient


@pytest.mark.anyio
async def test_get_contact_server_error_excludes_identifier(
    http_mocks: dict[tuple[str, str], Mock],
) -> None:
    email = "user@example.com"
    http_mocks["GET", f"https://api.resend.com/contacts/{email}"] = Mock(
        return_value=httpx2.Response(530)
    )

    with pytest.raises(ResendAPIError) as exc_info:
        await ResendClient().get_contact(email)

    assert (
        str(exc_info.value)
        == "Resend API request GET /contacts/{identifier} failed with status 530"
    )
    assert "example.com" not in "".join(traceback.format_exception(exc_info.value))
