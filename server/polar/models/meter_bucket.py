from datetime import datetime
from decimal import Decimal
from typing import TYPE_CHECKING
from uuid import UUID

from sqlalchemy import (
    TIMESTAMP,
    BigInteger,
    ForeignKey,
    Integer,
    Numeric,
    String,
    UniqueConstraint,
    Uuid,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from polar.kit.db.models import RecordModel
from polar.kit.utils import utc_now

if TYPE_CHECKING:
    from .customer import Customer
    from .meter import Meter
    from .organization import Organization


class MeterBucket(RecordModel):
    __tablename__ = "meter_buckets"
    __table_args__ = (
        UniqueConstraint(
            "organization_id",
            "meter_id",
            "customer_id",
            "external_customer_id",
            "bucket_start",
            "generation",
            name="meter_buckets_identity_generation_key",
            postgresql_nulls_not_distinct=True,
        ),
    )

    created_at: Mapped[datetime] = mapped_column(
        TIMESTAMP(timezone=True), nullable=False, default=utc_now, index=False
    )
    organization_id: Mapped[UUID] = mapped_column(
        Uuid, ForeignKey("organizations.id", ondelete="cascade"), nullable=False
    )
    meter_id: Mapped[UUID] = mapped_column(
        Uuid, ForeignKey("meters.id", ondelete="cascade"), nullable=False
    )
    customer_id: Mapped[UUID | None] = mapped_column(
        Uuid, ForeignKey("customers.id"), nullable=True
    )
    external_customer_id: Mapped[str | None] = mapped_column(String, nullable=True)
    bucket_start: Mapped[datetime] = mapped_column(
        TIMESTAMP(timezone=True), nullable=False
    )
    count: Mapped[int] = mapped_column(BigInteger, nullable=False, default=0)
    sum: Mapped[Decimal] = mapped_column(Numeric, nullable=False, default=Decimal(0))
    min: Mapped[Decimal | None] = mapped_column(Numeric, nullable=True)
    max: Mapped[Decimal | None] = mapped_column(Numeric, nullable=True)
    sealed_at: Mapped[datetime | None] = mapped_column(
        TIMESTAMP(timezone=True), nullable=True
    )

    organization: Mapped["Organization"] = relationship(lazy="raise")
    meter: Mapped["Meter"] = relationship(lazy="raise")
    customer: Mapped["Customer | None"] = relationship(lazy="raise")

    # After a bucket is sealed (e.g. has been billed), we need to open a new bucket in the same slot but with a new generation.
    # This allows us to update a bucket after it has been billed. Every time we bill a bucket we will seal it.
    generation: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
