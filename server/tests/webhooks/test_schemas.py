import typing

import pytest
from pydantic import ValidationError

from polar.kit.schemas import HttpsUrl
from polar.kit.versioning import api_version_context
from polar.models.webhook_endpoint import WebhookFormat
from polar.version import V2026_04, V2026_10
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


@pytest.mark.parametrize(
    ("active_version", "api_version", "valid"),
    [
        pytest.param(V2026_04, "2026-04", True, id="active version"),
        pytest.param(V2026_04, "2026-10", False, id="newer than active version"),
        pytest.param(V2026_10, "2026-04", True, id="older than active version"),
    ],
)
def test_api_version_bounded_by_active_version(
    active_version: typing.Any, api_version: str, valid: bool
) -> None:
    payload = {
        "url": "https://example.com/hook",
        "format": WebhookFormat.raw,
        "api_version": api_version,
        "events": [],
        "organization_id": None,
    }
    with api_version_context(active_version):
        if valid:
            WebhookEndpointCreate.model_validate(payload)
        else:
            with pytest.raises(ValidationError):
                WebhookEndpointCreate.model_validate(payload)
