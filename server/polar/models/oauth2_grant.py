from uuid import UUID

from sqlalchemy import ForeignKey, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, declared_attr, mapped_column, relationship

from polar.kit.db.models import RecordModel
from polar.kit.extensions.sqlalchemy import PostgresUUID
from polar.models.user import User


class OAuth2Grant(RecordModel):
    __tablename__ = "oauth2_grants"
    __table_args__ = (UniqueConstraint("client_id", "user_id"),)

    client_id: Mapped[str] = mapped_column(String(48), nullable=False, index=True)
    scope: Mapped[str] = mapped_column(Text, default="", nullable=False)

    user_id: Mapped[UUID] = mapped_column(
        PostgresUUID,
        ForeignKey("users.id", ondelete="cascade"),
        nullable=False,
        index=True,
    )

    @declared_attr
    def user(cls) -> Mapped[User]:
        return relationship(User, lazy="joined")

    @property
    def scopes(self) -> list[str]:
        return self.scope.strip().split()
