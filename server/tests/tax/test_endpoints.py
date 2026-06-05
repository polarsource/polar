import pytest
import pytest_asyncio
from httpx import AsyncClient

from polar.auth.scope import Scope
from polar.models import (
    Customer,
    Order,
    Organization,
    Product,
    Transaction,
    UserOrganization,
)
from polar.models.transaction import Processor, TransactionType
from tests.fixtures.auth import AuthSubjectFixture
from tests.fixtures.database import SaveFixture
from tests.fixtures.random_objects import create_order


async def create_tax_transaction(
    save_fixture: SaveFixture,
    *,
    organization: Organization,
    order: Order,
    tax_amount: int,
    tax_country: str,
    tax_state: str | None,
    type: TransactionType = TransactionType.payment,
    currency: str = "usd",
) -> Transaction:
    transaction = Transaction(
        type=type,
        account=None,
        processor=Processor.stripe,
        currency=currency,
        amount=tax_amount,
        account_currency=currency,
        account_amount=tax_amount,
        tax_amount=tax_amount,
        tax_country=tax_country,
        tax_state=tax_state,
        payment_organization_id=organization.id,
        order=order,
    )
    await save_fixture(transaction)
    return transaction


@pytest_asyncio.fixture
async def tax_transactions(
    save_fixture: SaveFixture,
    organization: Organization,
    product: Product,
    customer: Customer,
) -> None:
    # Helper: each transaction needs a distinct, non-null order so order_count
    # reflects the number of orders per jurisdiction.
    async def order() -> Order:
        return await create_order(save_fixture, product=product, customer=customer)

    # US / California: two payments and one refund (net 100 + 50 - 30 = 120).
    await create_tax_transaction(
        save_fixture,
        organization=organization,
        order=await order(),
        tax_amount=100,
        tax_country="US",
        tax_state="CA",
    )
    await create_tax_transaction(
        save_fixture,
        organization=organization,
        order=await order(),
        tax_amount=50,
        tax_country="US",
        tax_state="CA",
    )
    await create_tax_transaction(
        save_fixture,
        organization=organization,
        order=await order(),
        tax_amount=-30,
        tax_country="US",
        tax_state="CA",
        type=TransactionType.refund,
    )

    # US / New York: a separate state-level jurisdiction.
    await create_tax_transaction(
        save_fixture,
        organization=organization,
        order=await order(),
        tax_amount=80,
        tax_country="US",
        tax_state="NY",
    )

    # United Kingdom: country-level only (tax_state must be ignored).
    await create_tax_transaction(
        save_fixture,
        organization=organization,
        order=await order(),
        tax_amount=200,
        tax_country="GB",
        tax_state=None,
    )
    await create_tax_transaction(
        save_fixture,
        organization=organization,
        order=await order(),
        tax_amount=100,
        tax_country="GB",
        tax_state=None,
    )


@pytest.mark.asyncio
class TestListTaxJurisdictions:
    async def test_anonymous(self, client: AsyncClient) -> None:
        response = await client.get("/v1/taxes/jurisdictions")
        assert response.status_code == 401

    @pytest.mark.auth
    async def test_user_not_organization_member(
        self, client: AsyncClient, tax_transactions: None
    ) -> None:
        response = await client.get("/v1/taxes/jurisdictions")
        assert response.status_code == 200
        json = response.json()
        assert json["pagination"]["total_count"] == 0

    @pytest.mark.auth(AuthSubjectFixture(scopes={Scope.orders_read}))
    async def test_user_valid(
        self,
        client: AsyncClient,
        user_organization: UserOrganization,
        tax_transactions: None,
    ) -> None:
        response = await client.get(
            "/v1/taxes/jurisdictions", params={"sorting": "-tax_amount"}
        )
        assert response.status_code == 200
        json = response.json()

        # Three jurisdictions: US-CA, US-NY (state level), GB (country level).
        assert json["pagination"]["total_count"] == 3
        items = {item["id"]: item for item in json["items"]}
        assert set(items) == {"US-CA", "US-NY", "GB"}

        us_ca = items["US-CA"]
        assert us_ca["country"] == "US"
        assert us_ca["state"] == "CA"
        assert us_ca["state_name"] == "California"
        assert us_ca["tax_amount"] == 120  # 100 + 50 - 30 (refund netted out)
        assert us_ca["order_count"] == 3

        us_ny = items["US-NY"]
        assert us_ny["state"] == "NY"
        assert us_ny["tax_amount"] == 80

        gb = items["GB"]
        assert gb["country"] == "GB"
        assert gb["country_name"] == "United Kingdom"
        assert gb["state"] is None
        assert gb["state_name"] is None
        assert gb["tax_amount"] == 300  # 200 + 100, grouped by country
        assert gb["order_count"] == 2

        # Default sort is by net tax remitted, descending.
        assert [item["id"] for item in json["items"]] == ["GB", "US-CA", "US-NY"]


@pytest.mark.asyncio
class TestGetTaxSummary:
    async def test_anonymous(self, client: AsyncClient) -> None:
        response = await client.get("/v1/taxes/summary")
        assert response.status_code == 401

    @pytest.mark.auth
    async def test_user_not_organization_member(
        self, client: AsyncClient, tax_transactions: None
    ) -> None:
        response = await client.get("/v1/taxes/summary")
        assert response.status_code == 200
        json = response.json()
        assert json["tax_amount"] == 0
        assert json["order_count"] == 0
        assert json["jurisdiction_count"] == 0

    @pytest.mark.auth(AuthSubjectFixture(scopes={Scope.orders_read}))
    async def test_user_valid(
        self,
        client: AsyncClient,
        user_organization: UserOrganization,
        tax_transactions: None,
    ) -> None:
        response = await client.get("/v1/taxes/summary")
        assert response.status_code == 200
        json = response.json()

        # Totals span every jurisdiction, not just a single page:
        # tax = 120 (US-CA) + 80 (US-NY) + 300 (GB)
        assert json["tax_amount"] == 500
        # orders = 3 (US-CA) + 1 (US-NY) + 2 (GB), no double counting
        assert json["order_count"] == 6
        assert json["jurisdiction_count"] == 3
        # Representative currency comes from the largest tax bucket (GB).
        assert json["currency"] == "usd"
