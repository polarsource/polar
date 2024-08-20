from datetime import datetime
from enum import StrEnum
from typing import TYPE_CHECKING, Literal, Self
from uuid import UUID

from dateutil.relativedelta import relativedelta
from sqlalchemy import (
    TIMESTAMP,
    ForeignKey,
    Integer,
    String,
    Uuid,
)
from sqlalchemy.orm import Mapped, declared_attr, mapped_column, relationship

from polar.kit.db.models import RecordModel
from polar.kit.utils import generate_uuid, utc_now

from .benefit import Benefit, BenefitLicenseKeyActivation, BenefitLicenseKeyExpiration
from .user import User

if TYPE_CHECKING:
    from .license_key_activation import LicenseKeyActivation


class LicenseKeyStatus(StrEnum):
    granted = "granted"
    revoked = "revoked"


class LicenseKey(RecordModel):
    __tablename__ = "license_keys"

    user_id: Mapped[UUID] = mapped_column(
        Uuid,
        ForeignKey("users.id", ondelete="cascade"),
        nullable=False,
        index=True,
    )

    @declared_attr
    def user(cls) -> Mapped[User]:
        return relationship("User", lazy="raise")

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
    def activations(cls) -> Mapped[list["LicenseKeyActivation"]]:
        return relationship("LicenseKeyActivation", lazy="joined", back_populates="license_key")

    validations: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

    last_validated_at: Mapped[datetime | None] = mapped_column(
        TIMESTAMP(timezone=True),
        nullable=True,
    )

    expires_at: Mapped[datetime | None] = mapped_column(
        TIMESTAMP(timezone=True),
        nullable=True,
    )

    @classmethod
    def generate(cls, prefix: str | None = None) -> str:
        key = str(generate_uuid()).upper()
        if prefix is None:
            return key

        prefix = prefix.strip().upper()
        return f"{prefix}-{key}"

    @classmethod
    def generate_expiration_dt(
        cls, ttl: int, timeframe: Literal["year", "month", "day"]
    ) -> datetime:
        now = utc_now()
        match timeframe:
            case "year":
                return now + relativedelta(years=ttl)
            case "month":
                return now + relativedelta(months=ttl)
            case _:
                return now + relativedelta(days=ttl)

    @classmethod
    def build(
        cls,
        *,
        user_id: UUID,
        benefit_id: UUID,
        prefix: str | None = None,
        status: LicenseKeyStatus = LicenseKeyStatus.granted,
        activations: BenefitLicenseKeyActivation | None = None,
        expires: BenefitLicenseKeyExpiration | None = None,
    ) -> Self:
        expires_at = None
        if expires:
            ttl = expires.get("ttl", None)
            timeframe = expires.get("timeframe", None)
            if ttl and timeframe:
                expires_at = cls.generate_expiration_dt(ttl, timeframe)

        limit_activations = None
        if activations:
            limit_activations = activations.get("limit", None)

        key = cls.generate(prefix=prefix)
        return cls(
            user_id=user_id,
            benefit_id=benefit_id,
            key=key,
            status=status,
            limit_activations=limit_activations,
            expires_at=expires_at
        )

    def mark_revoked(self) -> None:
        self.status = LicenseKeyStatus.revoked

    def requires_activation(self) -> None:
        return self.limit_activations is not None

