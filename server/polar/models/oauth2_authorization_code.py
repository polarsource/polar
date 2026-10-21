from typing import TYPE_CHECKING

from authlib.integrations.sqla_oauth2 import (
    OAuth2AuthorizationCodeMixin,
)
from sqlalchemy import String
from sqlalchemy.orm import Mapped, declared_attr, mapped_column, relationship

from polar.kit.db.models import RecordModel
from polar.oauth2.sub_type import SubTypeModelMixin

if TYPE_CHECKING:
    from .oauth2_authorization_code_organization import (
        OAuth2AuthorizationCodeOrganization,
    )


class OAuth2AuthorizationCode(
    RecordModel, SubTypeModelMixin, OAuth2AuthorizationCodeMixin
):
    __tablename__ = "oauth2_authorization_codes"

    client_id: Mapped[str] = mapped_column(String(52), nullable=False)

    @declared_attr
    def organization_scopes(
        cls,
    ) -> Mapped[list["OAuth2AuthorizationCodeOrganization"]]:
        # Down-scope links (M2M), carrying the consent-time organization
        # selection across the code-to-token exchange. No rows means
        # unrestricted.
        return relationship(
            "OAuth2AuthorizationCodeOrganization",
            lazy="selectin",
            cascade="all, delete-orphan",
        )
