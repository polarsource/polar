from collections.abc import AsyncIterator, Sequence
from typing import Any

import pytest
import pytest_asyncio
import stripe as stripe_lib
from pytest_mock import MockerFixture
from sqlalchemy import select

from polar.enums import PaymentProcessor
from polar.merchant_migration.canonical import (
    CanonicalPaymentMethod,
    CanonicalPaymentMethodType,
)
from polar.merchant_migration.cards import (
    AmbiguousCopiedCard,
    InvalidCopiedCardMapping,
    PaymentMethodMapping,
    PaymentMethodMappingCSVError,
    link_payment_method,
    parse_payment_method_mapping_csv,
)
from polar.models import Customer, Organization, PaymentMethod
from polar.postgres import AsyncSession
from tests.fixtures.database import SaveFixture
from tests.fixtures.random_objects import create_customer
from tests.fixtures.stripe import build_stripe_payment_method


def _stripe_payment_method(
    id: str, type: str = "card", details: dict[str, Any] | None = None
) -> stripe_lib.PaymentMethod:
    payment_method = build_stripe_payment_method(
        type=type, details=details or {}, customer="cus_1"
    )
    payment_method.id = id
    return payment_method


def _card(last4: str) -> dict[str, Any]:
    return {"last4": last4, "brand": "visa", "exp_month": 4, "exp_year": 2030}


def _mapping_csv(*rows: str) -> bytes:
    return (
        "customer_id_old,source_id_old,customer_id_new,source_id_new\n"
        + "\n".join(rows)
    ).encode()


class TestParsePaymentMethodMappingCSV:
    def test_valid(self) -> None:
        mappings = parse_payment_method_mapping_csv(
            _mapping_csv("cus_old,pm_old,cus_new,pm_new")
        )

        assert mappings == [
            PaymentMethodMapping(
                source_customer_id="cus_old",
                source_payment_method_id="pm_old",
                destination_customer_id="cus_new",
                destination_payment_method_id="pm_new",
            )
        ]

    def test_rejects_incorrect_headers(self) -> None:
        with pytest.raises(PaymentMethodMappingCSVError):
            parse_payment_method_mapping_csv(b"source_id_old,source_id_new\npm_1,pm_2")

    def test_rejects_extra_values(self) -> None:
        with pytest.raises(PaymentMethodMappingCSVError):
            parse_payment_method_mapping_csv(
                _mapping_csv("cus_old,pm_old,cus_new,pm_new,unexpected")
            )

    def test_rejects_conflicting_source_mapping(self) -> None:
        with pytest.raises(PaymentMethodMappingCSVError):
            parse_payment_method_mapping_csv(
                _mapping_csv(
                    "cus_old,pm_old,cus_new,pm_new",
                    "cus_old,pm_old,cus_new,pm_different",
                )
            )

    def test_deduplicates_identical_rows(self) -> None:
        mappings = parse_payment_method_mapping_csv(
            _mapping_csv(
                "cus_old,pm_old,cus_new,pm_new",
                "cus_old,pm_old,cus_new,pm_new",
            )
        )

        assert len(mappings) == 1


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

    async def test_uses_the_exact_mapped_payment_method(
        self,
        mocker: MockerFixture,
        session: AsyncSession,
        imported_customer: Customer,
    ) -> None:
        mapped = _stripe_payment_method("pm_mapped", details=_card("1111"))
        mocker.patch(
            "polar.merchant_migration.cards.stripe_service.get_payment_method",
            new=mocker.AsyncMock(return_value=mapped),
        )
        list_payment_methods = mocker.patch(
            "polar.merchant_migration.cards.stripe_service.list_payment_methods"
        )

        payment_method = await link_payment_method(
            session,
            imported_customer,
            mapping=PaymentMethodMapping(
                source_customer_id="cus_source",
                source_payment_method_id="pm_source",
                destination_customer_id="cus_1",
                destination_payment_method_id="pm_mapped",
            ),
        )

        assert payment_method is not None
        assert payment_method.processor_id == "pm_mapped"
        list_payment_methods.assert_not_called()

    async def test_rejects_a_mapped_method_owned_by_another_customer(
        self,
        mocker: MockerFixture,
        session: AsyncSession,
        imported_customer: Customer,
    ) -> None:
        mapped = _stripe_payment_method("pm_mapped", details=_card("1111"))
        mapped.customer = "cus_other"
        mocker.patch(
            "polar.merchant_migration.cards.stripe_service.get_payment_method",
            new=mocker.AsyncMock(return_value=mapped),
        )

        with pytest.raises(InvalidCopiedCardMapping):
            await link_payment_method(
                session,
                imported_customer,
                mapping=PaymentMethodMapping(
                    source_customer_id="cus_source",
                    source_payment_method_id="pm_source",
                    destination_customer_id="cus_1",
                    destination_payment_method_id="pm_mapped",
                ),
            )

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


