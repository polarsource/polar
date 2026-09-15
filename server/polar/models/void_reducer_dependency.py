import uuid
from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import TIMESTAMP, ForeignKey, ForeignKeyConstraint, String, Uuid
from sqlalchemy.orm import Mapped, mapped_column, relationship

from polar.kit.db.models import Model

if TYPE_CHECKING:
    from .organization import Organization
    from .void_reducer import VoidReducer


class VoidReducerDependency(Model):
    __tablename__ = "void_reducer_dependencies"
    __table_args__ = (
        ForeignKeyConstraint(
            ["organization_id", "reducer_id"],
            ["void_reducers.organization_id", "void_reducers.id"],
        ),
        ForeignKeyConstraint(
            ["organization_id", "source_reducer_id"],
            ["void_reducers.organization_id", "void_reducers.id"],
        ),
    )

    reducer_id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True)
    input_name: Mapped[str] = mapped_column(String, primary_key=True)
    source_reducer_id: Mapped[uuid.UUID] = mapped_column(Uuid, index=True)
    organization_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("organizations.id"), nullable=False, index=True
    )

    reducer: Mapped["VoidReducer"] = relationship(
        foreign_keys=[reducer_id], lazy="raise"
    )
    source_reducer: Mapped["VoidReducer"] = relationship(
        foreign_keys=[source_reducer_id], lazy="raise"
    )
    organization: Mapped["Organization"] = relationship(lazy="raise")


class VoidReducerJob(Model):
    """Transactional outbox, coalesced by derived reducer and time bucket."""

    __tablename__ = "void_reducer_jobs"
    __table_args__ = (
        ForeignKeyConstraint(
            ["organization_id", "reducer_id"],
            ["void_reducers.organization_id", "void_reducers.id"],
        ),
    )

    reducer_id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True)
    bucket_start: Mapped[datetime] = mapped_column(
        TIMESTAMP(timezone=True), primary_key=True
    )
    organization_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("organizations.id"), nullable=False, index=True
    )

    reducer: Mapped["VoidReducer"] = relationship(
        foreign_keys=[reducer_id], lazy="raise"
    )
    organization: Mapped["Organization"] = relationship(lazy="raise")
