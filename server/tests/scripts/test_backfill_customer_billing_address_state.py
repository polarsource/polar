import pytest
from sqlalchemy import text

from polar.kit.address import Address
from polar.kit.db.postgres import AsyncSession
from polar.kit.utils import utc_now
from polar.models import Organization
from scripts.backfill_customer_billing_address_state import (
    apply_corrections,
    plan_corrections,
    resolve_state,
)
from tests.fixtures.database import SaveFixture
from tests.fixtures.random_objects import create_customer


@pytest.mark.parametrize(
    ("country", "state", "expected"),
    [
        ("BR", "SP", "SP"),
        ("BR", "sp", "SP"),
        ("BR", "São Paulo", "SP"),
        ("BR", "SAO PAULO", "SP"),
        ("BR", "São Paulo/SP", "SP"),
        ("BR", "Cotia/SP", "SP"),
        ("BR", "Mato Grosso do Sul", "MS"),
        ("BR", "Recife", "PE"),
        ("BR", "Florida", None),
        ("BR", "78557682", None),
        ("IN", "Mahārāshtra", "MH"),
        ("IN", "Tamilnadu", "TN"),
        ("IN", "J&K", "JK"),
        ("IN", "TG", "TS"),
        ("IN", "OR", "OD"),
        ("IN", "UT", "UK"),
        ("IN", "CT", "CG"),
        ("IN", "RJ", "RJ"),
        ("IN", "मध्य प्रदेश", None),
        ("IN", "Select an option…", None),
    ],
)
def test_resolve_state(country: str, state: str, expected: str | None) -> None:
    assert resolve_state(country, state) == expected


@pytest.mark.anyio
class TestBackfillCustomerBillingAddressState:
    async def test_corrects_states(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        organization: Organization,
    ) -> None:
        async def customer(
            country: str, state: str | None, *, deleted: bool = False
        ) -> str:
            created = await create_customer(
                save_fixture,
                organization=organization,
                email=f"{country}-{state}-{deleted}@example.com".lower(),
                billing_address=Address.model_validate(
                    {"country": country, "state": state, "city": "City"}
                ),
            )
            if deleted:
                created.deleted_at = utc_now()
                await save_fixture(created)
            return str(created.id)

        named = await customer("BR", "São Paulo")
        coded = await customer("BR", "SP")
        junk = await customer("IN", "Heaven")
        legacy = await customer("IN", "TG")
        other_country = await customer("FR", "Bretagne")
        deleted = await customer("IN", "Karnataka", deleted=True)

        corrections, unchanged = await plan_corrections(session)
        updated = await apply_corrections(session, corrections, batch_size=1)

        assert unchanged == 1
        assert updated == 3

        session.expire_all()
        result = await session.execute(
            text("SELECT id::text, billing_address FROM customers")
        )
        addresses = {row[0]: row[1] for row in result}
        assert addresses[named] == {"country": "BR", "state": "SP", "city": "City"}
        assert addresses[coded] == {"country": "BR", "state": "SP", "city": "City"}
        assert addresses[junk] == {"country": "IN", "city": "City"}
        assert addresses[legacy] == {"country": "IN", "state": "TS", "city": "City"}
        assert addresses[other_country]["state"] == "Bretagne"
        assert addresses[deleted]["state"] == "Karnataka"
