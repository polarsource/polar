from collections.abc import Sequence
from datetime import datetime, timedelta
from enum import StrEnum
from typing import TYPE_CHECKING, Any
from uuid import UUID

from sqlalchemy import (
    TIMESTAMP,
    Boolean,
    ColumnElement,
    Connection,
    ForeignKey,
    Integer,
    String,
    Uuid,
    event,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.ext.associationproxy import AssociationProxy, association_proxy
from sqlalchemy.ext.hybrid import hybrid_property
from sqlalchemy.orm import Mapped, Mapper, declared_attr, mapped_column, relationship

from polar.config import settings
from polar.custom_field.attachment import AttachedCustomFieldMixin
from polar.custom_field.data import CustomFieldDataMixin
from polar.enums import PaymentProcessor
from polar.kit.address import Address, AddressType
from polar.kit.db.models import RecordModel
from polar.kit.metadata import MetadataColumn, MetadataMixin
from polar.kit.tax import TaxID, TaxIDType
from polar.kit.utils import utc_now
from polar.product.guard import is_discount_applicable, is_free_price, is_metered_price

from .customer import Customer
from .discount import Discount
from .organization import Organization
from .product import Product
from .product_price import ProductPrice
from .subscription import Subscription

if TYPE_CHECKING:
    from .checkout_product import CheckoutProduct


def get_expires_at() -> datetime:
    return utc_now() + timedelta(seconds=settings.MAGIC_LINK_TTL_SECONDS)


class CheckoutStatus(StrEnum):
    open = "open"
    expired = "expired"
    confirmed = "confirmed"
    succeeded = "succeeded"
    failed = "failed"


class Checkout(CustomFieldDataMixin, MetadataMixin, RecordModel):
    __tablename__ = "checkouts"

    payment_processor: Mapped[PaymentProcessor] = mapped_column(
        String, nullable=False, default=PaymentProcessor.stripe, index=True
    )
    status: Mapped[CheckoutStatus] = mapped_column(
        String, nullable=False, default=CheckoutStatus.open, index=True
    )
    client_secret: Mapped[str] = mapped_column(
        String, index=True, nullable=False, unique=True
    )
    expires_at: Mapped[datetime] = mapped_column(
        TIMESTAMP(timezone=True), index=True, nullable=False, default=get_expires_at
    )
    payment_processor_metadata: Mapped[dict[str, Any]] = mapped_column(
        JSONB, nullable=False, default=dict
    )
    _success_url: Mapped[str | None] = mapped_column(
        "success_url", String, nullable=True, default=None
    )
    embed_origin: Mapped[str | None] = mapped_column(String, nullable=True)
    allow_discount_codes: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=True
    )
    require_billing_address: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False
    )

    amount: Mapped[int] = mapped_column(Integer, nullable=False)
    currency: Mapped[str] = mapped_column(String(3), nullable=False)

    tax_amount: Mapped[int | None] = mapped_column(Integer, nullable=True, default=None)
    tax_processor_id: Mapped[str | None] = mapped_column(
        String, nullable=True, default=None
    )

    product_id: Mapped[UUID] = mapped_column(
        Uuid, ForeignKey("products.id", ondelete="cascade"), nullable=False
    )

    @declared_attr
    def product(cls) -> Mapped[Product]:
        # Eager loading makes sense here because we always need the product
        return relationship(Product, lazy="joined")

    product_price_id: Mapped[UUID] = mapped_column(
        Uuid, ForeignKey("product_prices.id", ondelete="cascade"), nullable=False
    )

    @declared_attr
    def product_price(cls) -> Mapped[ProductPrice]:
        # Eager loading makes sense here because we always need the price
        return relationship(ProductPrice, lazy="joined")

    checkout_products: Mapped[list["CheckoutProduct"]] = relationship(
        "CheckoutProduct",
        back_populates="checkout",
        cascade="all, delete-orphan",
        order_by="CheckoutProduct.order",
        # Products are almost always needed, so eager loading makes sense
        lazy="selectin",
    )

    products: AssociationProxy[list["Product"]] = association_proxy(
        "checkout_products", "product"
    )

    organization: AssociationProxy[Organization] = association_proxy(
        "product", "organization"
    )

    discount_id: Mapped[UUID | None] = mapped_column(
        Uuid, ForeignKey("discounts.id", ondelete="set null"), nullable=True
    )

    @declared_attr
    def discount(cls) -> Mapped[Discount | None]:
        # Eager loading makes sense here because we always need the discount when present
        return relationship(Discount, lazy="joined")

    customer_id: Mapped[UUID | None] = mapped_column(
        Uuid, ForeignKey("customers.id", ondelete="set null"), nullable=True
    )

    @declared_attr
    def customer(cls) -> Mapped[Customer | None]:
        return relationship(Customer, lazy="raise")

    is_business_customer: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False
    )
    customer_external_id: Mapped[str | None] = mapped_column(
        String, nullable=True, default=None
    )
    customer_name: Mapped[str | None] = mapped_column(
        String, nullable=True, default=None
    )
    customer_email: Mapped[str | None] = mapped_column(
        String, nullable=True, default=None
    )
    _customer_ip_address: Mapped[str | None] = mapped_column(
        "customer_ip_address", String, nullable=True, default=None
    )
    customer_billing_name: Mapped[str | None] = mapped_column(
        String, nullable=True, default=None
    )
    customer_billing_address: Mapped[Address | None] = mapped_column(
        AddressType, nullable=True, default=None
    )
    customer_tax_id: Mapped[TaxID | None] = mapped_column(
        TaxIDType, nullable=True, default=None
    )
    customer_metadata: Mapped[MetadataColumn]

    subscription_id: Mapped[UUID | None] = mapped_column(
        Uuid, ForeignKey("subscriptions.id", ondelete="set null"), nullable=True
    )

    @declared_attr
    def subscription(cls) -> Mapped[Subscription | None]:
        return relationship(
            Subscription,
            lazy="joined",
            foreign_keys=[cls.subscription_id],  # type: ignore
        )

    @hybrid_property
    def is_expired(self) -> bool:
        return self.expires_at < utc_now()

    @is_expired.inplace.expression
    @classmethod
    def _is_expired_expression(cls) -> ColumnElement[bool]:
        return cls.expires_at < utc_now()

    @hybrid_property
    def customer_ip_address(self) -> str | None:
        return self._customer_ip_address

    @customer_ip_address.inplace.setter
    def _customer_ip_address_setter(self, value: Any | None) -> None:
        self._customer_ip_address = str(value) if value is not None else None

    @property
    def success_url(self) -> str:
        if self._success_url is None:
            return settings.generate_frontend_url(
                f"/checkout/{self.client_secret}/confirmation"
            )
        try:
            return self._success_url.format(CHECKOUT_ID=self.id)
        except KeyError:
            return self._success_url

    @success_url.setter
    def success_url(self, value: str | None) -> None:
        self._success_url = str(value) if value is not None else None

    @property
    def customer_tax_id_number(self) -> str | None:
        return self.customer_tax_id[0] if self.customer_tax_id is not None else None

    @property
    def discount_amount(self) -> int:
        return self.discount.get_discount_amount(self.amount) if self.discount else 0

    @property
    def net_amount(self) -> int:
        return self.amount - self.discount_amount

    @property
    def total_amount(self) -> int:
        return self.net_amount + (self.tax_amount or 0)

    @property
    def is_discount_applicable(self) -> bool:
        return any(is_discount_applicable(price) for price in self.product.prices)

    @property
    def is_free_product_price(self) -> bool:
        return all(is_free_price(price) for price in self.product.prices)

    @property
    def has_metered_prices(self) -> bool:
        return any(is_metered_price(price) for price in self.product.prices)

    @property
    def is_payment_required(self) -> bool:
        return self.total_amount > 0

    @property
    def is_payment_setup_required(self) -> bool:
        return self.product.is_recurring and not self.is_free_product_price

    @property
    def is_payment_form_required(self) -> bool:
        return self.is_payment_required or self.is_payment_setup_required

    @property
    def url(self) -> str:
        return settings.generate_frontend_url(f"/checkout/{self.client_secret}")

    @property
    def customer_session_token(self) -> str | None:
        return getattr(self, "_customer_session_token", None)

    @customer_session_token.setter
    def customer_session_token(self, value: str) -> None:
        self._customer_session_token = value

    attached_custom_fields: AssociationProxy[Sequence["AttachedCustomFieldMixin"]] = (
        association_proxy("product", "attached_custom_fields")
    )


@event.listens_for(Checkout, "before_update")
def check_expiration(
    mapper: Mapper[Any], connection: Connection, target: Checkout
) -> None:
    if target.expires_at < utc_now() and target.status == CheckoutStatus.open:
        target.status = CheckoutStatus.expired
