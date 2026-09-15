"""Signing for the JWS the platform issues: OAuth2 id_tokens and the SSO client
assertion.

A signer names the key it signs with and produces the signature over an
assembled JWS signing input. :class:`KMSSigner` calls KMS, so the private key
never enters the process; :class:`LocalSigner` signs in process from the
configured key set, so local development and CI need no cloud access.

See ADR-0010:
``handbook/engineering/decisions/0010-jwks-signing-keys-in-kms.mdx``.
"""

import functools
from typing import Any, Protocol

from authlib.jose import JsonWebKey, KeySet
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import padding

from polar.config import settings

ALGORITHM = "RS256"
KMS_SIGNING_ALGORITHM = "RSASSA_PKCS1_V1_5_SHA_256"


class Signer(Protocol):
    """Signs a JWS and publishes the public half of the key it used.

    ``kid``, ``algorithm`` and ``sign`` are also reauth's ``Signer`` protocol,
    so the same instance authenticates the SSO client. They are plain
    attributes there, so keep them assigned rather than computed.
    """

    kid: str
    algorithm: str

    def sign(self, signing_input: bytes) -> bytes: ...

    def public_jwk(self) -> dict[str, Any]: ...


class KMSSigner:
    """Signs through KMS, which never releases the private key."""

    def __init__(self, key_id: str) -> None:
        self.algorithm = ALGORITHM
        # The key id alone: the ARN would carry the account id into a public
        # document.
        self.kid = key_id.rsplit("/", 1)[-1]
        self._key_id = key_id
        self._public_jwk: dict[str, Any] | None = None

    @functools.cached_property
    def _client(self) -> Any:
        import boto3
        from botocore.config import Config

        # Bound the blocking call: signing runs on the event loop, so a slow or
        # throttled KMS must fail fast rather than stall it.
        return boto3.client(
            "kms",
            region_name=settings.AWS_REGION,
            config=Config(
                connect_timeout=3,
                read_timeout=5,
                retries={"max_attempts": 3, "mode": "standard"},
            ),
        )

    def sign(self, signing_input: bytes) -> bytes:
        response = self._client.sign(
            KeyId=self._key_id,
            Message=signing_input,
            MessageType="RAW",
            SigningAlgorithm=KMS_SIGNING_ALGORITHM,
        )
        return response["Signature"]

    def public_jwk(self) -> dict[str, Any]:
        if self._public_jwk is None:
            public_key = serialization.load_der_public_key(
                self._client.get_public_key(KeyId=self._key_id)["PublicKey"]
            )
            pem = public_key.public_bytes(
                serialization.Encoding.PEM,
                serialization.PublicFormat.SubjectPublicKeyInfo,
            )
            self._public_jwk = JsonWebKey.import_key(
                pem, {"kid": self.kid, "use": "sig", "alg": self.algorithm}
            ).as_dict()
        return self._public_jwk


class LocalSigner:
    """Signs in process with a key from the configured set."""

    def __init__(self, jwks: KeySet, kid: str) -> None:
        self.algorithm = ALGORITHM
        self.kid = kid
        self._key = jwks.find_by_kid(kid)

    def sign(self, signing_input: bytes) -> bytes:
        return self._key.get_private_key().sign(
            signing_input, padding.PKCS1v15(), hashes.SHA256()
        )

    def public_jwk(self) -> dict[str, Any]:
        return self._key.as_dict(is_private=False)


@functools.cache
def _kms_signer(key_id: str) -> KMSSigner:
    return KMSSigner(key_id)


@functools.cache
def _local_signer(kid: str) -> LocalSigner:
    return LocalSigner(settings.JWKS, kid)


def get_signer() -> Signer:
    """Reads the current key on every call, so moving it applies without a
    restart. Each signer is cached per key, so the KMS client and the fetched
    public key are built once."""
    if settings.is_production() or settings.is_sandbox():
        key_id = settings.AWS_JWKS_KMS_KEY_ID
        if key_id is None:
            raise RuntimeError(
                "POLAR_AWS_JWKS_KMS_KEY_ID is required in this environment"
            )
        return _kms_signer(key_id)
    return _local_signer(settings.CURRENT_JWK_KID)
