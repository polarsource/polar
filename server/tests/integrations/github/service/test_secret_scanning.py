import base64
import json
from typing import Any

import pytest
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import ec
from fastapi.exceptions import RequestValidationError
from pytest_mock import MockerFixture

from polar.integrations.github.service.secret_scanning import InvalidSignature
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


@pytest.mark.asyncio
@pytest.mark.skip_db_asserts
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
@pytest.mark.skip_db_asserts
class TestValidatePayload:
    @pytest.mark.parametrize(
        "payload",
        (
            [{"foo": "bar"}],
            [{"token": "TOKEN", "type": "polar_access_token", "source": "github"}],
        ),
    )
    async def test_invalid_payload(self, payload: list[dict[str, Any]]) -> None:
        with pytest.raises(RequestValidationError):
            secret_scanning_service.validate_payload(json.dumps(payload))

    async def test_valid_payload(self) -> None:
        payload = [
            {
                "token": "TOKEN",
                "type": "personal_access_token",
                "source": "github",
            },
            {
                "token": "TOKEN",
                "type": "client_secret",
                "source": "github",
                "url": "https://example.com",
            },
        ]
        result = secret_scanning_service.validate_payload(json.dumps(payload))

        assert len(result) == 2
