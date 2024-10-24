from datetime import datetime
from uuid import UUID

from sqlalchemy import TIMESTAMP, ForeignKey, String, Text, Uuid
from sqlalchemy.orm import Mapped, declared_attr, mapped_column, relationship

from polar.auth.scope import Scope, scope_to_set
from polar.kit.db.models.base import RecordModel
from polar.models.user import User


class PersonalAccessToken(RecordModel):
    __tablename__ = "personal_access_tokens"

    token: Mapped[str] = mapped_column(String(255), unique=True, nullable=False)
    scope: Mapped[str] = mapped_column(Text, nullable=False)
    expires_at: Mapped[datetime | None] = mapped_column(
        TIMESTAMP(timezone=True), nullable=True, index=True
    )
    comment: Mapped[str] = mapped_column(String, nullable=False)
    last_used_at: Mapped[datetime | None] = mapped_column(
        TIMESTAMP(timezone=True), nullable=True, default=None
    )

    user_id: Mapped[UUID] = mapped_column(Uuid, ForeignKey("users.id"), nullable=False)

    @declared_attr
    def user(cls) -> Mapped[User]:
        return relationship(User, lazy="raise")

    @property
    def scopes(self) -> set[Scope]:
        return scope_to_set(self.scope)
