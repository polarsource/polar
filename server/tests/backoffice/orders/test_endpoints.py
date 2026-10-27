import uuid
from collections.abc import AsyncGenerator

import httpx
import pytest
from pytest_mock import MockerFixture

from polar.backoffice import app as backoffice_app
from polar.backoffice.dependencies import get_admin
from polar.kit.address import Address, CountryAlpha2
from polar.models import Customer, Order, Product, User
from polar.models.user_session import UserSession
from polar.postgres import AsyncSession, get_db_read_session, get_db_session
from polar.tax.tax_id import TaxIDFormat
from tests.fixtures.database import SaveFixture
from tests.fixtures.random_objects import (
    create_order_and_payment,
    create_payment,
    create_refund,
)


@pytest.fixture
async def backoffice_client(
    session: AsyncSession, user: User
) -> AsyncGenerator[httpx.AsyncClient]:
    user_session = UserSession(token="0" * 64, user_agent="tests", user=user)
    overrides = {
        get_db_session: lambda: session,
        get_db_read_session: lambda: session,
        get_admin: lambda: user_session,
    }
    backoffice_app.dependency_overrides.update(overrides)
    try:
        async with httpx.AsyncClient(
            transport=httpx.ASGITransport(app=backoffice_app), base_url="http://test"
        ) as client:
            yield client
    finally:
        for dependency in overrides:
            backoffice_app.dependency_overrides.pop(dependency, None)


@pytest.fixture
async def order(
    save_fixture: SaveFixture, customer: Customer, product: Product
) -> Order:
    order, _, _ = await create_order_and_payment(
        save_fixture,
        product=product,
        customer=customer,
        subtotal_amount=10000,
        tax_amount=2000,
    )
    return order


