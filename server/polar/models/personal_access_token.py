from datetime import datetime
from typing import Any
from uuid import UUID

from sqlalchemy import TIMESTAMP, ForeignKey, String
from sqlalchemy.orm import (
    Mapped,
    MappedColumn,
    declared_attr,
    mapped_column,
    relationship,
)

from polar.kit.db.models import RecordModel
from polar.kit.db.models.base import (
    ModelMappedAsDataclass,
    RecordModelMappedAsDataclass,
)
from polar.kit.extensions.sqlalchemy import PostgresUUID
from polar.models.user import User


class PersonalAccessToken(RecordModelMappedAsDataclass, kw_only=True):
    __tablename__ = "personal_access_tokens"

    user_id: Mapped[UUID] = mapped_column(
        PostgresUUID, ForeignKey("users.id"), nullable=False
    )

    expires_at: Mapped[datetime] = mapped_column(
        TIMESTAMP(timezone=True),
        nullable=False,
    )

    comment: Mapped[str] = mapped_column(String, nullable=False)

    last_used_at: Mapped[datetime | None] = mapped_column(
        TIMESTAMP(timezone=True), nullable=True, default=None
    )

    @declared_attr
    def user(cls) -> Mapped[User]:
        # fk: list[Mapped[Any]] = [cls..user_id]
        # return relationship("User", foreign_keys=[cls.user_id])
        return relationship("User")
