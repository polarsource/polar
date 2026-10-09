from datetime import datetime
from decimal import Decimal
from typing import TYPE_CHECKING
from uuid import UUID

from sqlalchemy import (
    TIMESTAMP,
    BigInteger,
    ForeignKey,
    Index,
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
    from .organization import Organization
    from .reducer import Reducer


class ReducerBucket(RecordModel):
    __tablename__ = "reducer_buckets"
    __table_args__ = (
        Index(
            "ix_reducer_buckets_organization_reducer_bucket_start",
            "organization_id",
            "reducer_id",
            "bucket_start",
        ),
        UniqueConstraint(
            "organization_id",
            "reducer_id",
            "customer_id",
            "external_customer_id",
            "bucket_start",
            "generation",
            name="reducer_buckets_identity_generation_key",
            postgresql_nulls_not_distinct=True,
        ),
    )

    created_at: Mapped[datetime] = mapped_column(
        TIMESTAMP(timezone=True), nullable=False, default=utc_now, index=False
    )
    organization_id: Mapped[UUID] = mapped_column(
        Uuid, ForeignKey("organizations.id", ondelete="cascade"), nullable=False
    )
    reducer_id: Mapped[UUID] = mapped_column(
        Uuid, ForeignKey("reducers.id", ondelete="cascade"), nullable=False
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
    reducer: Mapped["Reducer"] = relationship(lazy="raise")
    customer: Mapped["Customer | None"] = relationship(lazy="raise")

    # Sealing freezes this generation; events ingested after it go to the next,
    # so a bucket's totals combine all its generations.
    generation: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
