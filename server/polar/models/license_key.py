from datetime import datetime
from enum import StrEnum
from typing import Literal, Self
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

from .benefit import Benefit
from .user import User


class LicenseKeyStatus(StrEnum):
    enabled = "enabled"
    disabled = "disabled"


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
        String, nullable=False, default=LicenseKeyStatus.enabled
    )

    activations: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

    activation_limit: Mapped[int | None] = mapped_column(Integer, nullable=True)

    last_activated_at: Mapped[datetime | None] = mapped_column(
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
        status: LicenseKeyStatus = LicenseKeyStatus.enabled,
        activation_limit: int | None = None,
        expires: bool = False,
        ttl: int | None = None,
        timeframe: Literal["year", "month", "day"] | None = None
    ) -> Self:
        expiration = None
        if expires:
            if not (ttl and timeframe):
                raise ValueError()

            expiration = cls.generate_expiration_dt(ttl, timeframe)

        key = cls.generate(prefix=prefix)
        return cls(
            user_id=user_id,
            benefit_id=benefit_id,
            key=key,
            status=status,
            activation_limit=activation_limit,
            expires_at=expiration
        )
