import pytest
from pytest_mock import MockerFixture

from polar.config import Environment
from polar.invoice.seller import (
    EU_VAT_COUNTRIES,
    POLAR_EU_OSS_VAT_ID,
    POLAR_GB_VAT_ID,
    SUPPORT_CONTACT_INFO,
    get_polar_additional_info,
    get_polar_vat_id,
)
from polar.kit.address import Address, CountryAlpha2


def _address(country: str, state: str | None = None) -> Address:
    return Address(country=CountryAlpha2(country), state=state)


class TestGetPolarVatID:
    def test_none_address(self) -> None:
        assert get_polar_vat_id(None) is None

    @pytest.mark.parametrize("country", sorted(EU_VAT_COUNTRIES))
    def test_eu_countries(self, country: str) -> None:
        assert get_polar_vat_id(_address(country)) == POLAR_EU_OSS_VAT_ID

    def test_uk(self) -> None:
        assert get_polar_vat_id(_address("GB")) == POLAR_GB_VAT_ID

    @pytest.mark.parametrize("country", ["US", "CA", "AU", "JP", "BR", "CH", "NO"])
    def test_other_countries(self, country: str) -> None:
        assert get_polar_vat_id(_address(country)) is None

    def test_us_with_state(self) -> None:
        assert get_polar_vat_id(_address("US", "US-CA")) is None

    def test_eu_country_with_state_still_eu_oss(self) -> None:
        # State doesn't change EU OSS routing
        assert get_polar_vat_id(_address("FR")) == POLAR_EU_OSS_VAT_ID

    def test_known_eu_member_examples(self) -> None:
        for country in ("FR", "DE", "IE", "ES", "IT", "NL", "SE"):
            assert get_polar_vat_id(_address(country)) == POLAR_EU_OSS_VAT_ID


class TestGetPolarAdditionalInfo:
    def test_eu_customer(self) -> None:
        info = get_polar_additional_info(_address("FR"))
        assert info == f"{SUPPORT_CONTACT_INFO}\nVAT: {POLAR_EU_OSS_VAT_ID[0]}"

    def test_uk_customer(self) -> None:
        info = get_polar_additional_info(_address("GB"))
        assert info == f"{SUPPORT_CONTACT_INFO}\nVAT: {POLAR_GB_VAT_ID[0]}"

    def test_other_country_omits_vat(self) -> None:
        info = get_polar_additional_info(_address("US"))
        assert info == SUPPORT_CONTACT_INFO

    def test_none_address_omits_vat(self) -> None:
        info = get_polar_additional_info(None)
        assert info == SUPPORT_CONTACT_INFO

    @pytest.mark.parametrize(
        "address",
        [None, _address("FR"), _address("GB"), _address("US")],
    )
    def test_sandbox_returns_none(
        self, mocker: MockerFixture, address: Address | None
    ) -> None:
        mocker.patch("polar.invoice.seller.settings.ENV", Environment.sandbox)
        assert get_polar_additional_info(address) is None


class TestEUVatCountries:
    def test_contains_known_eu_members(self) -> None:
        for country in ("FR", "DE", "IE", "ES", "IT", "NL", "SE", "PL", "AT"):
            assert country in EU_VAT_COUNTRIES

    def test_excludes_uk(self) -> None:
        assert "GB" not in EU_VAT_COUNTRIES

    def test_excludes_non_eu(self) -> None:
        for country in ("US", "CA", "CH", "NO", "JP", "AU"):
            assert country not in EU_VAT_COUNTRIES
