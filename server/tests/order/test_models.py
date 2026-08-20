from polar.models import OrderItem, Product
from polar.models.product_price import (
    ProductPriceFixed,
    ProductPriceSeatUnit,
    ProductPriceUnit,
)


class TestFormatPriceLabel:
    def test_seat_plural(self) -> None:
        product = Product(name="Acme Pro")
        assert (
            OrderItem.format_price_label(product, ProductPriceSeatUnit(), seats=14)
            == "Acme Pro (14 seats)"
        )

    def test_seat_singular(self) -> None:
        product = Product(name="Acme Pro")
        assert (
            OrderItem.format_price_label(product, ProductPriceSeatUnit(), seats=1)
            == "Acme Pro (1 seat)"
        )

    def test_seat_without_count(self) -> None:
        product = Product(name="Acme Pro")
        assert (
            OrderItem.format_price_label(product, ProductPriceSeatUnit(), seats=None)
            == "Acme Pro"
        )

    def test_fixed(self) -> None:
        product = Product(name="Acme Pro")
        assert (
            OrderItem.format_price_label(product, ProductPriceFixed(), seats=10)
            == "Acme Pro"
        )

    def test_unit_default_plural(self) -> None:
        product = Product(name="Acme Pro")
        assert (
            OrderItem.format_price_label(
                product, ProductPriceUnit(), seats=None, units=3
            )
            == "Acme Pro (3 units)"
        )

    def test_unit_default_singular(self) -> None:
        product = Product(name="Acme Pro")
        assert (
            OrderItem.format_price_label(
                product, ProductPriceUnit(), seats=None, units=1
            )
            == "Acme Pro (1 unit)"
        )

    def test_unit_custom_label(self) -> None:
        product = Product(name="Acme Pro")
        price = ProductPriceUnit(
            unit_label={"en": {"=1": "device", "other": "devices"}}
        )
        assert (
            OrderItem.format_price_label(product, price, seats=None, units=3)
            == "Acme Pro (3 devices)"
        )
        assert (
            OrderItem.format_price_label(product, price, seats=None, units=1)
            == "Acme Pro (1 device)"
        )
