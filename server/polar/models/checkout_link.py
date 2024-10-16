from uuid import UUID

from sqlalchemy import ForeignKey, String, Uuid
from sqlalchemy.orm import Mapped, declared_attr, mapped_column, relationship

from polar.enums import PaymentProcessor
from polar.kit.db.models import RecordModel
from polar.kit.metadata import MetadataMixin

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

    product_price_id: Mapped[UUID] = mapped_column(
        Uuid, ForeignKey("product_prices.id", ondelete="cascade"), nullable=False
    )

    @declared_attr
    def product_price(cls) -> Mapped[ProductPrice]:
        # Eager loading makes sense here because we always need the price
        return relationship(ProductPrice, lazy="joined")

    @property
    def success_url(self) -> str | None:
        return self._success_url

    @success_url.setter
    def success_url(self, value: str | None) -> None:
        self._success_url = str(value) if value is not None else None
