import uuid
from datetime import UTC, datetime

import pytest
from httpx import AsyncClient

from polar.auth.models import AuthSubject
from polar.models import (
    Account,
    Organization,
    PayoutAccount,
    Transaction,
    User,
    UserOrganization,
)
from polar.models.payout_attempt import PayoutAttemptStatus
from polar.models.transaction import PlatformFeeType, TransactionType
from polar.models.user_organization import OrganizationRole
from tests.fixtures.auth import AuthSubjectFixture
from tests.fixtures.database import SaveFixture
from tests.fixtures.random_objects import create_payout
from tests.transaction.conftest import create_transaction


@pytest.mark.asyncio
class TestSearchTransactions:
    async def test_anonymous(self, client: AsyncClient) -> None:
        response = await client.get("/v1/transactions/search")

        assert response.status_code == 401

    @pytest.mark.auth
    async def test_valid(
        self,
        client: AsyncClient,
        account: Account,
        user_organization: UserOrganization,
        readable_user_transactions: list[Transaction],
        all_transactions: list[Transaction],
    ) -> None:
        response = await client.get("/v1/transactions/search")

        assert response.status_code == 200

        json = response.json()
        assert json["pagination"]["total_count"] == len(readable_user_transactions)

    @pytest.mark.auth
    async def test_organization_scoped_session(
        self,
        save_fixture: SaveFixture,
        client: AsyncClient,
        auth_subject: AuthSubject[User],
        user: User,
        organization: Organization,
        organization_second: Organization,
        user_organization: UserOrganization,
    ) -> None:
        # Member (admin → finance:read) of the second org too.
        await save_fixture(
            UserOrganization(
                user=user,
                organization=organization_second,
                role=OrganizationRole.admin,
            )
        )
        transaction = await create_transaction(
            save_fixture, payment_organization=organization
        )
        transaction_second = await create_transaction(
            save_fixture, payment_organization=organization_second
        )

        # Unscoped session sees both organizations' transactions.
        response = await client.get("/v1/transactions/search")
        assert response.status_code == 200
        ids = {item["id"] for item in response.json()["items"]}
        assert {str(transaction.id), str(transaction_second.id)} <= ids

        # Down-scoping the session to one org hides the other org's transactions.
        auth_subject.organization_ids = frozenset({organization.id})
        response = await client.get("/v1/transactions/search")
        assert response.status_code == 200
        ids = {item["id"] for item in response.json()["items"]}
        assert str(transaction.id) in ids
        assert str(transaction_second.id) not in ids


@pytest.mark.asyncio
class TestGetSummary:
    async def test_anonymous(self, client: AsyncClient) -> None:
        response = await client.get(
            "/v1/transactions/summary", params={"account_id": str(uuid.uuid4())}
        )

        assert response.status_code == 401

    @pytest.mark.auth
    async def test_not_existing_account(self, client: AsyncClient) -> None:
        response = await client.get(
            "/v1/transactions/summary", params={"account_id": str(uuid.uuid4())}
        )

        assert response.status_code == 404

    @pytest.mark.auth(AuthSubjectFixture(subject="user_second"))
    async def test_member_without_finance_read(
        self,
        client: AsyncClient,
        save_fixture: SaveFixture,
        account: Account,
        user_organization_second: UserOrganization,
        account_transactions: list[Transaction],
    ) -> None:
        # A regular member (no `finance:read` permission) must not be able to
        # access the financial summary of the org's account.
        user_organization_second.role = OrganizationRole.member
        await save_fixture(user_organization_second)

        response = await client.get(
            "/v1/transactions/summary", params={"account_id": str(account.id)}
        )

        assert response.status_code == 404

    @pytest.mark.auth
    async def test_valid(
        self,
        client: AsyncClient,
        account: Account,
        user_organization: UserOrganization,
        account_transactions: list[Transaction],
    ) -> None:
        response = await client.get(
            "/v1/transactions/summary", params={"account_id": str(account.id)}
        )

        assert response.status_code == 200

        json = response.json()
        assert "balance" in json
        assert "payout" in json


EXPORT_DEFAULT_HEADER = "Date,Description,Gross,Fees,Tax,Net,Status,Payout Date"


