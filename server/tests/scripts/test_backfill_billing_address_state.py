import pytest
from sqlalchemy import text

from polar.kit.address import Address
from polar.kit.db.postgres import AsyncSession
from polar.kit.utils import utc_now
from polar.models import CreditNote, Customer, Organization, Product, User
from polar.models.credit_note import CreditNoteReason
from scripts.backfill_billing_address_state import (
    Target,
    apply_corrections,
    plan_corrections,
    resolve_state,
)
from tests.fixtures.database import SaveFixture
from tests.fixtures.random_objects import (
    create_account,
    create_checkout,
    create_customer,
    create_order,
)


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


def address(country: str, state: str | None) -> Address:
    return Address.model_validate({"country": country, "state": state, "city": "City"})


async def stored_addresses(
    session: AsyncSession, table: str, column: str = "billing_address"
) -> dict[str, dict[str, str]]:
    session.expire_all()
    result = await session.execute(text(f"SELECT id::text, {column} FROM {table}"))
    return {row[0]: row[1] for row in result}


@pytest.mark.anyio
class TestBackfillBillingAddressState:
    async def test_customers(
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
                billing_address=address(country, state),
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

        plan = await plan_corrections(session, [Target.customer])
        updated = await apply_corrections(session, plan.corrections, batch_size=1)

        assert plan.unchanged == 1
        assert not plan.unresolved
        assert updated == {Target.customer: 3}

        addresses = await stored_addresses(session, "customers")
        assert addresses[named] == {"country": "BR", "state": "SP", "city": "City"}
        assert addresses[coded] == {"country": "BR", "state": "SP", "city": "City"}
        assert addresses[junk] == {"country": "IN", "city": "City"}
        assert addresses[legacy] == {"country": "IN", "state": "TS", "city": "City"}
        assert addresses[other_country]["state"] == "Bretagne"
        assert addresses[deleted]["state"] == "Karnataka"

    async def test_other_targets_keep_unresolved_states(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        customer: Customer,
        product: Product,
        user: User,
    ) -> None:
        named_order = await create_order(
            save_fixture, customer=customer, billing_address=address("BR", "São Paulo")
        )
        junk_order = await create_order(
            save_fixture, customer=customer, billing_address=address("IN", "Heaven")
        )
        credit_notes = [
            CreditNote(
                number=f"CN-{index}",
                currency="usd",
                reason=CreditNoteReason.customer_request,
                amount=1000,
                tax_amount=0,
                billing_address=address("IN", state),
                order_id=named_order.id,
            )
            for index, state in enumerate(("Tamilnadu", "Heaven"))
        ]
        for credit_note in credit_notes:
            await save_fixture(credit_note)
        named_credit_note, junk_credit_note = credit_notes
        checkout = await create_checkout(
            save_fixture,
            products=[product],
            customer_billing_address=address("BR", "Recife"),
        )
        account = await create_account(
            save_fixture, user, billing_address=address("IN", "Heaven")
        )

        named_order_id, junk_order_id = str(named_order.id), str(junk_order.id)
        named_credit_note_id = str(named_credit_note.id)
        junk_credit_note_id = str(junk_credit_note.id)
        checkout_id, account_id = str(checkout.id), str(account.id)

        plan = await plan_corrections(session, list(Target))
        updated = await apply_corrections(session, plan.corrections)

        assert plan.unresolved == {
            (Target.order, "IN", "Heaven"): 1,
            (Target.credit_note, "IN", "Heaven"): 1,
            (Target.account, "IN", "Heaven"): 1,
        }
        assert updated == {Target.order: 1, Target.credit_note: 1, Target.checkout: 1}

        orders = await stored_addresses(session, "orders")
        assert orders[named_order_id]["state"] == "SP"
        assert orders[junk_order_id]["state"] == "Heaven"
        credit_note_addresses = await stored_addresses(session, "credit_notes")
        assert credit_note_addresses[named_credit_note_id]["state"] == "TN"
        assert credit_note_addresses[junk_credit_note_id]["state"] == "Heaven"
        checkouts = await stored_addresses(
            session, "checkouts", "customer_billing_address"
        )
        assert checkouts[checkout_id]["state"] == "PE"
        accounts = await stored_addresses(session, "accounts")
        assert accounts[account_id]["state"] == "Heaven"
