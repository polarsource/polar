from collections.abc import AsyncIterator, Sequence

import pytest
import pytest_asyncio
import stripe as stripe_lib
from pytest_mock import MockerFixture
from sqlalchemy import select

from polar.merchant_migration.cards import link_payment_method
from polar.models import Customer, Organization, PaymentMethod
from polar.postgres import AsyncSession
from tests.fixtures.database import SaveFixture
from tests.fixtures.random_objects import create_customer
from tests.fixtures.stripe import build_stripe_payment_method


def _stripe_payment_method(id: str, type: str = "card") -> stripe_lib.PaymentMethod:
    payment_method = build_stripe_payment_method(type=type, customer="cus_1")
    payment_method.id = id
    return payment_method


def _listing(
    mocker: MockerFixture,
    payment_methods: Sequence[stripe_lib.PaymentMethod] | None = None,
    *,
    error: Exception | None = None,
) -> None:
    async def _list(customer: str) -> AsyncIterator[stripe_lib.PaymentMethod]:
        if error is not None:
            raise error
        for payment_method in payment_methods or []:
            yield payment_method

    mocker.patch(
        "polar.merchant_migration.cards.stripe_service.list_payment_methods", new=_list
    )


async def _payment_methods(
    session: AsyncSession, customer: Customer
) -> Sequence[PaymentMethod]:
    result = await session.execute(
        select(PaymentMethod).where(PaymentMethod.customer_id == customer.id)
    )
    return list(result.scalars().all())


@pytest_asyncio.fixture
async def imported_customer(
    save_fixture: SaveFixture, organization: Organization
) -> Customer:
    return await create_customer(
        save_fixture,
        organization=organization,
        email="imported@example.com",
        stripe_customer_id="cus_1",
    )


@pytest.mark.asyncio
class TestLinkPaymentMethod:
    async def test_no_source_customer_id(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        organization: Organization,
    ) -> None:
        customer = await create_customer(
            save_fixture,
            organization=organization,
            email="nocard@example.com",
            stripe_customer_id=None,
        )

        assert await link_payment_method(session, customer) is None

    async def test_customer_not_on_polars_account_yet(
        self,
        mocker: MockerFixture,
        session: AsyncSession,
        imported_customer: Customer,
    ) -> None:
        """The copy hasn't reached this customer: an answer, not an error."""
        _listing(
            mocker,
            error=stripe_lib.InvalidRequestError("No such customer", "customer"),
        )

        assert await link_payment_method(session, imported_customer) is None

    async def test_no_card_copied_yet(
        self,
        mocker: MockerFixture,
        session: AsyncSession,
        imported_customer: Customer,
    ) -> None:
        _listing(mocker, [])

        assert await link_payment_method(session, imported_customer) is None

    async def test_stores_the_copied_card_and_defaults_to_it(
        self,
        mocker: MockerFixture,
        session: AsyncSession,
        imported_customer: Customer,
    ) -> None:
        _listing(mocker, [_stripe_payment_method("pm_copied")])

        payment_method = await link_payment_method(session, imported_customer)

        assert payment_method is not None
        assert payment_method.processor_id == "pm_copied"
        assert imported_customer.default_payment_method_id == payment_method.id

    async def test_prefers_a_card_over_a_bank_account(
        self,
        mocker: MockerFixture,
        session: AsyncSession,
        imported_customer: Customer,
    ) -> None:
        _listing(
            mocker,
            [
                _stripe_payment_method("pm_bank", type="us_bank_account"),
                _stripe_payment_method("pm_card"),
            ],
        )

        payment_method = await link_payment_method(session, imported_customer)

        assert payment_method is not None
        assert payment_method.processor_id == "pm_card"
        # Both are stored: the merchant may want either one later.
        assert len(await _payment_methods(session, imported_customer)) == 2

    async def test_keeps_an_existing_default(
        self,
        mocker: MockerFixture,
        save_fixture: SaveFixture,
        session: AsyncSession,
        imported_customer: Customer,
    ) -> None:
        existing = PaymentMethod(
            processor="stripe",
            processor_id="pm_chosen",
            type="card",
            method_metadata={},
            customer=imported_customer,
        )
        await save_fixture(existing)
        imported_customer.default_payment_method_id = existing.id
        await save_fixture(imported_customer)
        _listing(
            mocker,
            [_stripe_payment_method("pm_newer"), _stripe_payment_method("pm_chosen")],
        )

        payment_method = await link_payment_method(session, imported_customer)

        assert payment_method is not None
        assert payment_method.id == existing.id

    async def test_rerun_does_not_duplicate(
        self,
        mocker: MockerFixture,
        session: AsyncSession,
        imported_customer: Customer,
    ) -> None:
        """Cards keep landing while the merchant walks the checklist, so this
        runs more than once per customer."""
        _listing(mocker, [_stripe_payment_method("pm_copied")])

        first = await link_payment_method(session, imported_customer)
        second = await link_payment_method(session, imported_customer)

        assert first is not None
        assert second is not None
        assert first.id == second.id
        assert len(await _payment_methods(session, imported_customer)) == 1
