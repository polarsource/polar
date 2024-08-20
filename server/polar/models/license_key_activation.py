from typing import TYPE_CHECKING, Any
from uuid import UUID

from sqlalchemy import (
    ForeignKey,
    String,
    Uuid,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, declared_attr, mapped_column, relationship

from polar.kit.db.models import RecordModel

if TYPE_CHECKING:
    from .license_key import LicenseKey


class LicenseKeyActivation(RecordModel):
    __tablename__ = "license_key_activations"

    license_key_id: Mapped[UUID] = mapped_column(
        Uuid,
        ForeignKey("license_keys.id", ondelete="cascade"),
        nullable=False,
        index=True,
    )

    @declared_attr
    def license_key(cls) -> Mapped["LicenseKey"]:
        return relationship("LicenseKey", lazy="raise", back_populates="activations")

    label: Mapped[str] = mapped_column(String, nullable=False)

    meta: Mapped[dict[str, Any]] = mapped_column(JSONB, nullable=False, default=dict)
