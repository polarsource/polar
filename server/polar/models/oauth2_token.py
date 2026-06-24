from typing import TYPE_CHECKING, Any, cast

from authlib.integrations.sqla_oauth2 import OAuth2TokenMixin
from sqlalchemy import String
from sqlalchemy.orm import Mapped, declared_attr, mapped_column, relationship

from polar.auth.scope import Scope, scope_to_set
from polar.kit.db.models import RecordModel
from polar.oauth2.sub_type import SubTypeModelMixin

if TYPE_CHECKING:
    from .oauth2_client import OAuth2Client
    from .oauth2_token_organization import OAuth2TokenOrganization


class OAuth2Token(RecordModel, OAuth2TokenMixin, SubTypeModelMixin):
    __tablename__ = "oauth2_tokens"

    client_id: Mapped[str] = mapped_column(String(52), nullable=False)
    nonce: Mapped[str | None] = mapped_column(String, index=True, nullable=True)

    @declared_attr
    def client(cls) -> "Mapped[OAuth2Client]":
        return relationship(
            "OAuth2Client",
            primaryjoin="foreign(OAuth2Token.client_id) == OAuth2Client.client_id",
            viewonly=True,
            lazy="raise",
        )

    @declared_attr
    def organization_scopes(cls) -> Mapped[list["OAuth2TokenOrganization"]]:
        # Down-scope links (M2M). Eager-loaded so the auth middleware can read
        # the scope on every request without a lazy load. No rows means the
        # token is unrestricted.
        return relationship(
            "OAuth2TokenOrganization",
            lazy="selectin",
            cascade="all, delete-orphan",
        )

    @property
    def expires_at(self) -> int:
        return cast(int, self.issued_at) + cast(int, self.expires_in)

    @property
    def scopes(self) -> set[Scope]:
        return scope_to_set(cast(str, self.get_scope()))

    def get_introspection_data(self, issuer: str) -> dict[str, Any]:
        return {
            "active": not cast(bool, self.is_revoked())
            and not cast(bool, self.is_expired()),
            "client_id": self.client_id,
            "token_type": self.token_type,
            "scope": self.get_scope(),
            "sub_type": self.sub_type,
            "sub": str(self.sub.id),
            "aud": self.client_id,
            "iss": issuer,
            "exp": self.expires_at,
            "iat": self.issued_at,
        }
