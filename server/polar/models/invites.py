from typing import Self
from uuid import UUID

from sqlalchemy import ForeignKey, String
from sqlalchemy.orm import (
    Mapped,
    MappedAsDataclass,
    declared_attr,
    mapped_column,
    relationship,
)

from polar.kit.db.models.base import RecordModel
from polar.kit.extensions.sqlalchemy import PostgresUUID
from polar.models.user import User


class Invite(RecordModel, MappedAsDataclass, kw_only=True):
    __tablename__ = "invites"

    created_by: Mapped[UUID] = mapped_column(
        PostgresUUID, ForeignKey("users.id"), nullable=False
    )

    claimed_by: Mapped[UUID | None] = mapped_column(
        PostgresUUID, ForeignKey("users.id"), nullable=True, default=None
    )

    code: Mapped[str] = mapped_column(String, nullable=False, index=True, unique=True)

    @declared_attr
    def claimed_by_user(cls) -> Mapped[User | None]:
        return relationship(
            User, lazy="raise", primaryjoin=User.id == "Invite.claimed_by"
        )

    @declared_attr
    def created_by_user(cls) -> Mapped[User]:
        return relationship(
            User, lazy="raise", primaryjoin=User.id == "Invite.created_by"
        )

    note: Mapped[str | None] = mapped_column(String, nullable=True)
