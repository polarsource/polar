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


@pytest.mark.parametrize(
    "api_version",
    [
        pytest.param("v1", id="invalid format"),
        pytest.param("1991-06", id="not available version"),
    ],
)
def test_invalid_api_version(api_version: str) -> None:
    with pytest.raises(ValidationError):
        WebhookEndpointCreate.model_validate(
            {
                "url": "https://example.com/hook",
                "format": WebhookFormat.raw,
                "api_version": api_version,
                "events": [],
                "organization_id": None,
            }
        )
