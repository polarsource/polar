import uuid
from typing import TYPE_CHECKING, Any

from sqlalchemy import ForeignKey, Integer, Uuid
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from polar.kit.db.models import RecordModel

if TYPE_CHECKING:
    from .organization import Organization


class VoidStage(RecordModel):
    __tablename__ = "void_stages"

    revision: Mapped[int] = mapped_column(Integer, nullable=False)
    configuration: Mapped[dict[str, Any]] = mapped_column(JSONB, nullable=False)
    organization_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("organizations.id"), nullable=False, unique=True
    )

    organization: Mapped["Organization"] = relationship(lazy="raise")
