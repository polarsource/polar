from datetime import UTC, datetime

import pytest
from pytest_mock import MockerFixture

from polar.enums import TaxBehaviorOption, TaxProcessor
from polar.kit.address import Address, CountryAlpha2
from polar.tax.calculation import InvalidAddressError, TaxCode, tax_calculation


@pytest.mark.anyio
class TestRecord:
    async def test_stripe_calculation_is_backfilled_into_numeral(
        self, mocker: MockerFixture
    ) -> None:
        backfill = mocker.patch(
            "polar.tax.calculation.numeral_tax_service.backfill",
            return_value="numeral_transaction",
        )
        address = Address(country=CountryAlpha2("US"))
        transaction_date = datetime(2026, 10, 31, tzinfo=UTC)

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


@pytest.mark.anyio
class TestCalculate:
    @pytest.mark.parametrize(
        "address",
        [
            {"country": "US"},
            {"country": "US", "state": "NY"},
            {"country": "US", "postal_code": "10001"},
            {"country": "CA"},
            {"country": "ES"},
            {"country": "PT"},
            {"country": "BR", "city": "São Paulo"},
            {"country": "BR", "state": "SP"},
            {"country": "IN"},
        ],
    )
    async def test_incomplete_address(
        self, mocker: MockerFixture, address: dict[str, str]
    ) -> None:
        numeral_mock = mocker.patch(
            "polar.tax.calculation.numeral_tax_service.calculate"
        )
        stripe_mock = mocker.patch("polar.tax.calculation.stripe_tax_service.calculate")

        with pytest.raises(InvalidAddressError):
            await tax_calculation.calculate(
                "identifier",
                "usd",
                1000,
                TaxBehaviorOption.location,
                TaxCode.general_electronically_supplied_services,
                Address.model_validate(address),
                [],
                customer_exempt=False,
            )

        numeral_mock.assert_not_called()
        stripe_mock.assert_not_called()
