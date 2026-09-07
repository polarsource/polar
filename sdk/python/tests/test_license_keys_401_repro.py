from __future__ import annotations

import httpx
import pytest

from polar.base import PolarClientError
from polar.v2026_04.client import Polar
from polar.v2026_04.errors import Unauthorized

ORG = "00000000-0000-0000-0000-000000000000"
ACT = "11111111-1111-1111-1111-111111111111"


def _unauthorized_response() -> httpx.Response:
    return httpx.Response(
        401,
        json={"error": "Unauthorized", "detail": "Not authenticated"},
    )


@pytest.fixture
def polar(monkeypatch: pytest.MonkeyPatch) -> Polar:
    client = Polar(access_token="polar_oat_xxx", base_url="https://api.polar.sh")
    monkeypatch.setattr(
        client._client, "send_request", lambda request: _unauthorized_response()
    )
    return client


def test_validate_raises_unauthorized(polar: Polar) -> None:
    with pytest.raises(Unauthorized) as exc_info:
        polar.license_keys.validate(key="TEST-KEY", organization_id=ORG)
    assert exc_info.value.status_code == 401
    assert isinstance(exc_info.value, PolarClientError)


def test_activate_raises_unauthorized(polar: Polar) -> None:
    with pytest.raises(Unauthorized) as exc_info:
        polar.license_keys.activate(key="TEST-KEY", organization_id=ORG, label="node-1")
    assert exc_info.value.status_code == 401


def test_deactivate_raises_unauthorized(polar: Polar) -> None:
    with pytest.raises(Unauthorized) as exc_info:
        polar.license_keys.deactivate(
            key="TEST-KEY", organization_id=ORG, activation_id=ACT
        )
    assert exc_info.value.status_code == 401
