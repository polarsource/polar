from typing import TYPE_CHECKING
from uuid import UUID

from sqlalchemy import Boolean, ForeignKey, String, Uuid
from sqlalchemy.ext.associationproxy import AssociationProxy, association_proxy
from sqlalchemy.orm import Mapped, declared_attr, mapped_column, relationship

from polar.enums import PaymentProcessor
from polar.kit.db.models import RecordModel
from polar.kit.metadata import MetadataMixin
from polar.kit.trial import TrialConfigurationMixin

from .discount import Discount
from .product import Product

if TYPE_CHECKING:
    from .checkout_link_product import CheckoutLinkProduct
    from .organization import Organization


class CheckoutLink(TrialConfigurationMixin, MetadataMixin, RecordModel):
    __tablename__ = "checkout_links"

    payment_processor: Mapped[PaymentProcessor] = mapped_column(
        String, nullable=False, default=PaymentProcessor.stripe, index=True
    )
    client_secret: Mapped[str] = mapped_column(
        String, index=True, nullable=False, unique=True
    )
    _success_url: Mapped[str | None] = mapped_column(
        "success_url", String, nullable=True, default=None
    )

    label: Mapped[UUID] = mapped_column(String, nullable=True)
    allow_discount_codes: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=True
    )
    require_billing_address: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False
    )

    discount_id: Mapped[UUID | None] = mapped_column(
        Uuid, ForeignKey("discounts.id", ondelete="set null"), nullable=True
    )

    @declared_attr
    def discount(cls) -> Mapped[Discount | None]:
        # Eager loading makes sense here because we always need the discount when present
        return relationship(Discount, lazy="joined")

    checkout_link_products: Mapped[list["CheckoutLinkProduct"]] = relationship(
        "CheckoutLinkProduct",
        back_populates="checkout_link",
        cascade="all, delete-orphan",
        order_by="CheckoutLinkProduct.order",
        # Products are almost always needed, so eager loading makes sense
        lazy="selectin",
    )

    products: AssociationProxy[list["Product"]] = association_proxy(
        "checkout_link_products", "product"
    )

    # Denormalize organization_id to help with validation
    # when updating products or discount
    organization_id: Mapped[UUID] = mapped_column(
        Uuid,
        ForeignKey("organizations.id", ondelete="cascade"),
        nullable=False,
        index=True,
    )

    @declared_attr
    def organization(cls) -> Mapped["Organization"]:
        return relationship("Organization", lazy="raise")

    @property
    def success_url(self) -> str | None:
        return self._success_url

    @success_url.setter
    def success_url(self, value: str | None) -> None:
        self._success_url = str(value) if value is not None else None
