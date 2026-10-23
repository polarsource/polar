import pytest
from pytest_mock import MockerFixture

from polar.enums import TaxProcessor
from polar.kit.address import Address, CountryAlpha2
from polar.tax.calculation import TaxCode, tax_calculation


@pytest.mark.anyio
class TestRevert:
    @pytest.mark.parametrize("processor", [TaxProcessor.stripe, TaxProcessor.numeral])
    @pytest.mark.parametrize(
        ("reverted_amount", "reverted_tax_amount", "expected_amount"),
        [
            pytest.param(2000, 2000, None, id="full-tax-refund"),
            pytest.param(1000, 1000, 6000, id="partial-tax-refund"),
            pytest.param(1200, 200, 1200, id="product-and-tax-refund"),
            pytest.param(0, 0, 0, id="zero-refund"),
        ],
    )
    async def test_refund(
        self,
        mocker: MockerFixture,
        processor: TaxProcessor,
        reverted_amount: int,
        reverted_tax_amount: int,
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
        )

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
