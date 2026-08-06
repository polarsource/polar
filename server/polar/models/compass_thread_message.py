from typing import TYPE_CHECKING, Any
from uuid import UUID

from sqlalchemy import ForeignKey, Index, Text, Uuid
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, declared_attr, mapped_column, relationship

from polar.kit.db.models.base import RecordModel

if TYPE_CHECKING:
    from .compass_thread import CompassThread


class CompassThreadMessage(RecordModel):
    """One completed assistant turn of a Compass thread.

    `parts` is the client-facing transcript: text and UI blocks in the order
    they were streamed. Reloading a thread re-renders this without calling
    the model.
    `model_messages` is the turn's pydantic-ai delta, used only to build the
    next turn's model context by concatenating all turns' deltas in order.
    A stored row is never rewritten.
    """

    __tablename__ = "compass_thread_messages"
    # Every message query filters by thread and orders by created_at.
    __table_args__ = (
        Index(
            "ix_compass_thread_messages_thread_id_created_at",
            "thread_id",
            "created_at",
        ),
    )

    thread_id: Mapped[UUID] = mapped_column(
        Uuid,
        ForeignKey("compass_threads.id", ondelete="cascade"),
        nullable=False,
    )
    prompt: Mapped[str] = mapped_column(Text, nullable=False)
    parts: Mapped[list[dict[str, Any]]] = mapped_column(
        JSONB, nullable=False, default=list
    )
    # Deferred: only replay reads it, and it's the largest column on the row.
    model_messages: Mapped[list[dict[str, Any]]] = mapped_column(
        JSONB, nullable=False, default=list, deferred=True
    )

    @declared_attr
    def thread(cls) -> Mapped["CompassThread"]:
        return relationship("CompassThread", lazy="raise")
