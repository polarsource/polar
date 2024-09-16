import base64
import binascii
from typing import Literal, Protocol, TypedDict

from cryptography.exceptions import InvalidSignature as CryptographyInvalidSignature
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.asymmetric import ec
from cryptography.hazmat.primitives.serialization import load_pem_public_key
from fastapi.exceptions import RequestValidationError
from pydantic import TypeAdapter, ValidationError

from polar.enums import TokenType
from polar.exceptions import PolarError
from polar.kit.schemas import Schema
from polar.oauth2.service.oauth2_authorization_code import (
    oauth2_authorization_code as oauth2_authorization_code_service,
)
from polar.oauth2.service.oauth2_client import oauth2_client as oauth2_client_service
from polar.oauth2.service.oauth2_token import oauth2_token as oauth2_token_service
from polar.personal_access_token.service import (
    personal_access_token as personal_access_token_service,
)
from polar.postgres import AsyncSession

from ..client import GitHub


class GitHubSecretScanningPublicKey(TypedDict):
    key_identifier: str
    key: str
    is_current: bool


class GitHubSecretScanningPublicKeyList(TypedDict):
    public_keys: list[GitHubSecretScanningPublicKey]


class GitHubSecretScanningToken(Schema):
    token: str
    type: TokenType
    url: str | None = None
    source: str


GitHubSecretScanningTokenListAdapter = TypeAdapter(list[GitHubSecretScanningToken])


class GitHubSecretScanningTokenResult(TypedDict):
    token_raw: str
    token_type: TokenType
    label: Literal["true_positive", "false_positive"]


class RevokedLeakedProtocol(Protocol):
    async def revoke_leaked(
        self,
        session: AsyncSession,
        token: str,
        token_type: TokenType,
        *,
        notifier: str,
        url: str | None,
    ) -> bool: ...


TOKEN_TYPE_SERVICE_MAP: dict[TokenType, RevokedLeakedProtocol] = {
    TokenType.client_secret: oauth2_client_service,
    TokenType.client_registration_token: oauth2_client_service,
    TokenType.authorization_code: oauth2_authorization_code_service,
    TokenType.access_token: oauth2_token_service,
    TokenType.refresh_token: oauth2_token_service,
    TokenType.personal_access_token: personal_access_token_service,
}


class GitHubSecretScanningError(PolarError): ...


class PublicKeyNotFound(GitHubSecretScanningError):
    def __init__(self, key_identifier: str) -> None:
        self.key_identifier = key_identifier
        message = f"Public key with key_identifier {key_identifier} not found."
        super().__init__(message, 400)


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

        try:
            signature_bytes = base64.b64decode(signature)
            public_key.verify(
                signature_bytes, payload.encode(), ec.ECDSA(hashes.SHA256())
            )
            return True
        except (binascii.Error, CryptographyInvalidSignature) as e:
            raise InvalidSignature(payload, signature, key_identifier) from e

    def validate_payload(self, payload: str) -> list[GitHubSecretScanningToken]:
        try:
            return GitHubSecretScanningTokenListAdapter.validate_json(payload)
        except ValidationError as e:
            raise RequestValidationError(e.errors(), body=payload)

    async def handle_alert(
        self, session: AsyncSession, data: list[GitHubSecretScanningToken]
    ) -> list[GitHubSecretScanningTokenResult]:
        results = []
        for match in data:
            result = await self._check_token(session, match)
            results.append(result)
        return results

    async def _check_token(
        self, session: AsyncSession, match: GitHubSecretScanningToken
    ) -> GitHubSecretScanningTokenResult:
        service = TOKEN_TYPE_SERVICE_MAP[match.type]

        leaked = await service.revoke_leaked(
            session, match.token, match.type, notifier="github", url=match.url
        )

        return {
            "token_raw": match.token,
            "token_type": match.type,
            "label": "true_positive" if leaked else "false_positive",
        }

    async def _get_public_key(self, key_identifier: str) -> str:
        client = GitHub()
        response = await client.arequest("GET", "/meta/public_keys/secret_scanning")

        data: GitHubSecretScanningPublicKeyList = response.json()
        for public_key in data["public_keys"]:
            if public_key["key_identifier"] == key_identifier:
                return public_key["key"]

        raise PublicKeyNotFound(key_identifier)


secret_scanning = GitHubSecretScanningService()
