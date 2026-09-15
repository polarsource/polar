import uuid
from typing import TYPE_CHECKING, Any

from sqlalchemy import ForeignKey, String, UniqueConstraint, Uuid
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from polar.kit.db.models import RecordModel
from polar.void.reducer.aggregation import Aggregation, AggregationType
from polar.void.reducer.filter import Filter, FilterType

if TYPE_CHECKING:
    from .organization import Organization


class VoidReducer(RecordModel):
    __tablename__ = "void_reducers"
    __table_args__ = (
        UniqueConstraint("organization_id", "slug"),
        UniqueConstraint("organization_id", "id"),
    )

    slug: Mapped[str] = mapped_column(String, nullable=False)
    filter: Mapped[Filter | None] = mapped_column(FilterType, nullable=True)
    aggregation: Mapped[Aggregation] = mapped_column(AggregationType, nullable=False)
    map: Mapped[dict[str, Any] | None] = mapped_column(JSONB, nullable=True)
    organization_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("organizations.id"), nullable=False, index=True
    )

    organization: Mapped["Organization"] = relationship(lazy="raise")
