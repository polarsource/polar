import asyncio
import base64
import binascii
import time
from typing import Annotated, Any, Literal, Protocol, TypedDict

from cryptography.exceptions import InvalidSignature as CryptographyInvalidSignature
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.asymmetric import ec
from cryptography.hazmat.primitives.serialization import load_pem_public_key
from fastapi.exceptions import RequestValidationError
from pydantic import BeforeValidator, TypeAdapter, ValidationError

from polar.auth.service import auth as auth_service
from polar.config import settings
from polar.customer_session.service import customer_session as customer_session_service
from polar.enums import TokenType
from polar.exceptions import PolarError
from polar.kit.schemas import Schema
from polar.oauth2.service.oauth2_authorization_code import (
    oauth2_authorization_code as oauth2_authorization_code_service,
)
from polar.oauth2.service.oauth2_client import oauth2_client as oauth2_client_service
from polar.oauth2.service.oauth2_token import oauth2_token as oauth2_token_service
from polar.organization_access_token.service import (
    organization_access_token as organization_access_token_service,
)
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


def _normalize_token_type(value: Any | None) -> Any | None:
    if isinstance(value, str):
        return value.lower()
    return value


class GitHubSecretScanningToken(Schema):
    token: str
    type: Annotated[TokenType, BeforeValidator(_normalize_token_type)]
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
    TokenType.organization_access_token: organization_access_token_service,
    TokenType.customer_session_token: customer_session_service,
    TokenType.user_session_token: auth_service,
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


# GitHub rotates the secret scanning public keys rarely, so the fetched list is
# cached in-process to avoid an authenticated API call on every webhook delivery.
# (timestamp, {key_identifier: key})
_public_keys_cache: tuple[float, dict[str, str]] | None = None
_public_keys_cache_lock = asyncio.Lock()


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
        cached_key = self._lookup_cached_key(key_identifier)
        if cached_key is not None:
            return cached_key

        async with _public_keys_cache_lock:
            # Double-checked: another coroutine may have refreshed while we waited.
            cached_key = self._lookup_cached_key(key_identifier)
            if cached_key is not None:
                return cached_key

            public_keys = await self._fetch_public_keys()
            global _public_keys_cache
            _public_keys_cache = (time.monotonic(), public_keys)

        try:
            return public_keys[key_identifier]
        except KeyError as e:
            raise PublicKeyNotFound(key_identifier) from e

    def _lookup_cached_key(self, key_identifier: str) -> str | None:
        cached = _public_keys_cache
        if cached is None:
            return None
        timestamp, public_keys = cached
        ttl = settings.GITHUB_SECRET_SCANNING_PUBLIC_KEYS_CACHE_TTL_SECONDS
        if time.monotonic() - timestamp >= ttl:
            return None
        # A missing key triggers a refresh: GitHub may have rotated in a new one.
        return public_keys.get(key_identifier)

    async def _fetch_public_keys(self) -> dict[str, str]:
        client = get_app_client()
        response = await client.arequest("GET", "/meta/public_keys/secret_scanning")

        data: GitHubSecretScanningPublicKeyList = response.json()
        return {
            public_key["key_identifier"]: public_key["key"]
            for public_key in data["public_keys"]
        }


secret_scanning = GitHubSecretScanningService()
