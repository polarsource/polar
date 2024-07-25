import base64
import json
from enum import StrEnum
from typing import Literal, Protocol, TypedDict

from cryptography.exceptions import InvalidSignature as CryptographyInvalidSignature
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.asymmetric import ec
from cryptography.hazmat.primitives.serialization import load_pem_public_key

from polar.exceptions import PolarError
from polar.personal_access_token.service import (
    personal_access_token as personal_access_token_service,
)
from polar.postgres import AsyncSession

from ..client import get_app_client


class GitHubSecretScanningPublicKey(TypedDict):
    key_identifier: str
    key: str
    is_current: bool


class GitHubSecretScanningPublicKeyList(TypedDict):
    public_keys: list[GitHubSecretScanningPublicKey]


class TokenType(StrEnum):
    client_secret = "client_secret"
    client_registration_token = "client_registration_token"
    authorization_code = "authorization_code"
    access_token = "access_token"
    refresh_token = "refresh_token"
    personal_access_token = "personal_access_token"


class GitHubSecretScanningToken(TypedDict):
    token: str
    type: TokenType
    url: str | None
    source: str


class GitHubSecretScanningTokenResult(TypedDict):
    token_raw: str
    token_type: TokenType
    label: Literal["true_positive", "false_positive"]


class RevokedLeakedProtocol(Protocol):
    async def revoke_leaked(self, session: AsyncSession, token: str) -> bool: ...


TOKEN_TYPE_SERVICE_MAP: dict[TokenType, RevokedLeakedProtocol] = {
    TokenType.personal_access_token: personal_access_token_service,
}


class GitHubSecretScanningError(PolarError): ...


class PublicKeyNotFound(GitHubSecretScanningError):
    def __init__(self, key_identifier: str) -> None:
        self.key_identifier = key_identifier
        message = f"Public key with key_identifier {key_identifier} not found."
        super().__init__(message)


class InvalidPublicKey(GitHubSecretScanningError):
    def __init__(self, key_identifier: str, public_key: str) -> None:
        self.key_identifier = key_identifier
        self.public_key = public_key
        message = f"Public key with key_identifier {key_identifier} is invalid."
        super().__init__(message)


class InvalidSignature(GitHubSecretScanningError):
    def __init__(self, payload: str, signature: str, key_identifier: str) -> None:
        self.payload = payload
        self.signature = signature
        self.key_identifier = key_identifier
        message = "Invalid signature."
        super().__init__(message, status_code=403)


class GitHubSecretScanningService:
    async def verify_signature(
        self, payload: str, signature: str, key_identifier: str
    ) -> bool:
        raw_public_key = await self._get_public_key(key_identifier)
        public_key = load_pem_public_key(raw_public_key.encode())
        if not isinstance(public_key, ec.EllipticCurvePublicKey):
            raise InvalidPublicKey(key_identifier, raw_public_key)

        signature_bytes = base64.b64decode(signature)

        try:
            public_key.verify(
                signature_bytes, payload.encode(), ec.ECDSA(hashes.SHA256())
            )
            return True
        except CryptographyInvalidSignature as e:
            raise InvalidSignature(payload, signature, key_identifier) from e

    async def handle_alert(
        self, session: AsyncSession, payload: str
    ) -> list[GitHubSecretScanningTokenResult]:
        data: list[GitHubSecretScanningToken] = json.loads(payload)
        results = []
        for match in data:
            result = await self._check_token(session, match)
            results.append(result)
        return results

    async def _check_token(
        self, session: AsyncSession, match: GitHubSecretScanningToken
    ) -> GitHubSecretScanningTokenResult:
        service = TOKEN_TYPE_SERVICE_MAP[match["type"]]

        leaked = await service.revoke_leaked(session, match["token"])

        return {
            "token_raw": match["token"],
            "token_type": match["type"],
            "label": "true_positive" if leaked else "false_positive",
        }

    async def _get_public_key(self, key_identifier: str) -> str:
        client = get_app_client()
        response = await client.arequest("GET", "/meta/public_keys/secret_scanning")

        data: GitHubSecretScanningPublicKeyList = response.json()
        for public_key in data["public_keys"]:
            if public_key["key_identifier"] == key_identifier:
                return public_key["key"]

        raise PublicKeyNotFound(key_identifier)


secret_scanning = GitHubSecretScanningService()
