from typing import Any, cast
from uuid import UUID

from authlib.integrations.sqla_oauth2 import OAuth2TokenMixin
from sqlalchemy import ForeignKey, String
from sqlalchemy.orm import Mapped, declared_attr, mapped_column, relationship

from polar.authz.scope import Scope, scope_to_list
from polar.kit.db.models import RecordModel
from polar.kit.extensions.sqlalchemy import PostgresUUID
from polar.models.organization import Organization
from polar.models.user import User
from polar.oauth2.sub_type import SubType


class OAuth2Token(RecordModel, OAuth2TokenMixin):
    __tablename__ = "oauth2_tokens"

    sub_type: Mapped[SubType] = mapped_column(String, nullable=False)
    user_id: Mapped[UUID | None] = mapped_column(
        PostgresUUID, ForeignKey("users.id", ondelete="cascade"), nullable=True
    )
    organization_id: Mapped[UUID | None] = mapped_column(
        PostgresUUID, ForeignKey("organizations.id", ondelete="cascade"), nullable=True
    )

    @declared_attr
    def user(cls) -> Mapped[User | None]:
        return relationship(User, lazy="joined")

    @declared_attr
    def organization(cls) -> Mapped[Organization | None]:
        return relationship(Organization, lazy="joined")

    def get_expires_at(self) -> int:
        return cast(int, self.issued_at) + cast(int, self.expires_in)

    def get_scopes(self) -> list[Scope]:
        return scope_to_list(cast(str, self.get_scope()))

    def get_sub(self) -> str:
        if self.sub_type == SubType.user:
            return str(self.user_id)
        elif self.sub_type == SubType.organization:
            return str(self.organization_id)
        raise NotImplementedError()

    def get_introspection_data(self, issuer: str) -> dict[str, Any]:
        return {
            "active": not cast(bool, self.is_revoked())
            and not cast(bool, self.is_expired()),
            "client_id": self.client_id,
            "token_type": self.token_type,
            "scope": self.get_scope(),
            "sub_type": self.sub_type,
            "sub": self.get_sub(),
            "aud": self.client_id,
            "iss": issuer,
            "exp": self.get_expires_at(),
            "iat": self.issued_at,
        }
