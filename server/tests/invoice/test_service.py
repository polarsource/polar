import pytest

from polar.invoice.service import invoice as invoice_service
from polar.kit.address import Address, CountryAlpha2
from polar.models import Customer, Order, Product
from polar.tax.tax_id import TaxIDFormat
from tests.fixtures.database import SaveFixture
from tests.fixtures.random_objects import create_order


@pytest.mark.asyncio
async def test_create_order_invoice(
    save_fixture: SaveFixture, product: Product, customer: Customer
) -> None:
    order = await create_order(
        save_fixture,
        product=product,
        customer=customer,
        billing_name="John Doe",
        billing_address=Address(
            line1="456 Customer Ave",
            city="Los Angeles",
            state="CA",
            postal_code="90001",
            country=CountryAlpha2("US"),
        ),
        invoice_number="POLAR-0001",
    )

    invoice_path = await invoice_service.create_order_invoice(order)


@pytest.mark.asyncio
class TestComputeOrderChecksum:
    async def _order(
        self,
        save_fixture: SaveFixture,
        product: Product,
        customer: Customer,
    ) -> Order:
        return await create_order(
            save_fixture,
            product=product,
            customer=customer,
            billing_name="John Doe",
            billing_address=Address(country=CountryAlpha2("US")),
        )

    async def test_deterministic(
        self, save_fixture: SaveFixture, product: Product, customer: Customer
    ) -> None:
        order = await self._order(save_fixture, product, customer)

        assert invoice_service.compute_order_checksum(
            order
        ) == invoice_service.compute_order_checksum(order)

    async def test_sensitive_to_billing_name(
        self, save_fixture: SaveFixture, product: Product, customer: Customer
    ) -> None:
        order = await self._order(save_fixture, product, customer)
        before = invoice_service.compute_order_checksum(order)

        order.billing_name = "Jane Doe"

        assert invoice_service.compute_order_checksum(order) != before

    async def test_sensitive_to_billing_address(
        self, save_fixture: SaveFixture, product: Product, customer: Customer
    ) -> None:
        order = await self._order(save_fixture, product, customer)
        before = invoice_service.compute_order_checksum(order)

        order.billing_address = Address(country=CountryAlpha2("FR"))

        assert invoice_service.compute_order_checksum(order) != before

    async def test_sensitive_to_customer_locale(
        self, save_fixture: SaveFixture, product: Product, customer: Customer
    ) -> None:
        order = await self._order(save_fixture, product, customer)
        before = invoice_service.compute_order_checksum(order)

        order.customer.locale = "fr"

        assert invoice_service.compute_order_checksum(order) != before

    async def test_sensitive_to_tax_id(
        self, save_fixture: SaveFixture, product: Product, customer: Customer
    ) -> None:
        order = await self._order(save_fixture, product, customer)
        before = invoice_service.compute_order_checksum(order)

        order.tax_id = ("FR61954506077", TaxIDFormat.eu_vat)

        assert invoice_service.compute_order_checksum(order) != before
