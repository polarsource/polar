from typing import Any
from uuid import UUID

from reauth.crypto import TokenHash
from reauth.factors.oauth2.state import OAuth2State as OAuth2StateDataclass
from sqlalchemy import CHAR, BigInteger, ForeignKey, String, Uuid
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from polar.kit.db.models import RecordModel


class OAuth2State(RecordModel):
    __tablename__ = "oauth2_states"

    state_hash: Mapped[TokenHash] = mapped_column(CHAR(64), nullable=False, unique=True)
    provider: Mapped[str] = mapped_column(String(), nullable=False)
    code_verifier: Mapped[str | None] = mapped_column(String(), nullable=True)
    nonce: Mapped[str | None] = mapped_column(String(), nullable=True)
    redirect_uri: Mapped[str] = mapped_column(String(), nullable=False)
    scope: Mapped[list[str]] = mapped_column(JSONB, nullable=False)
    expires_at: Mapped[int] = mapped_column(BigInteger, nullable=False)
    context: Mapped[dict[str, Any]] = mapped_column(JSONB, nullable=True)

    identity_id: Mapped[UUID | None] = mapped_column(
        Uuid, ForeignKey("users.id", ondelete="cascade"), nullable=True, index=True
    )

    def to_dataclass(self) -> OAuth2StateDataclass:
        return OAuth2StateDataclass(
            id=self.id,
            state_hash=self.state_hash,
            provider=self.provider,
            code_verifier=self.code_verifier,
            nonce=self.nonce,
            redirect_uri=self.redirect_uri,
            scope=self.scope,
            expires_at=self.expires_at,
            identity_id=self.identity_id,
            context=self.context,
        )
