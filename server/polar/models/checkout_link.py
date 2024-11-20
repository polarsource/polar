from uuid import UUID

from sqlalchemy import Boolean, ForeignKey, String, Uuid
from sqlalchemy.orm import Mapped, declared_attr, mapped_column, relationship

from polar.enums import PaymentProcessor
from polar.kit.db.models import RecordModel
from polar.kit.metadata import MetadataMixin

from .discount import Discount
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
    allow_discount_codes: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=True
    )

    product_id: Mapped[UUID] = mapped_column(
        Uuid, ForeignKey("products.id", ondelete="cascade"), nullable=False
    )

    product_price_id: Mapped[UUID | None] = mapped_column(
        Uuid, ForeignKey("product_prices.id", ondelete="set null"), nullable=True
    )

    discount_id: Mapped[UUID | None] = mapped_column(
        Uuid, ForeignKey("discounts.id", ondelete="set null"), nullable=True
    )

    @declared_attr
    def product(cls) -> Mapped[Product]:
        # Eager load since we always need & have a product per link
        return relationship(Product, lazy="joined", innerjoin=True)

    @declared_attr
    def product_price(cls) -> Mapped[ProductPrice | None]:
        # Eager load in case an explicit `product_price_id` is set
        return relationship(ProductPrice, lazy="joined")

    @declared_attr
    def discount(cls) -> Mapped[Discount | None]:
        # Eager loading makes sense here because we always need the discount when present
        return relationship(Discount, lazy="joined")

    @property
    def checkout_price(self) -> ProductPrice:
        # Default to the first price unless one is explicitly set
        price = self.product_price
        if price and not price.is_archived:
            return price

        for inner_price in self.product.prices:
            if not inner_price.is_archived:
                return inner_price

        # Going to return the first archived
        return self.product.prices[0]

    @property
    def success_url(self) -> str | None:
        return self._success_url

    @success_url.setter
    def success_url(self, value: str | None) -> None:
        self._success_url = str(value) if value is not None else None
