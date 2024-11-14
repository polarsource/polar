from uuid import UUID

from sqlalchemy import ForeignKey, String, Uuid
from sqlalchemy.orm import Mapped, declared_attr, mapped_column, relationship

from polar.enums import PaymentProcessor
from polar.kit.db.models import RecordModel
from polar.kit.metadata import MetadataMixin

from .product import Product
from .product_price import ProductPrice


class CheckoutLink(MetadataMixin, RecordModel):
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

    product_id: Mapped[UUID] = mapped_column(
        Uuid, ForeignKey("products.id", ondelete="cascade"), nullable=False
    )

    product_price_id: Mapped[UUID] = mapped_column(
        Uuid, ForeignKey("product_prices.id", ondelete="cascade"), nullable=True
    )

    @declared_attr
    def product(cls) -> Mapped[Product]:
        # Eager load since we always need & have a product per link
        return relationship(Product, lazy="joined", innerjoin=True)

    @declared_attr
    def product_price(cls) -> Mapped[ProductPrice]:
        # Eager load in case an explicit `product_price_id` is set
        return relationship(ProductPrice, lazy="joined")

    @property
    def checkout_price(self) -> ProductPrice:
        # Default to the first price unless one is explicitly set
        price = self.product_price
        if not price:
            price = self.product.prices[0]

        return price

    @property
    def success_url(self) -> str | None:
        return self._success_url

    @success_url.setter
    def success_url(self, value: str | None) -> None:
        self._success_url = str(value) if value is not None else None
