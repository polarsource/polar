import re
import uuid
from collections.abc import AsyncGenerator
from datetime import UTC, datetime, timedelta

import httpx
import pytest
import pytest_asyncio
from pytest_mock import MockerFixture

from polar.backoffice import app as backoffice_app
from polar.backoffice.dependencies import get_admin
from polar.models import Customer, User, WalletTransaction
from polar.models.user_session import UserSession
from polar.postgres import AsyncSession, get_db_read_session, get_db_session
from polar.wallet.service import wallet as wallet_service
from tests.fixtures.database import SaveFixture
from tests.fixtures.random_objects import create_order, create_payment, create_refund


@pytest_asyncio.fixture
async def backoffice_client(
    session: AsyncSession, user: User
) -> AsyncGenerator[httpx.AsyncClient, None]:
    user_session = UserSession(token="0" * 64, user_agent="tests", user=user)
    backoffice_app.dependency_overrides[get_db_session] = lambda: session
    backoffice_app.dependency_overrides[get_db_read_session] = lambda: session
    backoffice_app.dependency_overrides[get_admin] = lambda: user_session
    try:
        async with httpx.AsyncClient(
            transport=httpx.ASGITransport(app=backoffice_app),
            base_url="http://test",
        ) as client:
            yield client
    finally:
        backoffice_app.dependency_overrides.pop(get_db_session, None)
        backoffice_app.dependency_overrides.pop(get_db_read_session, None)
        backoffice_app.dependency_overrides.pop(get_admin, None)


@pytest.mark.asyncio
class TestCreateBalanceTransaction:
    async def test_returns_404_for_unknown_customer(
        self, backoffice_client: httpx.AsyncClient
    ) -> None:
        response = await backoffice_client.get(
            f"/customers/{uuid.uuid4()}/balance-transactions/create"
        )

        assert response.status_code == 404

    async def test_get_renders_form(
        self,
        backoffice_client: httpx.AsyncClient,
        customer: Customer,
    ) -> None:
        response = await backoffice_client.get(
            f"/customers/{customer.id}/balance-transactions/create"
        )

        assert response.status_code == 200
        assert "Create Balance Transaction" in response.text
        assert 'name="amount"' in response.text
        assert 'name="currency"' in response.text
        assert 'value="usd" selected' in response.text

    @pytest.mark.parametrize(
        ("amount", "currency", "expected_amount"),
        [
            ("-12.34", "usd", -1234),
            ("125", "jpy", 125),
            ("92233720368547758.07", "usd", 2**63 - 1),
            ("-92233720368547758.08", "usd", -(2**63)),
        ],
    )
    async def test_post_creates_balance_transaction(
        self,
        amount: str,
        currency: str,
        expected_amount: int,
        backoffice_client: httpx.AsyncClient,
        session: AsyncSession,
        customer: Customer,
        mocker: MockerFixture,
    ) -> None:
        create_balance_transaction_mock = mocker.patch.object(
            wallet_service,
            "create_balance_transaction",
            new=mocker.AsyncMock(),
        )

        response = await backoffice_client.post(
            f"/customers/{customer.id}/balance-transactions/create",
            data={"amount": amount, "currency": currency},
        )

        assert response.status_code == 303
        create_balance_transaction_mock.assert_awaited_once_with(
            session,
            customer,
            expected_amount,
            currency,
        )

    @pytest.mark.parametrize(
        ("amount", "currency", "error_message"),
        [
            ("0", "usd", "Amount must not be zero"),
            ("1.001", "usd", "Amount must have at most 2 decimal places"),
            ("1.1", "jpy", "Amount must have at most 0 decimal places"),
            ("1", "invalid", "Input should be"),
            ("Infinity", "usd", "finite number"),
            ("92233720368547758.08", "usd", "less than or equal"),
            ("-92233720368547758.09", "usd", "greater than or equal"),
            ("9223372036854775808", "jpy", "less than or equal"),
            ("-9223372036854775809", "jpy", "greater than or equal"),
            ("1e1000000", "usd", "less than or equal"),
        ],
    )
    async def test_post_rejects_invalid_form(
        self,
        amount: str,
        currency: str,
        error_message: str,
        backoffice_client: httpx.AsyncClient,
        customer: Customer,
        mocker: MockerFixture,
    ) -> None:
        create_balance_transaction_mock = mocker.patch.object(
            wallet_service,
            "create_balance_transaction",
            new=mocker.AsyncMock(),
        )

        response = await backoffice_client.post(
            f"/customers/{customer.id}/balance-transactions/create",
            data={"amount": amount, "currency": currency},
        )

        assert response.status_code == 200
        assert error_message in response.text
        create_balance_transaction_mock.assert_not_awaited()


