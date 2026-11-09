from datetime import UTC, datetime

import pytest
from freezegun import freeze_time
from pytest_mock import MockerFixture

from polar.config import Environment, settings
from polar.enums import TaxProcessor
from polar.kit.address import Address, CountryAlpha2
from polar.tax.calculation import TaxCode, tax_calculation


@pytest.mark.anyio
class TestRecord:
    @pytest.mark.parametrize("explicit_amounts", [False, True])
    async def test_processor_is_preserved_across_cutover(
        self,
        monkeypatch: pytest.MonkeyPatch,
        mocker: MockerFixture,
        explicit_amounts: bool,
    ) -> None:
        monkeypatch.setattr(settings, "ENV", Environment.production)
        monkeypatch.setattr(settings, "TAX_RECORD_PROCESSOR", TaxProcessor.stripe)

        with freeze_time("2026-10-31T23:59:59Z") as clock:

            async def record_after_cutover(*args: object) -> str:
                clock.move_to("2026-11-01T00:00:00Z")
                return "stripe_transaction"

            method = "backfill" if explicit_amounts else "record"
            record_mock = mocker.patch(
                f"polar.tax.calculation.stripe_tax_service.{method}",
                side_effect=record_after_cutover,
            )
            if explicit_amounts:
                transaction_id, processor = await tax_calculation.record_amounts(
                    amount=1000,
                    tax_amount=100,
                    currency="usd",
                    address=Address(country=CountryAlpha2("US")),
                    tax_code=TaxCode.general_electronically_supplied_services,
                    reference="order",
                    transaction_date=datetime(2026, 10, 31, tzinfo=UTC),
                )
                assert transaction_id == "backfill_stripe_transaction"
            else:
                transaction_id, processor = await tax_calculation.record(
                    TaxProcessor.stripe,
                    "stripe_calculation",
                    amount=1000,
                    tax_amount=100,
                    currency="usd",
                    address=Address(country=CountryAlpha2("US")),
                    tax_code=TaxCode.general_electronically_supplied_services,
                    reference="order",
                    transaction_date=datetime(2026, 10, 31, tzinfo=UTC),
                )
                assert transaction_id == "stripe_transaction"

            assert processor == TaxProcessor.stripe
            assert settings.tax_record_processor == TaxProcessor.numeral
            record_mock.assert_awaited_once()

    async def test_stripe_calculation_is_backfilled_into_numeral_after_cutover(
        self, monkeypatch: pytest.MonkeyPatch, mocker: MockerFixture
    ) -> None:
        monkeypatch.setattr(settings, "ENV", Environment.production)
        monkeypatch.setattr(settings, "TAX_RECORD_PROCESSOR", TaxProcessor.stripe)
        backfill = mocker.patch(
            "polar.tax.calculation.numeral_tax_service.backfill",
            return_value="numeral_transaction",
        )
        address = Address(country=CountryAlpha2("US"))
        transaction_date = datetime(2026, 10, 31, tzinfo=UTC)

        with freeze_time("2026-11-01T00:00:00Z"):
            result = await tax_calculation.record(
                TaxProcessor.stripe,
                "stripe_calculation",
                amount=1000,
                tax_amount=100,
                currency="usd",
                address=address,
                tax_code=TaxCode.general_electronically_supplied_services,
                reference="order",
                transaction_date=transaction_date,
            )

        assert result == ("backfill_numeral_transaction", TaxProcessor.numeral)
        backfill.assert_awaited_once_with(
            1000,
            100,
            "usd",
            address,
            TaxCode.general_electronically_supplied_services,
            "order",
            transaction_date,
        )
