from uuid import UUID

from sqlalchemy import (
    ForeignKey,
    String,
    Uuid,
)
from sqlalchemy.orm import Mapped, mapped_column

from polar.kit.db.models import RecordModel


class LicenseKeyActivation(RecordModel):
    __tablename__ = "license_key_activations"

    license_key_id: Mapped[UUID] = mapped_column(
        Uuid,
        ForeignKey("license_keys.id", ondelete="cascade"),
        nullable=False,
        index=True,
    )

    label: Mapped[str] = mapped_column(String, nullable=False)
