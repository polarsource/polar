import uuid

import pytest
from httpx import AsyncClient
from pytest_mock import MockerFixture

from polar.models import (
    Account,
    Organization,
    Pledge,
    Transaction,
    User,
    UserOrganization,
)
from polar.models.transaction import PaymentProcessor, TransactionType
from polar.postgres import AsyncSession
from polar.transaction.endpoints import (  # type: ignore[attr-defined]
    payout_transaction_service,
)
from polar.transaction.service.payout import PayoutTransactionService
from tests.fixtures.database import SaveFixture
from tests.transaction.conftest import create_account, create_transaction


@pytest.mark.asyncio
@pytest.mark.http_auto_expunge
class TestSearchTransactions:
    async def test_anonymous(self, client: AsyncClient) -> None:
        response = await client.get("/api/v1/transactions/search")

        assert response.status_code == 401

    @pytest.mark.authenticated
    async def test_valid(
        self,
        client: AsyncClient,
        account: Account,
        user_organization: UserOrganization,
        readable_user_transactions: list[Transaction],
        all_transactions: list[Transaction],
    ) -> None:
        response = await client.get("/api/v1/transactions/search")

        assert response.status_code == 200

        json = response.json()
        assert json["pagination"]["total_count"] == len(readable_user_transactions)


@pytest.mark.asyncio
@pytest.mark.http_auto_expunge
class TestLookupTransaction:
    async def test_anonymous(self, client: AsyncClient) -> None:
        response = await client.get(
            "/api/v1/transactions/lookup", params={"transaction_id": str(uuid.uuid4())}
        )

        assert response.status_code == 401

    @pytest.mark.authenticated
    async def test_transaction_payout(
        self,
        save_fixture: SaveFixture,
        account: Account,
        user_organization: UserOrganization,
        pledge: Pledge,
        client: AsyncClient,
    ) -> None:
        transaction = await create_transaction(
            save_fixture, type=TransactionType.payout, account=account, pledge=pledge
        )

        paid_transactions = [
            await create_transaction(
                save_fixture, account=account, payout_transaction=transaction
            ),
            await create_transaction(
                save_fixture, account=account, payout_transaction=transaction
            ),
            await create_transaction(
                save_fixture, account=account, payout_transaction=transaction
            ),
        ]

        response = await client.get(
            "/api/v1/transactions/lookup",
            params={"transaction_id": str(transaction.id)},
        )

        assert response.status_code == 200

        json = response.json()
        assert json["id"] == str(transaction.id)
        assert len(json["paid_transactions"]) == len(paid_transactions)


@pytest.mark.asyncio
@pytest.mark.http_auto_expunge
class TestGetSummary:
    async def test_anonymous(self, client: AsyncClient) -> None:
        response = await client.get(
            "/api/v1/transactions/summary", params={"account_id": str(uuid.uuid4())}
        )

        assert response.status_code == 401

    @pytest.mark.authenticated
    async def test_not_existing_account(self, client: AsyncClient) -> None:
        response = await client.get(
            "/api/v1/transactions/summary", params={"account_id": str(uuid.uuid4())}
        )

        assert response.status_code == 404

    @pytest.mark.authenticated
    async def test_valid(
        self,
        client: AsyncClient,
        account: Account,
        user_organization: UserOrganization,
        account_transactions: list[Transaction],
    ) -> None:
        response = await client.get(
            "/api/v1/transactions/summary", params={"account_id": str(account.id)}
        )

        assert response.status_code == 200

        json = response.json()
        assert "balance" in json
        assert "payout" in json


@pytest.mark.asyncio
@pytest.mark.http_auto_expunge
class TestCreatePayout:
    async def test_anonymous(self, client: AsyncClient) -> None:
        response = await client.post(
            "/api/v1/transactions/payouts", json={"account_id": str(uuid.uuid4())}
        )

        assert response.status_code == 401

    @pytest.mark.authenticated
    async def test_not_existing_account(self, client: AsyncClient) -> None:
        response = await client.post(
            "/api/v1/transactions/payouts", json={"account_id": str(uuid.uuid4())}
        )

        assert response.status_code == 404

    @pytest.mark.authenticated
    async def test_not_permitted(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        client: AsyncClient,
        organization: Organization,
        user_second: User,
    ) -> None:
        account = await create_account(save_fixture, organization, user_second)
        response = await client.post(
            "/api/v1/transactions/payouts", json={"account_id": str(account.id)}
        )

        # then
        session.expunge_all()

        assert response.status_code == 403

    @pytest.mark.authenticated
    async def test_valid(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        mocker: MockerFixture,
        client: AsyncClient,
        account: Account,
        user_organization: UserOrganization,
    ) -> None:
        payout = Transaction(
            type=TransactionType.payout,
            processor=PaymentProcessor.open_collective,
            currency="usd",  # FIXME: Main Polar currency
            amount=-1000,
            account_currency=account.currency,
            account_amount=-1000,
            tax_amount=0,
            account=account,
            pledge=None,
            issue_reward=None,
            subscription=None,
            subscription_tier_price=None,
            account_incurred_transactions=[],
        )
        await save_fixture(payout)

        mocker.patch.object(
            payout_transaction_service,
            "create_payout",
            spec=PayoutTransactionService.create_payout,
            return_value=payout,
        )

        # then
        session.expunge_all()

        response = await client.post(
            "/api/v1/transactions/payouts", json={"account_id": str(account.id)}
        )

        assert response.status_code == 201
