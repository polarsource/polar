from datetime import datetime
from enum import StrEnum
from uuid import UUID

from sqlalchemy import (
    TIMESTAMP,
    ForeignKey,
    Integer,
    String,
    UniqueConstraint,
    Uuid,
)
from sqlalchemy.orm import Mapped, declared_attr, mapped_column, relationship

from polar.kit.db.models import RecordModel

from .benefit import Benefit
from .customer import Customer
from .file import File
from .member import Member


class DownloadableStatus(StrEnum):
    granted = "granted"
    revoked = "revoked"


class Downloadable(RecordModel):
    __tablename__ = "downloadables"
    __table_args__ = (UniqueConstraint("customer_id", "file_id", "benefit_id"),)

    file_id: Mapped[UUID] = mapped_column(
        Uuid, ForeignKey("files.id"), nullable=False, index=True
    )

    @declared_attr
    def file(cls) -> Mapped[File]:
        return relationship(File, lazy="raise")

    status: Mapped[DownloadableStatus] = mapped_column(String, nullable=False)

    customer_id: Mapped[UUID] = mapped_column(
        Uuid,
        ForeignKey("customers.id", ondelete="cascade"),
        nullable=False,
        # Don't create an index for customer_id
        # as it's covered by the unique constraint, being the leading column of it
        index=False,
    )

    @declared_attr
    def customer(cls) -> Mapped[Customer]:
        return relationship("Customer", lazy="raise")

    member_id: Mapped[UUID | None] = mapped_column(
        Uuid,
        ForeignKey("members.id", ondelete="cascade"),
        nullable=True,
        index=True,
    )

    @declared_attr
    def member(cls) -> Mapped[Member | None]:
        return relationship("Member", lazy="raise")

    benefit_id: Mapped[UUID] = mapped_column(
        Uuid,
        ForeignKey("benefits.id", ondelete="cascade"),
        nullable=False,
        index=True,
    )

    @declared_attr
    def benefit(cls) -> Mapped[Benefit]:
        return relationship("Benefit", lazy="raise")

    downloaded: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

    last_downloaded_at: Mapped[datetime | None] = mapped_column(
        TIMESTAMP(timezone=True),
        nullable=True,
    )
