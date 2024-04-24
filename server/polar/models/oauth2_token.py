from typing import Any, cast

from authlib.integrations.sqla_oauth2 import OAuth2TokenMixin

from polar.auth.scope import Scope, scope_to_set
from polar.kit.db.models import RecordModel
from polar.oauth2.sub_type import SubTypeModelMixin


class OAuth2Token(RecordModel, OAuth2TokenMixin, SubTypeModelMixin):
    __tablename__ = "oauth2_tokens"

    def get_expires_at(self) -> int:
        return cast(int, self.issued_at) + cast(int, self.expires_in)

    def get_scopes(self) -> set[Scope]:
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
            "exp": self.get_expires_at(),
            "iat": self.issued_at,
        }
