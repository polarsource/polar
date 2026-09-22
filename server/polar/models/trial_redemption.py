from typing import TYPE_CHECKING
from uuid import UUID

from sqlalchemy import ForeignKey, String, Uuid
from sqlalchemy.ext.associationproxy import AssociationProxy, association_proxy
from sqlalchemy.orm import Mapped, declared_attr, mapped_column, relationship

from polar.kit.db.models import RecordModel

if TYPE_CHECKING:
    from polar.models import Customer, Organization, Product


class TrialRedemption(RecordModel):
    __tablename__ = "trial_redemptions"

    customer_email: Mapped[str] = mapped_column(String, nullable=False, index=True)
    payment_method_fingerprint: Mapped[str | None] = mapped_column(
        String, nullable=True, index=True
    )

    customer_id: Mapped[UUID] = mapped_column(
        Uuid, ForeignKey("customers.id", ondelete="cascade"), nullable=False, index=True
    )

    @declared_attr
    def customer(cls) -> Mapped["Customer"]:
        return relationship("Customer", lazy="raise")

    organization: AssociationProxy["Organization"] = association_proxy(
        "customer", "organization"
    )

    product_id: Mapped[UUID | None] = mapped_column(
        Uuid, ForeignKey("products.id", ondelete="cascade"), nullable=True, index=True
    )

    @declared_attr
    def product(cls) -> Mapped["Product | None"]:
        return relationship("Product", lazy="raise")
