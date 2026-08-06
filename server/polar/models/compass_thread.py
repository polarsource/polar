from typing import TYPE_CHECKING
from uuid import UUID

from sqlalchemy import ForeignKey, String, Uuid
from sqlalchemy.dialects.postgresql import ARRAY
from sqlalchemy.orm import Mapped, declared_attr, mapped_column, relationship

from polar.auth.scope import Scope
from polar.kit.db.models.base import RecordModel
from polar.kit.extensions.sqlalchemy import StringEnum

if TYPE_CHECKING:
    from .organization import Organization
    from .user import User


class CompassThread(RecordModel):
    """A Compass assistant conversation.

    Threads created by a user session belong to that user; threads created
    with an organization token have no user and are shared by the
    organization's token holders.
    """

    __tablename__ = "compass_threads"

    organization_id: Mapped[UUID] = mapped_column(
        Uuid,
        ForeignKey("organizations.id", ondelete="cascade"),
        nullable=False,
        index=True,
    )
    user_id: Mapped[UUID | None] = mapped_column(
        Uuid,
        ForeignKey("users.id", ondelete="cascade"),
        nullable=True,
        index=True,
    )
    title: Mapped[str] = mapped_column(String, nullable=False)
    required_scopes: Mapped[list[Scope]] = mapped_column(
        ARRAY(StringEnum(Scope)), nullable=False, default=list
    )
    """The assistant scopes the creating credential held.

    A stored turn holds the answer as rendered under these scopes, so a
    credential may read the thread back only if it holds all of them."""

    @declared_attr
    def organization(cls) -> Mapped["Organization"]:
        return relationship("Organization", lazy="raise")

    @declared_attr
    def user(cls) -> Mapped["User | None"]:
        return relationship("User", lazy="raise")
