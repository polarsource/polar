from typing import TYPE_CHECKING
from uuid import UUID

from authlib.integrations.sqla_oauth2 import OAuth2ClientMixin
from sqlalchemy import ForeignKey, String, UniqueConstraint, Uuid
from sqlalchemy.orm import Mapped, declared_attr, mapped_column, relationship

from polar.config import settings
from polar.kit.crypto import get_token_hash
from polar.kit.db.models import RateLimitGroupMixin, RecordModel
from polar.kit.encryption import EncryptedString, EncryptedStringType
from polar.oauth2.sub_type import SubType

if TYPE_CHECKING:
    from polar.models import User

OAUTH2_CLIENT_SECRET_CONTEXT = {
    "table": "oauth2_clients",
    "column": "client_secret",
}
OAUTH2_CLIENT_REGISTRATION_ACCESS_TOKEN_CONTEXT = {
    "table": "oauth2_clients",
    "column": "registration_access_token",
}


class OAuth2Client(RateLimitGroupMixin, RecordModel, OAuth2ClientMixin):
    __tablename__ = "oauth2_clients"
    __table_args__ = (UniqueConstraint("client_id"),)

    client_id: Mapped[str] = mapped_column(String(52), nullable=False)
    client_secret: Mapped[str] = mapped_column(String(52), nullable=False)
    # HMAC for synchronous verification and value lookup; the encrypted
    # column reveals the plaintext. See the secrets-encryption design doc.
    client_secret_hash: Mapped[str | None] = mapped_column(
        String(64), nullable=True, default=None, index=True
    )
    client_secret_encrypted: Mapped[EncryptedString | None] = mapped_column(
        EncryptedStringType(OAUTH2_CLIENT_SECRET_CONTEXT),
        nullable=True,
        default=None,
    )
    registration_access_token: Mapped[str] = mapped_column(
        String, index=True, nullable=False
    )
    registration_access_token_hash: Mapped[str | None] = mapped_column(
        String(64), nullable=True, default=None, index=True
    )
    registration_access_token_encrypted: Mapped[EncryptedString | None] = mapped_column(
        EncryptedStringType(OAUTH2_CLIENT_REGISTRATION_ACCESS_TOKEN_CONTEXT),
        nullable=True,
        default=None,
    )
    first_party: Mapped[bool] = mapped_column(nullable=False, default=False)

    user_id: Mapped[UUID | None] = mapped_column(
        Uuid, ForeignKey("users.id"), nullable=True, index=True
    )

    @declared_attr
    def user(cls) -> "Mapped[User | None]":
        return relationship("User", lazy="raise")

    @property
    def default_sub_type(self) -> SubType:
        try:
            return SubType(self.client_metadata["default_sub_type"])
        except KeyError:
            return SubType.user

    @staticmethod
    def hash_secret(value: str | None) -> str | None:
        if value is None:
            return None
        return get_token_hash(value, secret=settings.SECRET)

    @classmethod
    async def encrypt_client_secret(
        cls, id: UUID, client_secret: str | None
    ) -> EncryptedString | None:
        if client_secret is None:
            return None
        return await EncryptedString.encrypt(
            client_secret,
            context={**OAUTH2_CLIENT_SECRET_CONTEXT, "id": str(id)},
        )

    @classmethod
    async def encrypt_registration_access_token(
        cls, id: UUID, registration_access_token: str | None
    ) -> EncryptedString | None:
        if registration_access_token is None:
            return None
        return await EncryptedString.encrypt(
            registration_access_token,
            context={
                **OAUTH2_CLIENT_REGISTRATION_ACCESS_TOKEN_CONTEXT,
                "id": str(id),
            },
        )

    @classmethod
    def encrypt_client_secret_sync(
        cls, id: UUID, client_secret: str | None
    ) -> EncryptedString | None:
        if client_secret is None:
            return None
        return EncryptedString.encrypt_sync(
            client_secret,
            context={**OAUTH2_CLIENT_SECRET_CONTEXT, "id": str(id)},
        )

    @classmethod
    def encrypt_registration_access_token_sync(
        cls, id: UUID, registration_access_token: str | None
    ) -> EncryptedString | None:
        if registration_access_token is None:
            return None
        return EncryptedString.encrypt_sync(
            registration_access_token,
            context={
                **OAUTH2_CLIENT_REGISTRATION_ACCESS_TOKEN_CONTEXT,
                "id": str(id),
            },
        )

    async def set_client_secret(self, client_secret: str) -> None:
        if self.id is None:
            self.id = self.generate_id()
        self.client_secret = client_secret  # pyright: ignore
        self.client_secret_hash = self.hash_secret(client_secret)
        self.client_secret_encrypted = await self.encrypt_client_secret(
            self.id, client_secret
        )

    async def set_registration_access_token(
        self, registration_access_token: str
    ) -> None:
        if self.id is None:
            self.id = self.generate_id()
        self.registration_access_token = registration_access_token
        self.registration_access_token_hash = self.hash_secret(
            registration_access_token
        )
        self.registration_access_token_encrypted = (
            await self.encrypt_registration_access_token(
                self.id, registration_access_token
            )
        )

    def set_client_secret_sync(self, client_secret: str) -> None:
        if self.id is None:
            self.id = self.generate_id()
        self.client_secret = client_secret  # pyright: ignore
        self.client_secret_hash = self.hash_secret(client_secret)
        self.client_secret_encrypted = self.encrypt_client_secret_sync(
            self.id, client_secret
        )

    def set_registration_access_token_sync(
        self, registration_access_token: str
    ) -> None:
        if self.id is None:
            self.id = self.generate_id()
        self.registration_access_token = registration_access_token
        self.registration_access_token_hash = self.hash_secret(
            registration_access_token
        )
        self.registration_access_token_encrypted = (
            self.encrypt_registration_access_token_sync(
                self.id, registration_access_token
            )
        )
