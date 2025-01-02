from authlib.integrations.sqla_oauth2 import (
    OAuth2AuthorizationCodeMixin,
)
from sqlalchemy import String
from sqlalchemy.orm import Mapped, mapped_column

from polar.kit.db.models import RecordModel
from polar.oauth2.sub_type import SubTypeModelMixin


class OAuth2AuthorizationCode(
    RecordModel, SubTypeModelMixin, OAuth2AuthorizationCodeMixin
):
    __tablename__ = "oauth2_authorization_codes"

    client_id: Mapped[str] = mapped_column(String(52), nullable=False)
