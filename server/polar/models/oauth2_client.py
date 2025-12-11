from typing import TYPE_CHECKING
from uuid import UUID

from authlib.integrations.sqla_oauth2 import OAuth2ClientMixin
from sqlalchemy import ForeignKey, String, UniqueConstraint, Uuid
from sqlalchemy.orm import Mapped, declared_attr, mapped_column, relationship

from polar.kit.db.models import RateLimitGroupMixin, RecordModel
from polar.oauth2.sub_type import SubType

if TYPE_CHECKING:
    from polar.models import User


class OAuth2Client(RateLimitGroupMixin, RecordModel, OAuth2ClientMixin):
    __tablename__ = "oauth2_clients"
    __table_args__ = (UniqueConstraint("client_id"),)

    client_id: Mapped[str] = mapped_column(String(52), nullable=False)
    client_secret: Mapped[str] = mapped_column(String(52), nullable=False)
    registration_access_token: Mapped[str] = mapped_column(
        String, index=True, nullable=False
    )
    first_party: Mapped[bool] = mapped_column(nullable=False, default=False)

    user_id: Mapped[UUID | None] = mapped_column(
        Uuid, ForeignKey("users.id"), nullable=True, index=True
    )

    @declared_attr
    def user(cls) -> "Mapped[User | None]":
        return relationship("User", lazy="raise")

    @property
    def default_sub_type(self) -> SubType:
        try:
            return SubType(self.client_metadata["default_sub_type"])
        except KeyError:
            return SubType.organization