@pytest.mark.asyncio
class TestExportTransactions:
    async def test_anonymous(self, client: AsyncClient) -> None:
        response = await client.get("/v1/transactions/export")

        assert response.status_code == 401

    @pytest.mark.auth(AuthSubjectFixture(subject="user_second"))
    async def test_user_not_account_member(
        self,
        client: AsyncClient,
        account: Account,
        account_transactions: list[Transaction],
    ) -> None:
        response = await client.get(
            "/v1/transactions/export", params={"account_id": str(account.id)}
        )

        assert response.status_code == 200
        assert response.headers["content-type"] == "text/csv; charset=utf-8"
        csv_lines = response.text.strip().split("\r\n")
        assert csv_lines == [EXPORT_DEFAULT_HEADER]

    @pytest.mark.auth
    async def test_user_valid(
        self,
        client: AsyncClient,
        account: Account,
        user_organization: UserOrganization,
        account_transactions: list[Transaction],
    ) -> None:
        response = await client.get(
            "/v1/transactions/export",
            params={"account_id": str(account.id), "type": "balance"},
        )

        assert response.status_code == 200
        assert response.headers["content-type"] == "text/csv; charset=utf-8"
        assert (
            response.headers["content-disposition"]
            == 'attachment; filename="polar-income.csv"'
        )

        csv_lines = response.text.strip().split("\r\n")
        balance_count = sum(
            1 for tx in account_transactions if tx.type == TransactionType.balance
        )
        assert csv_lines[0] == EXPORT_DEFAULT_HEADER
        assert len(csv_lines) == balance_count + 1

    @pytest.mark.auth
    async def test_filter_by_date_range(
        self,
        save_fixture: SaveFixture,
        client: AsyncClient,
        account: Account,
        user_organization: UserOrganization,
    ) -> None:
        await create_transaction(
            save_fixture,
            account=account,
            created_at=datetime(2024, 1, 15, tzinfo=UTC),
        )
        await create_transaction(
            save_fixture,
            account=account,
            created_at=datetime(2024, 6, 15, tzinfo=UTC),
        )

        response = await client.get(
            "/v1/transactions/export",
            params={
                "account_id": str(account.id),
                "created_after": "2024-06-01T00:00:00Z",
                "created_before": "2024-06-30T23:59:59Z",
            },
        )

        assert response.status_code == 200
        assert (
            response.headers["content-disposition"]
            == 'attachment; filename="polar-income-2024-06-01-2024-06-30.csv"'
        )
        csv_lines = response.text.strip().split("\r\n")
        assert len(csv_lines) == 2
        assert "2024-06-15" in csv_lines[1]
        assert "2024-01-15" not in response.text

    @pytest.mark.auth
    async def test_naive_date_bounds(
        self,
        client: AsyncClient,
        user_organization: UserOrganization,
    ) -> None:
        response = await client.get(
            "/v1/transactions/export",
            params={"created_after": "2024-06-01T00:00:00"},
        )

        assert response.status_code == 422

    @pytest.mark.auth
    async def test_custom_columns(
        self,
        client: AsyncClient,
        account: Account,
        user_organization: UserOrganization,
        account_transactions: list[Transaction],
    ) -> None:
        response = await client.get(
            "/v1/transactions/export",
            params={
                "account_id": str(account.id),
                "columns": ["description", "net_amount", "payout_date", "status"],
            },
        )

        assert response.status_code == 200
        csv_lines = response.text.strip().split("\r\n")
        assert csv_lines[0] == "Description,Net,Payout Date,Status"

    @pytest.mark.auth
    async def test_invalid_column(
        self,
        client: AsyncClient,
        user_organization: UserOrganization,
    ) -> None:
        response = await client.get(
            "/v1/transactions/export", params={"columns": ["not_a_column"]}
        )

        assert response.status_code == 422

    @pytest.mark.auth
    async def test_timezone(
        self,
        save_fixture: SaveFixture,
        client: AsyncClient,
        account: Account,
        user_organization: UserOrganization,
    ) -> None:
        await create_transaction(
            save_fixture,
            account=account,
            created_at=datetime(2024, 6, 15, 23, 0, tzinfo=UTC),
        )

        response = await client.get(
            "/v1/transactions/export",
            params={"account_id": str(account.id), "timezone": "Europe/Stockholm"},
        )

        assert response.status_code == 200
        csv_lines = response.text.strip().split("\r\n")
        assert "2024-06-16T01:00:00+02:00" in csv_lines[1]

    @pytest.mark.auth
    async def test_invalid_timezone(
        self,
        client: AsyncClient,
        user_organization: UserOrganization,
    ) -> None:
        response = await client.get(
            "/v1/transactions/export", params={"timezone": "Not/AZone"}
        )

        assert response.status_code == 422

    @pytest.mark.auth
    async def test_payout_date(
        self,
        save_fixture: SaveFixture,
        client: AsyncClient,
        account: Account,
        user_organization: UserOrganization,
        stripe_payout_account: PayoutAccount,
    ) -> None:
        payout_transaction = await create_transaction(
            save_fixture,
            type=TransactionType.payout,
            account=account,
            amount=-1000,
        )
        payout = await create_payout(
            save_fixture,
            payout_account=stripe_payout_account,
            account=account,
            transaction=payout_transaction,
            attempts=[PayoutAttemptStatus.succeeded],
        )
        paid_at = datetime(2024, 7, 1, 12, 0, tzinfo=UTC)
        payout.attempts[0].paid_at = paid_at
        await save_fixture(payout.attempts[0])

        await create_transaction(
            save_fixture,
            type=TransactionType.balance,
            account=account,
            payout_transaction=payout_transaction,
        )

        response = await client.get(
            "/v1/transactions/export",
            params={
                "account_id": str(account.id),
                "type": "balance",
                "columns": ["status", "payout_date"],
            },
        )

        assert response.status_code == 200
        csv_lines = response.text.strip().split("\r\n")
        assert csv_lines[0] == "Status,Payout Date"
        assert len(csv_lines) == 2
        assert csv_lines[1] == f"Paid out,{paid_at.isoformat()}"

    @pytest.mark.auth
    async def test_exclude_platform_fees(
        self,
        save_fixture: SaveFixture,
        client: AsyncClient,
        account: Account,
        user_organization: UserOrganization,
    ) -> None:
        included = await create_transaction(save_fixture, account=account)
        await create_transaction(
            save_fixture,
            account=account,
            platform_fee_type=PlatformFeeType.payment,
        )

        response = await client.get(
            "/v1/transactions/export",
            params={
                "account_id": str(account.id),
                "exclude_platform_fees": True,
                "columns": ["description"],
            },
        )

        assert response.status_code == 200
        csv_lines = response.text.strip().split("\r\n")
        assert len(csv_lines) == 2
        assert csv_lines[1] == str(included.type)
