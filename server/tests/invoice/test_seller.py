import pytest
from pytest_mock import MockerFixture

from polar.invoice.seller import (
    get_polar_additional_info,
    get_polar_vat_number,
)
from polar.kit.address import Address, CountryAlpha2


def _address(country: str, state: str | None = None) -> Address:
    return Address(country=CountryAlpha2(country), state=state)


VAT_NUMBERS = {"FR": "EU372061545", "DE": "EU372061545", "GB": "GB458254961"}


@pytest.fixture(autouse=True)
def configured_vat_numbers(mocker: MockerFixture) -> None:
    mocker.patch("polar.invoice.seller.settings.INVOICES_VAT_NUMBERS", VAT_NUMBERS)
    mocker.patch(
        "polar.invoice.seller.settings.INVOICES_ADDITIONAL_INFO",
        "[support@polar.sh](mailto:support@polar.sh)",
    )


class TestGetPolarVatNumber:
    def test_none_country(self) -> None:
        assert get_polar_vat_number(None) is None

    def test_known_country(self) -> None:
        assert get_polar_vat_number("FR") == "EU372061545"
        assert get_polar_vat_number("DE") == "EU372061545"
        assert get_polar_vat_number("GB") == "GB458254961"

    def test_unknown_country(self) -> None:
        assert get_polar_vat_number("US") is None
        assert get_polar_vat_number("JP") is None


class TestGetPolarAdditionalInfo:
    def test_mapped_country(self) -> None:
        info = get_polar_additional_info(_address("FR"))
        assert info == "[support@polar.sh](mailto:support@polar.sh)\nVAT: EU372061545"

    def test_uk(self) -> None:
        info = get_polar_additional_info(_address("GB"))
        assert info == "[support@polar.sh](mailto:support@polar.sh)\nVAT: GB458254961"

    def test_unmapped_country(self) -> None:
        info = get_polar_additional_info(_address("US"))
        assert info == "[support@polar.sh](mailto:support@polar.sh)"

    def test_none_address(self) -> None:
        info = get_polar_additional_info(None)
        assert info == "[support@polar.sh](mailto:support@polar.sh)"

    def test_empty_settings_returns_none(self, mocker: MockerFixture) -> None:
        mocker.patch("polar.invoice.seller.settings.INVOICES_ADDITIONAL_INFO", None)
        mocker.patch("polar.invoice.seller.settings.INVOICES_VAT_NUMBERS", {})
        assert get_polar_additional_info(_address("FR")) is None
        assert get_polar_additional_info(None) is None

    def test_only_vat_when_no_additional_info(self, mocker: MockerFixture) -> None:
        mocker.patch("polar.invoice.seller.settings.INVOICES_ADDITIONAL_INFO", None)
        assert get_polar_additional_info(_address("FR")) == "VAT: EU372061545"

    def test_only_additional_info_when_no_vat(self, mocker: MockerFixture) -> None:
        mocker.patch("polar.invoice.seller.settings.INVOICES_VAT_NUMBERS", {})
        assert get_polar_additional_info(_address("FR")) == (
            "[support@polar.sh](mailto:support@polar.sh)"
        )
