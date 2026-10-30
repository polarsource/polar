import pytest
from pytest_mock import MockerFixture

from polar.enums import TaxProcessor
from polar.kit.address import Address, CountryAlpha2
from polar.tax.calculation import TaxCode, tax_calculation


@pytest.mark.anyio
class TestRevert:
    @pytest.mark.parametrize("processor", [TaxProcessor.stripe, TaxProcessor.numeral])
    @pytest.mark.parametrize(
        (
            "reverted_amount",
            "reverted_tax_amount",
            "previous_reverted_tax_amount",
            "expected_amount",
        ),
        [
            pytest.param(2000, 2000, 0, None, id="full-tax-refund"),
            pytest.param(1000, 1000, 0, 6000, id="partial-tax-refund"),
            pytest.param(1200, 200, 0, 1200, id="product-and-tax-refund"),
            pytest.param(0, 0, 0, 0, id="zero-refund"),
            pytest.param(11000, 1000, 1000, 6000, id="remaining-refund-after-tax-only"),
            pytest.param(10000, 0, 2000, 0, id="product-refund-after-all-tax-reversed"),
        ],
    )
    async def test_refund(
        self,
        mocker: MockerFixture,
        processor: TaxProcessor,
        reverted_amount: int,
        reverted_tax_amount: int,
        previous_reverted_tax_amount: int,
        expected_amount: int | None,
    ) -> None:
        provider = mocker.patch(
            f"polar.tax.calculation.{processor.value}_tax_service.revert",
            return_value="refund_123",
        )

        result = await tax_calculation.revert(
            processor,
            "transaction_123",
            reference="reference_123",
            address=Address(country=CountryAlpha2("FR")),
            tax_code=TaxCode.general_electronically_supplied_services,
            currency="usd",
            total_amount=12000,
            tax_amount=2000,
            reverted_amount=reverted_amount,
            reverted_tax_amount=reverted_tax_amount,
            previous_reverted_tax_amount=previous_reverted_tax_amount,
        )

        if expected_amount == 0:
            assert result is None
            provider.assert_not_awaited()
            return

        assert result == "refund_123"
        if expected_amount is None:
            provider.assert_awaited_once_with("transaction_123", "reference_123")
        else:
            provider.assert_awaited_once_with(
                "transaction_123",
                "reference_123",
                expected_amount,
                reverted_tax_amount,
            )

    @pytest.mark.parametrize("processor", [TaxProcessor.stripe, TaxProcessor.numeral])
    async def test_cumulative_rounding(
        self, mocker: MockerFixture, processor: TaxProcessor
    ) -> None:
        provider = mocker.patch(
            f"polar.tax.calculation.{processor.value}_tax_service.revert",
            return_value="refund_123",
        )
        for index in range(3):
            await tax_calculation.revert(
                processor,
                "transaction_123",
                reference=f"refund_{index}",
                address=Address(country=CountryAlpha2("FR")),
                tax_code=TaxCode.general_electronically_supplied_services,
                currency="usd",
                total_amount=101,
                tax_amount=3,
                reverted_amount=1,
                reverted_tax_amount=1,
                previous_reverted_tax_amount=index,
            )

        assert provider.await_args_list == [
            mocker.call("transaction_123", "refund_0", 34, 1),
            mocker.call("transaction_123", "refund_1", 33, 1),
            mocker.call("transaction_123", "refund_2", 34, 1),
        ]

    @pytest.mark.parametrize("processor", [TaxProcessor.stripe, TaxProcessor.numeral])
    async def test_capped_at_remaining_balance(
        self, mocker: MockerFixture, processor: TaxProcessor
    ) -> None:
        provider = mocker.patch(
            f"polar.tax.calculation.{processor.value}_tax_service.revert",
            return_value="refund_123",
        )

        await tax_calculation.revert(
            processor,
            "transaction_123",
            reference="refund_123",
            address=Address(country=CountryAlpha2("GB")),
            tax_code=TaxCode.general_electronically_supplied_services,
            currency="usd",
            total_amount=1200,
            tax_amount=200,
            reverted_amount=983,
            reverted_tax_amount=164,
            previous_reverted_tax_amount=36,
            previous_reverted_amount=217,
        )

        provider.assert_awaited_once_with("transaction_123", "refund_123", 983, 164)

    async def test_backfilled_cumulative_reversal(self, mocker: MockerFixture) -> None:
        provider = mocker.patch(
            "polar.tax.calculation.numeral_tax_service.backfill",
            return_value="refund_123",
        )
        result = await tax_calculation.revert(
            TaxProcessor.numeral,
            "backfill_transaction_123",
            reference="refund_123",
            address=Address(country=CountryAlpha2("FR")),
            tax_code=TaxCode.general_electronically_supplied_services,
            currency="usd",
            total_amount=12000,
            tax_amount=2000,
            reverted_amount=11000,
            reverted_tax_amount=1000,
            previous_reverted_tax_amount=1000,
        )

        assert result == "backfill_refund_123"
        provider.assert_awaited_once_with(
            -5000,
            -1000,
            "usd",
            Address(country=CountryAlpha2("FR")),
            TaxCode.general_electronically_supplied_services,
            "refund_123",
            mocker.ANY,
        )
