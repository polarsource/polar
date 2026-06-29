"""Envelope encryption for secrets stored at rest.

Each secret is stored as ciphertext wrapped in an :class:`EncryptedString`. The
column is mapped with a wrap-only :class:`EncryptedStringType` that does no
crypto and no I/O: on load it boxes the stored ciphertext into an
:class:`EncryptedString`; on save it unboxes it. Encryption and decryption are
explicit ``await`` calls that go through a :class:`KeyProvider` chosen by config.

See the design document for the full rationale:
``handbook/engineering/design-documents/secrets-encryption.mdx``.
"""

import asyncio
import base64
import functools
import hashlib
import json
import os
from typing import Any, Protocol

import sqlalchemy as sa
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from sqlalchemy.engine.interfaces import Dialect

from polar.config import settings
from polar.kit.extensions.sqlalchemy.types import TypeDecorator

VERSION = "v1"
NONCE_SIZE = 12
DATA_KEY_SIZE = 32


def _encode_context(context: dict[str, str]) -> bytes:
    return json.dumps(context, sort_keys=True, separators=(",", ":")).encode("utf-8")


def _b64encode(value: bytes) -> str:
    return base64.b64encode(value).decode("ascii")


def _b64decode(value: str) -> bytes:
    return base64.b64decode(value)


class KeyProvider(Protocol):
    """Wraps and unwraps the per-secret data key. The plaintext secret never
    reaches the provider."""

    async def generate_data_key(self, context: dict[str, str]) -> tuple[bytes, bytes]:
        """Return a fresh ``(plaintext_data_key, wrapped_data_key)`` pair."""
        ...

    async def decrypt_data_key(self, wrapped: bytes, context: dict[str, str]) -> bytes:
        """Unwrap a previously wrapped data key."""
        ...


class LocalKeyProvider:
    """Wraps the data key with a static key. Used for local development and CI,
    so tests need no cloud access."""

    def __init__(self, key: str) -> None:
        self._key = AESGCM(hashlib.sha256(key.encode("utf-8")).digest())

    async def generate_data_key(self, context: dict[str, str]) -> tuple[bytes, bytes]:
        data_key = os.urandom(DATA_KEY_SIZE)
        nonce = os.urandom(NONCE_SIZE)
        wrapped = nonce + self._key.encrypt(nonce, data_key, _encode_context(context))
        return data_key, wrapped

    async def decrypt_data_key(self, wrapped: bytes, context: dict[str, str]) -> bytes:
        nonce, ciphertext = wrapped[:NONCE_SIZE], wrapped[NONCE_SIZE:]
        return self._key.decrypt(nonce, ciphertext, _encode_context(context))


class KMSKeyProvider:
    """Wraps the data key with a KMS master key. Used in production and sandbox."""

    def __init__(self, key_id: str) -> None:
        self._key_id = key_id

    @functools.cached_property
    def _client(self) -> Any:
        import boto3

        return boto3.client(
            "kms",
            region_name=settings.AWS_REGION,
            aws_access_key_id=settings.AWS_ACCESS_KEY_ID,
            aws_secret_access_key=settings.AWS_SECRET_ACCESS_KEY,
        )

    async def generate_data_key(self, context: dict[str, str]) -> tuple[bytes, bytes]:
        response = await asyncio.to_thread(
            self._client.generate_data_key,
            KeyId=self._key_id,
            KeySpec="AES_256",
            EncryptionContext=context,
        )
        return response["Plaintext"], response["CiphertextBlob"]

    async def decrypt_data_key(self, wrapped: bytes, context: dict[str, str]) -> bytes:
        response = await asyncio.to_thread(
            self._client.decrypt, CiphertextBlob=wrapped, EncryptionContext=context
        )
        return response["Plaintext"]


@functools.cache
def get_key_provider() -> KeyProvider:
    if settings.is_production() or settings.is_sandbox():
        key_id = settings.AWS_KMS_KEY_ID
        if key_id is None:
            raise RuntimeError("POLAR_AWS_KMS_KEY_ID is required in this environment")
        return KMSKeyProvider(key_id)
    return LocalKeyProvider(settings.ENCRYPTION_LOCAL_KEY)


class EncryptedString:
    """Holds the ciphertext of a secret and owns the only paths that touch the
    key provider. Immutable: any new value is a fresh instance, so ORM change
    tracking works without ``sqlalchemy.ext.mutable``."""

    __slots__ = ("context", "encrypted_value")

    def __init__(self, encrypted_value: str, context: dict[str, str]) -> None:
        self.encrypted_value = encrypted_value
        self.context = dict(context)

    @classmethod
    async def encrypt(
        cls, plaintext: str, *, context: dict[str, str]
    ) -> "EncryptedString":
        provider = get_key_provider()
        data_key, wrapped = await provider.generate_data_key(context)
        nonce = os.urandom(NONCE_SIZE)
        ciphertext = AESGCM(data_key).encrypt(
            nonce, plaintext.encode("utf-8"), _encode_context(context)
        )
        encoded = ".".join(
            (VERSION, _b64encode(wrapped), _b64encode(nonce), _b64encode(ciphertext))
        )
        return cls(encoded, context)

    async def decrypt(self, *, id: str | None = None) -> str:
        context = {**self.context, "id": id} if id is not None else self.context
        version, wrapped, nonce, ciphertext = self.encrypted_value.split(".")
        if version != VERSION:
            raise ValueError(f"Unsupported encryption version: {version}")
        provider = get_key_provider()
        data_key = await provider.decrypt_data_key(_b64decode(wrapped), context)
        plaintext = AESGCM(data_key).decrypt(
            _b64decode(nonce), _b64decode(ciphertext), _encode_context(context)
        )
        return plaintext.decode("utf-8")

    def __repr__(self) -> str:
        return f'{self.__class__.__name__}("***", {self.context!r})'

    def __str__(self) -> str:
        return "<encrypted>"


class EncryptedStringType(TypeDecorator):
    """Wrap-only column type: no crypto, no I/O. Boxes the stored ciphertext
    into an :class:`EncryptedString` on load and unboxes it on save."""

    impl = sa.Text
    cache_ok = True

    def __init__(self, context: dict[str, str]) -> None:
        super().__init__()
        self.context = tuple(sorted(context.items()))

    def process_bind_param(
        self, value: EncryptedString | None, dialect: Dialect
    ) -> str | None:
        if value is None:
            return None
        if isinstance(value, EncryptedString):
            return value.encrypted_value
        raise ValueError("encrypt the value before assigning it")

    def process_result_value(
        self, value: str | None, dialect: Dialect
    ) -> EncryptedString | None:
        if value is None:
            return None
        return EncryptedString(value, dict(self.context))
