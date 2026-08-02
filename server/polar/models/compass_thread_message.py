from typing import TYPE_CHECKING, Any
from uuid import UUID

from sqlalchemy import ForeignKey, Text, Uuid
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, declared_attr, mapped_column, relationship

from polar.kit.db.models.base import RecordModel

if TYPE_CHECKING:
    from .compass_thread import CompassThread


class CompassThreadMessage(RecordModel):
    """One completed turn.

    `parts` rehydrates the UI; `model_messages` is the pydantic-ai delta
    concatenated across turns for the next request's context.
    """

    __tablename__ = "compass_thread_messages"

    thread_id: Mapped[UUID] = mapped_column(
        Uuid,
        ForeignKey("compass_threads.id", ondelete="cascade"),
        nullable=False,
        index=True,
    )
    prompt: Mapped[str] = mapped_column(Text, nullable=False)
    parts: Mapped[list[dict[str, Any]]] = mapped_column(
        JSONB, nullable=False, default=list
    )
    model_messages: Mapped[list[dict[str, Any]]] = mapped_column(
        JSONB, nullable=False, default=list, deferred=True
    )
    """Deferred: only the replay path reads it, and it's the largest column on
    the row. Loading it requires an explicit `undefer`."""

    @declared_attr
    def thread(cls) -> Mapped["CompassThread"]:
        return relationship("CompassThread", lazy="raise")
