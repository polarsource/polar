import typing

import pytest
from pydantic import ValidationError

from polar.kit.schemas import HttpsUrl
from polar.kit.versioning import APIVersion, api_version_context
from polar.models.webhook_endpoint import WebhookFormat
from polar.version import CURRENT_API_VERSION, V2026_04, V2026_10, V2027_01
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
    ("active_version", "expected"),
    [
        pytest.param(None, CURRENT_API_VERSION, id="no active version"),
        pytest.param(V2026_04, V2026_04, id="older version"),
        pytest.param(V2026_10, V2026_10, id="current version"),
        pytest.param(V2027_01, CURRENT_API_VERSION, id="next version"),
    ],
)
def test_default_api_version(
    active_version: APIVersion | None, expected: APIVersion
) -> None:
    payload: dict[str, typing.Any] = {
        "url": "https://example.com/hook",
        "format": WebhookFormat.raw,
        "events": [],
        "organization_id": None,
    }
    if active_version is None:
        create = WebhookEndpointCreate.model_validate(payload)
        json_schema = WebhookEndpointCreate.model_json_schema()
    else:
        with api_version_context(active_version):
            create = WebhookEndpointCreate.model_validate(payload)
            json_schema = WebhookEndpointCreate.model_json_schema()

    assert create.api_version == expected
    api_version_schema = json_schema["properties"]["api_version"]
    assert api_version_schema["default"] == str(expected)
    assert api_version_schema["default"] in api_version_schema["enum"]
