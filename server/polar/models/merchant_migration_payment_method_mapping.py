from typing import TYPE_CHECKING
from uuid import UUID

from sqlalchemy import ForeignKey, Index, String, Uuid
from sqlalchemy.orm import Mapped, declared_attr, mapped_column, relationship

from polar.kit.db.models import RecordModel

if TYPE_CHECKING:
    from polar.models.merchant_migration import MerchantMigration


class MerchantMigrationPaymentMethodMapping(RecordModel):
    __tablename__ = "merchant_migration_payment_method_mappings"
    __table_args__ = (
        Index(
            "ix_merchant_migration_payment_method_mappings_source",
            "merchant_migration_id",
            "source_payment_method_id",
            unique=True,
        ),
        Index(
            "ix_merchant_migration_payment_method_mappings_destination",
            "merchant_migration_id",
            "destination_payment_method_id",
            unique=True,
        ),
    )

    merchant_migration_id: Mapped[UUID] = mapped_column(
        Uuid,
        ForeignKey("merchant_migrations.id", ondelete="cascade"),
        nullable=False,
        index=True,
    )
    source_customer_id: Mapped[str] = mapped_column(String, nullable=False)
    source_payment_method_id: Mapped[str] = mapped_column(String, nullable=False)
    destination_customer_id: Mapped[str] = mapped_column(String, nullable=False)
    destination_payment_method_id: Mapped[str] = mapped_column(String, nullable=False)

    @declared_attr
    def merchant_migration(cls) -> Mapped["MerchantMigration"]:
        return relationship("MerchantMigration", lazy="raise")
