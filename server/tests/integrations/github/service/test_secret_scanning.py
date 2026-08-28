import base64
import json
from collections.abc import Iterator
from typing import Any

import pytest
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import ec
from fastapi.exceptions import RequestValidationError
from pytest_mock import MockerFixture

from polar.config import settings
from polar.integrations.github.service import secret_scanning as secret_scanning_module
from polar.integrations.github.service.secret_scanning import (
    InvalidSignature,
    PublicKeyNotFound,
)
from polar.integrations.github.service.secret_scanning import (
    secret_scanning as secret_scanning_service,
)

private_key = ec.generate_private_key(ec.SECP256R1())
public_key = private_key.public_key()
public_key_pem = public_key.public_bytes(
    encoding=serialization.Encoding.PEM,
    format=serialization.PublicFormat.SubjectPublicKeyInfo,
).decode()


def generate_signature(payload: str, key: ec.EllipticCurvePrivateKey) -> str:
    signature = key.sign(payload.encode(), ec.ECDSA(hashes.SHA256()))
    return base64.b64encode(signature).decode()


@pytest.fixture(autouse=True)
def reset_public_keys_cache() -> Iterator[None]:
    secret_scanning_module._public_keys_cache = None
    yield
    secret_scanning_module._public_keys_cache = None


def _mock_app_client(mocker: MockerFixture, public_keys: list[dict[str, Any]]) -> Any:
    response = mocker.MagicMock()
    response.json.return_value = {"public_keys": public_keys}
    client = mocker.MagicMock()
    client.arequest = mocker.AsyncMock(return_value=response)
    return mocker.patch.object(
        secret_scanning_module, "get_app_client", return_value=client
    )


@pytest.mark.asyncio
class TestGetPublicKey:
    async def test_uses_authenticated_client(self, mocker: MockerFixture) -> None:
        get_app_client_mock = _mock_app_client(
            mocker, [{"key_identifier": "KID", "key": "KEY", "is_current": True}]
        )

        key = await secret_scanning_service._get_public_key("KID")

        assert key == "KEY"
        get_app_client_mock.assert_called_once_with()

    async def test_caches_within_ttl(self, mocker: MockerFixture) -> None:
        get_app_client_mock = _mock_app_client(
            mocker, [{"key_identifier": "KID", "key": "KEY", "is_current": True}]
        )

        await secret_scanning_service._get_public_key("KID")
        await secret_scanning_service._get_public_key("KID")

        get_app_client_mock.assert_called_once()

    async def test_refetches_after_ttl_expires(self, mocker: MockerFixture) -> None:
        get_app_client_mock = _mock_app_client(
            mocker, [{"key_identifier": "KID", "key": "KEY", "is_current": True}]
        )
        mocker.patch.object(
            settings, "GITHUB_SECRET_SCANNING_PUBLIC_KEYS_CACHE_TTL_SECONDS", 10
        )
        mocker.patch(
            "polar.integrations.github.service.secret_scanning.time.monotonic",
            side_effect=[0.0, 100.0, 100.0, 100.0],
        )

        await secret_scanning_service._get_public_key("KID")
        await secret_scanning_service._get_public_key("KID")

        assert get_app_client_mock.call_count == 2

    async def test_refetches_for_unseen_key_identifier(
        self, mocker: MockerFixture
    ) -> None:
        get_app_client_mock = _mock_app_client(
            mocker, [{"key_identifier": "KID", "key": "KEY", "is_current": True}]
        )

        await secret_scanning_service._get_public_key("KID")
        with pytest.raises(PublicKeyNotFound):
            await secret_scanning_service._get_public_key("OTHER")

        assert get_app_client_mock.call_count == 2

    async def test_public_key_not_found(self, mocker: MockerFixture) -> None:
        _mock_app_client(
            mocker, [{"key_identifier": "KID", "key": "KEY", "is_current": True}]
        )

        with pytest.raises(PublicKeyNotFound):
            await secret_scanning_service._get_public_key("MISSING")


@pytest.mark.asyncio
class TestVerifySignature:
    async def test_invalid_signature(self, mocker: MockerFixture) -> None:
        mocker.patch.object(
            secret_scanning_service, "_get_public_key", return_value=public_key_pem
        )

        with pytest.raises(InvalidSignature):
            await secret_scanning_service.verify_signature(
                "payload", "signature", "KID"
            )

    async def test_not_matching_signature(self, mocker: MockerFixture) -> None:
        mocker.patch.object(
            secret_scanning_service, "_get_public_key", return_value=public_key_pem
        )
        payload = "[]"
        signature = generate_signature(payload, private_key)

        with pytest.raises(InvalidSignature):
            await secret_scanning_service.verify_signature(
                "NOT_MATCHING_PAYLOAD", signature, "KID"
            )

    async def test_valid(self, mocker: MockerFixture) -> None:
        mocker.patch.object(
            secret_scanning_service, "_get_public_key", return_value=public_key_pem
        )
        payload = "[]"
        signature = generate_signature(payload, private_key)

        result = await secret_scanning_service.verify_signature(
            payload, signature, "KID"
        )
        assert result is True


@pytest.mark.asyncio
class TestValidatePayload:
    @pytest.mark.parametrize(
        "payload",
        [
            [{"foo": "bar"}],
            [{"token": "TOKEN", "type": "foobar", "source": "github"}],
            [{"token": "TOKEN", "type": None, "source": "github"}],
        ],
    )
    async def test_invalid_payload(self, payload: list[dict[str, Any]]) -> None:
        with pytest.raises(RequestValidationError):
            secret_scanning_service.validate_payload(json.dumps(payload))

    @pytest.mark.parametrize(
        "payload",
        [
            pytest.param(
                [
                    {
                        "token": "TOKEN",
                        "type": "polar_personal_access_token",
                        "source": "github",
                    },
                    {
                        "token": "TOKEN",
                        "type": "polar_client_secret",
                        "source": "github",
                        "url": "https://example.com",
                    },
                ],
                id="basic",
            ),
            pytest.param(
                [
                    {
                        "token": "TOKEN",
                        "type": "POLAR_PERSONAL_ACCESS_TOKEN",
                        "source": "github",
                    }
                ],
                id="uppercase_token_type",
            ),
        ],
    )
    async def test_valid_payload(self, payload: list[dict[str, Any]]) -> None:
        result = secret_scanning_service.validate_payload(json.dumps(payload))

        assert len(result) == len(payload)
