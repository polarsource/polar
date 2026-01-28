from typing import TYPE_CHECKING
from uuid import UUID

from sqlalchemy import ForeignKey, Uuid
from sqlalchemy.orm import Mapped, declared_attr, mapped_column, relationship

from polar.kit.db.models import RecordModel

if TYPE_CHECKING:
    from polar.models import Perk, User


class PerkClaim(RecordModel):
    """
    Tracks when users claim perks for analytics and rate limiting.
    """

    __tablename__ = "perk_claims"

    perk_id: Mapped[UUID] = mapped_column(
        Uuid,
        ForeignKey("perks.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    user_id: Mapped[UUID] = mapped_column(
        Uuid,
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    @declared_attr
    def perk(cls) -> Mapped["Perk"]:
        return relationship("Perk", lazy="raise")

    @declared_attr
    def user(cls) -> Mapped["User"]:
        return relationship("User", lazy="raise")
