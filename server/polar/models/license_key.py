from datetime import datetime
from enum import StrEnum
from typing import TYPE_CHECKING
from uuid import UUID

from sqlalchemy import (
    TIMESTAMP,
    ForeignKey,
    Integer,
    String,
    Uuid,
)
from sqlalchemy.orm import Mapped, declared_attr, mapped_column, relationship

from polar.kit.db.models import RecordModel
from polar.kit.utils import utc_now

from .benefit import Benefit
from .customer import Customer

if TYPE_CHECKING:
    from .license_key_activation import LicenseKeyActivation
    from .organization import Organization


class LicenseKeyStatus(StrEnum):
    granted = "granted"
    revoked = "revoked"
    disabled = "disabled"


class LicenseKey(RecordModel):
    __tablename__ = "license_keys"

    organization_id: Mapped[UUID] = mapped_column(
        Uuid,
        ForeignKey("organizations.id", ondelete="cascade"),
        nullable=False,
        index=True,
    )

    @declared_attr
    def organization(cls) -> Mapped["Organization"]:
        return relationship("Organization", lazy="raise")

    customer_id: Mapped[UUID] = mapped_column(
        Uuid, ForeignKey("customers.id", ondelete="cascade"), nullable=False, index=True
    )

    @declared_attr
    def customer(cls) -> Mapped[Customer]:
        return relationship("Customer", lazy="raise")

    benefit_id: Mapped[UUID] = mapped_column(
        Uuid,
        ForeignKey("benefits.id", ondelete="cascade"),
        nullable=False,
        index=True,
    )

    @declared_attr
    def benefit(cls) -> Mapped[Benefit]:
        return relationship("Benefit", lazy="raise")

    key: Mapped[str] = mapped_column(String, nullable=False)

    status: Mapped[LicenseKeyStatus] = mapped_column(
        String, nullable=False, default=LicenseKeyStatus.granted
    )

    limit_activations: Mapped[int | None] = mapped_column(Integer, nullable=True)

    @declared_attr
    def all_activations(cls) -> Mapped[list["LicenseKeyActivation"]]:
        return relationship(
            "LicenseKeyActivation", lazy="raise", back_populates="license_key"
        )

    @declared_attr
    def activations(cls) -> Mapped[list["LicenseKeyActivation"]]:
        return relationship(
            "LicenseKeyActivation",
            lazy="raise",
            primaryjoin=(
                "and_("
                "LicenseKeyActivation.license_key_id == LicenseKey.id, "
                "LicenseKeyActivation.deleted_at.is_(None)"
                ")"
            ),
            viewonly=True,
        )

    usage: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

    limit_usage: Mapped[int | None] = mapped_column(Integer, nullable=True)

    validations: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

    last_validated_at: Mapped[datetime | None] = mapped_column(
        TIMESTAMP(timezone=True),
        nullable=True,
    )

    expires_at: Mapped[datetime | None] = mapped_column(
        TIMESTAMP(timezone=True),
        nullable=True,
    )

    @property
    def display_key(self) -> str:
        prefix = "****"
        last_six_digits = self.key[-6:]
        return f"{prefix}-{last_six_digits}"

    @property
    def activation(self) -> "LicenseKeyActivation | None":
        return getattr(self, "_activation", None)

    @activation.setter
    def activation(self, value: "LicenseKeyActivation") -> None:
        self._activation = value

    def mark_revoked(self) -> None:
        self.status = LicenseKeyStatus.revoked

    def mark_validated(self, increment_usage: int | None = None) -> None:
        self.validations += 1
        self.last_validated_at = utc_now()
        if increment_usage:
            self.usage += increment_usage

    def is_active(self) -> bool:
        return self.status == LicenseKeyStatus.granted
