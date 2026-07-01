import typing

import pytest
from pydantic import ValidationError

from polar.kit.schemas import HttpsUrl
from polar.models.webhook_endpoint import WebhookFormat
from polar.webhook.schemas import WebhookEndpointCreate


@pytest.mark.parametrize(
    "url",
    [
        "https://exa\u2014mple.com/hook",  # em dash in hostname
        "https://127.0.0.1/hook",  # localhost IP
    ],
)
def test_invalid_hostname(url: str) -> None:
    with pytest.raises(ValidationError):
        WebhookEndpointCreate(
            url=typing.cast(HttpsUrl, url),
            format=WebhookFormat.raw,
            events=[],
            organization_id=None,
        )


@pytest.mark.parametrize(
    "url",
    [
        "https://münchen.example/hook",  # IDN hostname
    ],
)
def test_valid_hostname(url: str) -> None:
    create = WebhookEndpointCreate(
        url=typing.cast(HttpsUrl, url),
        format=WebhookFormat.raw,
        events=[],
        organization_id=None,
    )
    assert create.url is not None