@pytest.mark.anyio
class TestRefund:
    @pytest.mark.parametrize(
        ("has_billing_address", "tax_id", "error_message"),
        [
            (True, "invalid-vat-id", "Invalid tax ID."),
            (False, "FR40303265045", "Country is required to validate tax ID."),
        ],
    )
    async def test_tax_id_validation_error(
        self,
        backoffice_client: httpx.AsyncClient,
        order: Order,
        save_fixture: SaveFixture,
        mocker: MockerFixture,
        has_billing_address: bool,
        tax_id: str,
        error_message: str,
    ) -> None:
        order.customer.billing_address = None
        order.billing_address = (
            Address(country=CountryAlpha2("FR")) if has_billing_address else None
        )
        await save_fixture(order)
        create = mocker.patch("polar.backoffice.orders.endpoints.refund_service.create")

        response = await backoffice_client.post(
            f"/orders/{order.id}/refund",
            data={
                "reason": "vat_reverse_charge_correction",
                "amount": "10",
                "tax_id": tax_id,
            },
        )

        assert response.status_code == 200
        assert error_message in response.text
        assert "input-error" in response.text
        assert f'value="{tax_id}"' in response.text
        create.assert_not_awaited()

    async def test_dynamic_form(
        self,
        backoffice_client: httpx.AsyncClient,
        order: Order,
        save_fixture: SaveFixture,
    ) -> None:
        order.customer.tax_id = ("FR12345678901", TaxIDFormat.eu_vat)
        await save_fixture(order.customer)
        response = await backoffice_client.get(
            f"/orders/{order.id}/refund",
            params={"reason": "vat_reverse_charge_correction"},
        )
        assert response.status_code == 200
        assert "Tax amount to refund" in response.text
        assert 'name="tax_id"' in response.text
        assert 'value="FR12345678901"' in response.text
        assert 'name="revoke_benefits"' not in response.text
        assert 'hx-trigger="change"' in response.text
        response = await backoffice_client.get(
            f"/orders/{order.id}/refund", params={"reason": "tax_refund"}
        )
        assert 'name="tax_id"' not in response.text
        assert "Tax amount to refund" in response.text

    @pytest.mark.parametrize(
        ("reason", "amount", "tax"),
        [
            ("customer_request", 1000, 200),
            ("tax_refund", 0, 1000),
            ("vat_reverse_charge_correction", 0, 1000),
        ],
    )
    async def test_refund_split(
        self,
        backoffice_client: httpx.AsyncClient,
        order: Order,
        mocker: MockerFixture,
        reason: str,
        amount: int,
        tax: int,
    ) -> None:
        create = mocker.patch("polar.backoffice.orders.endpoints.refund_service.create")
        update = mocker.patch(
            "polar.backoffice.orders.endpoints.customer_service.update"
        )
        response = await backoffice_client.post(
            f"/orders/{order.id}/refund",
            data={
                "reason": reason,
                "amount": "10.00",
                "tax_id": "FR40303265045",
                "revoke_benefits": "true",
            },
        )
        assert response.status_code == 303
        assert create.call_args.kwargs["amount"] == amount
        assert create.call_args.kwargs["tax_amount"] == tax
        assert create.call_args.kwargs["revoke_benefits"] is (
            reason == "customer_request"
        )
        assert update.await_count == (
            1 if reason == "vat_reverse_charge_correction" else 0
        )

    @pytest.mark.parametrize(
        "data",
        [
            {"reason": "tax_refund", "amount": "20.01"},
            {"reason": "vat_reverse_charge_correction", "amount": "10"},
        ],
    )
    async def test_invalid_tax_refund(
        self,
        backoffice_client: httpx.AsyncClient,
        order: Order,
        mocker: MockerFixture,
        data: dict[str, str],
    ) -> None:
        create = mocker.patch("polar.backoffice.orders.endpoints.refund_service.create")
        response = await backoffice_client.post(f"/orders/{order.id}/refund", data=data)
        assert response.status_code == 200
        create.assert_not_awaited()

    async def test_vat_refund_updates_customer(
        self,
        backoffice_client: httpx.AsyncClient,
        order: Order,
        save_fixture: SaveFixture,
        mocker: MockerFixture,
    ) -> None:
        order.customer.billing_address = None
        order.billing_address = Address(country=CountryAlpha2("FR"))
        order.update_refunds(order.net_amount, 0)
        await save_fixture(order)
        create = mocker.patch("polar.backoffice.orders.endpoints.refund_service.create")
        response = await backoffice_client.post(
            f"/orders/{order.id}/refund",
            data={
                "reason": "vat_reverse_charge_correction",
                "amount": "10",
                "tax_id": "FR40303265045",
            },
        )
        assert response.status_code == 303
        assert order.customer.tax_id == ("FR40303265045", TaxIDFormat.eu_vat)
        assert order.tax_id is None
        assert create.call_args.kwargs["amount"] == 0


@pytest.mark.anyio
class TestCreditNote:
    async def test_credit_note_actions(
        self,
        backoffice_client: httpx.AsyncClient,
        order: Order,
        save_fixture: SaveFixture,
        mocker: MockerFixture,
    ) -> None:
        order.billing_name = "Original customer"
        order.billing_address = Address(country=CountryAlpha2("FR"))
        await save_fixture(order)
        payment = await create_payment(save_fixture, order.organization, order=order)
        refund = await create_refund(save_fixture, order, payment)
        mocker.patch(
            "polar.credit_note.service.render_credit_note_pdf", return_value=b"pdf"
        )
        mocker.patch("polar.credit_note.service.S3Service.upload")
        mocker.patch(
            "polar.credit_note.service.S3Service.generate_presigned_download_url",
            return_value=("https://example.com/credit-note.pdf", None),
        )
        path = f"/orders/{order.id}/refunds/{refund.id}/credit-note"
        response = await backoffice_client.get(f"/orders/{order.id}")
        assert response.status_code == 200
        assert "Refunds" in response.text
        assert "Generate credit note" in response.text
        assert "Download credit note" not in response.text
        response = await backoffice_client.post(path)
        assert response.status_code == 303
        response = await backoffice_client.get(f"/orders/{order.id}")
        assert "Download credit note" in response.text
        assert "Generate credit note" not in response.text
        response = await backoffice_client.get(f"{path}/download")
        assert response.status_code == 303
        assert response.headers["location"] == "https://example.com/credit-note.pdf"
        response = await backoffice_client.post(
            f"/orders/{uuid.uuid4()}/refunds/{refund.id}/credit-note"
        )
        assert response.status_code == 404
