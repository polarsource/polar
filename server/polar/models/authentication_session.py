from typing import Any
from uuid import UUID

from reauth.amr import AuthenticationMethodReference
from reauth.authentication_session import (
    AuthenticationSession as AuthenticationSessionDataclass,
)
from reauth.crypto import TokenHash
from sqlalchemy import CHAR, BigInteger, ForeignKey, SmallInteger, Uuid
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from polar.kit.db.models import RecordModel


class AuthenticationSession(RecordModel):
    __tablename__ = "authentication_sessions"

    token_hash: Mapped[TokenHash] = mapped_column(CHAR(64), nullable=False, unique=True)
    expires_at: Mapped[int] = mapped_column(BigInteger, nullable=False)
    step: Mapped[int] = mapped_column(SmallInteger(), nullable=False)
    authentication_method_references: Mapped[list[AuthenticationMethodReference]] = (
        mapped_column(JSONB, nullable=False)
    )
    used_factors: Mapped[list[str]] = mapped_column(JSONB, nullable=False)
    context: Mapped[dict[str, Any]] = mapped_column(JSONB, nullable=True)
    identity_id: Mapped[UUID | None] = mapped_column(
        Uuid, ForeignKey("users.id", ondelete="cascade"), nullable=True, index=True
    )

    def to_dataclass(self) -> AuthenticationSessionDataclass:
        return AuthenticationSessionDataclass(
            id=self.id,
            token_hash=self.token_hash,
            expires_at=self.expires_at,
            identity_id=self.identity_id,
            step=self.step,
            amr=self.authentication_method_references,
            used_factors=self.used_factors,
            context=self.context,
        )
