from typing import TYPE_CHECKING
from uuid import UUID

from sqlalchemy import ForeignKey, String, Uuid
from sqlalchemy.orm import Mapped, declared_attr, mapped_column, relationship

from polar.kit.db.models.base import RecordModel

if TYPE_CHECKING:
    from .organization import Organization
    from .user import User


class CompassThread(RecordModel):
    """A Compass assistant conversation.

    A thread belongs to the user whose dashboard session created it: Compass
    is reachable from a web session only, so there are no threads shared by
    an organization's API tokens.
    """

    __tablename__ = "compass_threads"

    organization_id: Mapped[UUID] = mapped_column(
        Uuid,
        ForeignKey("organizations.id", ondelete="cascade"),
        nullable=False,
        index=True,
    )
    user_id: Mapped[UUID] = mapped_column(
        Uuid,
        ForeignKey("users.id", ondelete="cascade"),
        nullable=False,
        index=True,
    )
    title: Mapped[str] = mapped_column(String, nullable=False)

    @declared_attr
    def organization(cls) -> Mapped["Organization"]:
        return relationship("Organization", lazy="raise")

    @declared_attr
    def user(cls) -> Mapped["User"]:
        return relationship("User", lazy="raise")
