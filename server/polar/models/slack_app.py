from datetime import datetime
from uuid import UUID

from sqlalchemy import TIMESTAMP, ForeignKey, String, Uuid
from sqlalchemy.dialects.postgresql import ARRAY
from sqlalchemy.orm import Mapped, declared_attr, mapped_column, relationship

from polar.kit.db.models.base import RecordModel
from polar.kit.encryption import EncryptedString, EncryptedStringType

from .organization import Organization

SLACK_APP_CLIENT_SECRET_CONTEXT = {
    "table": "slack_apps",
    "column": "client_secret",
}
SLACK_APP_SIGNING_SECRET_CONTEXT = {
    "table": "slack_apps",
    "column": "signing_secret",
}
SLACK_APP_BOT_TOKEN_CONTEXT = {
    "table": "slack_apps",
    "column": "bot_token",
}


class SlackApp(RecordModel):
    __tablename__ = "slack_apps"

    organization_id: Mapped[UUID] = mapped_column(
        Uuid,
        ForeignKey("organizations.id", ondelete="cascade"),
        nullable=False,
        index=True,
    )

    display_name: Mapped[str] = mapped_column(String(35), nullable=False)
    slack_app_id: Mapped[str | None] = mapped_column(
        String(32), nullable=True, unique=True, default=None
    )
    client_id: Mapped[str | None] = mapped_column(
        String(255), nullable=True, default=None
    )
    client_secret: Mapped[str | None] = mapped_column(
        String(255), nullable=True, default=None
    )
    client_secret_encrypted: Mapped[EncryptedString | None] = mapped_column(
        EncryptedStringType(SLACK_APP_CLIENT_SECRET_CONTEXT),
        nullable=True,
        default=None,
    )
    signing_secret: Mapped[str | None] = mapped_column(
        String(255), nullable=True, default=None
    )
    signing_secret_encrypted: Mapped[EncryptedString | None] = mapped_column(
        EncryptedStringType(SLACK_APP_SIGNING_SECRET_CONTEXT),
        nullable=True,
        default=None,
    )

    team_id: Mapped[str | None] = mapped_column(
        String(32), nullable=True, default=None, index=True
    )
    team_name: Mapped[str | None] = mapped_column(
        String(255), nullable=True, default=None
    )
    bot_user_id: Mapped[str | None] = mapped_column(
        String(32), nullable=True, default=None
    )
    bot_token: Mapped[str | None] = mapped_column(
        String(255), nullable=True, default=None
    )
    bot_token_encrypted: Mapped[EncryptedString | None] = mapped_column(
        EncryptedStringType(SLACK_APP_BOT_TOKEN_CONTEXT),
        nullable=True,
        default=None,
    )
    authed_user_id: Mapped[str | None] = mapped_column(
        String(32), nullable=True, default=None
    )
    scopes: Mapped[list[str] | None] = mapped_column(
        ARRAY(String), nullable=True, default=None
    )
    installed_at: Mapped[datetime | None] = mapped_column(
        TIMESTAMP(timezone=True), nullable=True, default=None
    )
    revoked_at: Mapped[datetime | None] = mapped_column(
        TIMESTAMP(timezone=True), nullable=True, default=None
    )

    @declared_attr
    def organization(cls) -> Mapped["Organization"]:
        return relationship(Organization, lazy="raise")

    async def get_client_secret(self) -> str | None:
        if self.client_secret_encrypted is not None:
            return await self.client_secret_encrypted.decrypt(id=str(self.id))
        return self.client_secret

    async def get_signing_secret(self) -> str | None:
        if self.signing_secret_encrypted is not None:
            return await self.signing_secret_encrypted.decrypt(id=str(self.id))
        return self.signing_secret

    async def get_bot_token(self) -> str | None:
        if self.bot_token_encrypted is not None:
            return await self.bot_token_encrypted.decrypt(id=str(self.id))
        return self.bot_token

    @classmethod
    async def encrypt_client_secret(
        cls, id: UUID, client_secret: str | None
    ) -> EncryptedString | None:
        if client_secret is None:
            return None
        return await EncryptedString.encrypt(
            client_secret,
            context={**SLACK_APP_CLIENT_SECRET_CONTEXT, "id": str(id)},
        )

    @classmethod
    async def encrypt_signing_secret(
        cls, id: UUID, signing_secret: str | None
    ) -> EncryptedString | None:
        if signing_secret is None:
            return None
        return await EncryptedString.encrypt(
            signing_secret,
            context={**SLACK_APP_SIGNING_SECRET_CONTEXT, "id": str(id)},
        )

    @classmethod
    async def encrypt_bot_token(
        cls, id: UUID, bot_token: str | None
    ) -> EncryptedString | None:
        if bot_token is None:
            return None
        return await EncryptedString.encrypt(
            bot_token,
            context={**SLACK_APP_BOT_TOKEN_CONTEXT, "id": str(id)},
        )
