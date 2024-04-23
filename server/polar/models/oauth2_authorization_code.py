from uuid import UUID

from authlib.integrations.sqla_oauth2 import OAuth2AuthorizationCodeMixin
from sqlalchemy import ForeignKey, String
from sqlalchemy.orm import Mapped, declared_attr, mapped_column, relationship

from polar.kit.db.models import RecordModel
from polar.kit.extensions.sqlalchemy import PostgresUUID
from polar.models.organization import Organization
from polar.models.user import User
from polar.oauth2.sub_type import SubType


class OAuth2AuthorizationCode(RecordModel, OAuth2AuthorizationCodeMixin):
    __tablename__ = "oauth2_authorization_codes"

    sub_type: Mapped[SubType] = mapped_column(String, nullable=False)
    user_id: Mapped[UUID | None] = mapped_column(
        PostgresUUID,
        ForeignKey("users.id", ondelete="cascade"),
        nullable=True,
        index=True,
    )
    organization_id: Mapped[UUID | None] = mapped_column(
        PostgresUUID,
        ForeignKey("organizations.id", ondelete="cascade"),
        nullable=True,
        index=True,
    )

    @declared_attr
    def user(cls) -> Mapped[User | None]:
        return relationship(User, lazy="joined")

    @declared_attr
    def organization(cls) -> Mapped[Organization | None]:
        return relationship(Organization, lazy="joined")