@pytest.mark.asyncio
class TestKeepsTheCardTheSourceCharged:
    """The customer has two cards stored but the subscription only ever charged
    one of them. The copy re-mints both ids, so the details are what tells them
    apart — and the one that was being charged has to keep being charged."""

    async def test_picks_the_copy_of_the_source_method(
        self,
        mocker: MockerFixture,
        session: AsyncSession,
        imported_customer: Customer,
    ) -> None:
        _listing(
            mocker,
            [
                _stripe_payment_method("pm_copy_of_c1", details=_card("1111")),
                _stripe_payment_method("pm_copy_of_c2", details=_card("2222")),
            ],
        )
        charged_on_the_source = CanonicalPaymentMethod(
            source_id="pm_c2_on_the_source",
            type=CanonicalPaymentMethodType.card,
            **_card("2222"),
        )

        payment_method = await link_payment_method(
            session, imported_customer, source_method=charged_on_the_source
        )

        assert payment_method is not None
        assert payment_method.processor_id == "pm_copy_of_c2"

    async def test_beats_an_existing_default(
        self,
        mocker: MockerFixture,
        save_fixture: SaveFixture,
        session: AsyncSession,
        imported_customer: Customer,
    ) -> None:
        """The default is a guess; what the subscription charged is the answer."""
        existing = PaymentMethod(
            processor=PaymentProcessor.stripe,
            processor_id="pm_copy_of_c1",
            type="card",
            method_metadata=_card("1111"),
            customer=imported_customer,
        )
        await save_fixture(existing)
        imported_customer.default_payment_method_id = existing.id
        await save_fixture(imported_customer)
        _listing(
            mocker,
            [
                _stripe_payment_method("pm_copy_of_c1", details=_card("1111")),
                _stripe_payment_method("pm_copy_of_c2", details=_card("2222")),
            ],
        )

        payment_method = await link_payment_method(
            session,
            imported_customer,
            source_method=CanonicalPaymentMethod(
                source_id="pm_c2_on_the_source",
                type=CanonicalPaymentMethodType.card,
                **_card("2222"),
            ),
        )

        assert payment_method is not None
        assert payment_method.processor_id == "pm_copy_of_c2"

    async def test_falls_back_when_the_card_did_not_land(
        self,
        mocker: MockerFixture,
        session: AsyncSession,
        imported_customer: Customer,
    ) -> None:
        """Only C1 copied. Better the card we have than nothing — the cutover's
        SetupIntent is what decides whether it can actually be charged."""
        _listing(
            mocker, [_stripe_payment_method("pm_copy_of_c1", details=_card("1111"))]
        )

        payment_method = await link_payment_method(
            session,
            imported_customer,
            source_method=CanonicalPaymentMethod(
                source_id="pm_c2_on_the_source",
                type=CanonicalPaymentMethodType.card,
                **_card("2222"),
            ),
        )

        assert payment_method is not None
        assert payment_method.processor_id == "pm_copy_of_c1"

    async def test_a_source_method_with_no_details_cannot_match(
        self,
        mocker: MockerFixture,
        session: AsyncSession,
        imported_customer: Customer,
    ) -> None:
        """A legacy `src_` object gives us an id and nothing else."""
        _listing(mocker, [_stripe_payment_method("pm_copied", details=_card("1111"))])

        payment_method = await link_payment_method(
            session,
            imported_customer,
            source_method=CanonicalPaymentMethod(
                source_id="src_legacy", type=CanonicalPaymentMethodType.card
            ),
        )

        assert payment_method is not None
        assert payment_method.processor_id == "pm_copied"

    async def test_two_indistinguishable_copies_raise(
        self,
        mocker: MockerFixture,
        session: AsyncSession,
        imported_customer: Customer,
    ) -> None:
        """Same brand, last4 and expiry on both copies. Nothing left to tell them
        apart, and charging the wrong one is worse than not charging."""
        _listing(
            mocker,
            [
                _stripe_payment_method("pm_copy_a", details=_card("2222")),
                _stripe_payment_method("pm_copy_b", details=_card("2222")),
            ],
        )

        with pytest.raises(AmbiguousCopiedCard):
            await link_payment_method(
                session,
                imported_customer,
                source_method=CanonicalPaymentMethod(
                    source_id="pm_on_the_source",
                    type=CanonicalPaymentMethodType.card,
                    **_card("2222"),
                ),
            )
