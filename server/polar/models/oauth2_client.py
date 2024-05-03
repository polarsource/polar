from typing import TYPE_CHECKING
from uuid import UUID

from authlib.integrations.sqla_oauth2 import OAuth2ClientMixin
from sqlalchemy import ForeignKey, String, UniqueConstraint
from sqlalchemy.orm import Mapped, declared_attr, mapped_column, relationship

from polar.kit.db.models import RecordModel
from polar.kit.extensions.sqlalchemy import PostgresUUID

if TYPE_CHECKING:
    from polar.models import User


class OAuth2Client(RecordModel, OAuth2ClientMixin):
    __tablename__ = "oauth2_clients"
    __table_args__ = (UniqueConstraint("client_id"),)

    registration_access_token: Mapped[str] = mapped_column(
        String, index=True, nullable=False
    )

    user_id: Mapped[UUID] = mapped_column(
        PostgresUUID, ForeignKey("users.id"), nullable=False, index=True
    )

    @declared_attr
    def user(cls) -> "Mapped[User]":
        return relationship("User", lazy="raise")