@pytest.mark.asyncio
class TestCreditBalance:
    async def test_displays_all_billing_wallet_currencies(
        self,
        backoffice_client: httpx.AsyncClient,
        session: AsyncSession,
        customer: Customer,
    ) -> None:
        await wallet_service.create_balance_transaction(session, customer, 1234, "usd")
        await wallet_service.create_balance_transaction(session, customer, -500, "eur")
        await session.flush()

        response = await backoffice_client.get(f"/customers/{customer.id}")

        assert response.status_code == 200
        assert "Add Transaction" in response.text
        assert "USD" in response.text
        assert "$12.34" in response.text
        assert "EUR" in response.text
        assert "€5.00" in response.text
        assert f"/customers/{customer.id}/wallets/" in response.text

    async def test_displays_usd_zero_balance_without_wallets(
        self,
        backoffice_client: httpx.AsyncClient,
        customer: Customer,
    ) -> None:
        response = await backoffice_client.get(f"/customers/{customer.id}")

        assert response.status_code == 200
        assert "USD" in response.text
        assert "$0.00" in response.text

    async def test_hides_add_transaction_for_deleted_customer(
        self,
        backoffice_client: httpx.AsyncClient,
        session: AsyncSession,
        customer: Customer,
    ) -> None:
        customer.deleted_at = datetime.now(UTC)
        await session.flush()

        response = await backoffice_client.get(f"/customers/{customer.id}")

        assert response.status_code == 200
        assert "Credit Balance" in response.text
        assert "Add Transaction" not in response.text


@pytest.mark.asyncio
class TestWalletTransactions:
    async def test_displays_transactions_newest_first_with_references(
        self,
        backoffice_client: httpx.AsyncClient,
        session: AsyncSession,
        save_fixture: SaveFixture,
        customer: Customer,
    ) -> None:
        order = await create_order(save_fixture, customer=customer)
        payment = await create_payment(
            save_fixture,
            customer.organization,
            order=order,
        )
        refund = await create_refund(save_fixture, order, payment)

        order_transaction = await wallet_service.create_balance_transaction(
            session,
            customer,
            1000,
            "usd",
            order=order,
        )
        order_transaction.timestamp = datetime.now(UTC) - timedelta(days=1)
        refund_transaction = WalletTransaction(
            currency="usd",
            amount=-500,
            wallet=order_transaction.wallet,
            refund=refund,
            timestamp=datetime.now(UTC),
        )
        await save_fixture(refund_transaction)
        await session.flush()

        response = await backoffice_client.get(
            f"/customers/{customer.id}/wallets/"
            f"{order_transaction.wallet_id}/transactions"
        )

        assert response.status_code == 200
        assert "USD Balance Transactions" in response.text
        assert "Created" in response.text
        assert "Amount" in response.text
        refund_reference = f"Refund {refund.id}"
        order_reference = f"Order {order.id}"
        assert response.text.index(refund_reference) < response.text.index(
            order_reference
        )
        assert response.text.count(f"/orders/{order.id}") == 2

    async def test_paginates_transactions(
        self,
        backoffice_client: httpx.AsyncClient,
        session: AsyncSession,
        customer: Customer,
    ) -> None:
        transactions: list[WalletTransaction] = []
        timestamp = datetime.now(UTC) - timedelta(days=1)
        for index in range(11):
            transaction = await wallet_service.create_balance_transaction(
                session,
                customer,
                100 + index,
                "usd",
            )
            transaction.timestamp = timestamp + timedelta(minutes=index)
            transactions.append(transaction)
        await session.flush()

        wallet_id = transactions[0].wallet_id
        first_page = await backoffice_client.get(
            f"/customers/{customer.id}/wallets/{wallet_id}/transactions"
        )

        assert first_page.status_code == 200
        first_page_text = re.sub(r"<[^>]+>", "", first_page.text)
        assert "Showing 1 to 10 of 11 entries" in first_page_text
        assert "$1.10" in first_page.text
        assert "$1.00" not in first_page.text
        assert 'hx-target="#modal"' in first_page.text

        second_page = await backoffice_client.get(
            f"/customers/{customer.id}/wallets/{wallet_id}/transactions",
            params={"page": 2},
        )

        assert second_page.status_code == 200
        second_page_text = re.sub(r"<[^>]+>", "", second_page.text)
        assert "Showing 11 to 11 of 11 entries" in second_page_text
        assert "$1.00" in second_page.text
        assert "$1.10" not in second_page.text

    async def test_returns_404_for_wallet_from_another_customer(
        self,
        backoffice_client: httpx.AsyncClient,
        session: AsyncSession,
        save_fixture: SaveFixture,
        customer: Customer,
    ) -> None:
        other_customer = Customer(
            organization=customer.organization,
            email="other-customer@example.com",
            name="Other Customer",
        )
        await save_fixture(other_customer)
        transaction = await wallet_service.create_balance_transaction(
            session,
            other_customer,
            1000,
            "usd",
        )
        await session.flush()

        response = await backoffice_client.get(
            f"/customers/{customer.id}/wallets/{transaction.wallet_id}/transactions"
        )

        assert response.status_code == 404
