"""Test for license key prefix validation fix."""

from datetime import datetime

import pytest
from pydantic import ValidationError

from polar.benefit.strategies.license_keys.schemas import (
    BenefitLicenseKeyExpirationProperties,
    BenefitLicenseKeysCreateProperties,
)
from polar.license_key.schemas import LicenseKeyCreate


class TestLicenseKeyPrefixValidation:
    """Test that empty string prefixes are correctly converted to None."""

    def test_empty_string_prefix_converted_to_none(self) -> None:
        """Test that empty string prefix is converted to None."""
        properties = BenefitLicenseKeysCreateProperties(prefix="")
        assert properties.prefix is None

    def test_whitespace_only_prefix_converted_to_none(self) -> None:
        """Test that whitespace-only prefix is converted to None."""
        properties = BenefitLicenseKeysCreateProperties(prefix="   ")
        assert properties.prefix is None

    def test_valid_prefix_preserved(self) -> None:
        """Test that valid prefix is preserved."""
        properties = BenefitLicenseKeysCreateProperties(prefix="POLAR")
        assert properties.prefix == "POLAR"

    def test_none_prefix_preserved(self) -> None:
        """Test that None prefix is preserved."""
        properties = BenefitLicenseKeysCreateProperties(prefix=None)
        assert properties.prefix is None

    def test_default_prefix_is_none(self) -> None:
        """Test that default prefix value is None."""
        properties = BenefitLicenseKeysCreateProperties()
        assert properties.prefix is None

    def test_prefix_with_leading_trailing_whitespace_stripped(self) -> None:
        """Test that prefix with leading/trailing whitespace is stripped but preserved."""
        properties = BenefitLicenseKeysCreateProperties(prefix="  MYAPP  ")
        assert properties.prefix == "MYAPP"


class TestBenefitLicenseKeyExpirationPropertiesValidation:
    def test_valid_year(self) -> None:
        props = BenefitLicenseKeyExpirationProperties(ttl=1, timeframe="year")
        assert props.ttl == 1

    def test_valid_month(self) -> None:
        props = BenefitLicenseKeyExpirationProperties(ttl=1, timeframe="month")
        assert props.ttl == 1

    def test_valid_day(self) -> None:
        props = BenefitLicenseKeyExpirationProperties(ttl=1, timeframe="day")
        assert props.ttl == 1

    def test_boundary_year_valid(self) -> None:
        props = BenefitLicenseKeyExpirationProperties(ttl=100, timeframe="year")
        assert props.ttl == 100

    def test_boundary_year_invalid(self) -> None:
        with pytest.raises(ValidationError):
            BenefitLicenseKeyExpirationProperties(ttl=101, timeframe="year")

    def test_boundary_month_valid(self) -> None:
        props = BenefitLicenseKeyExpirationProperties(ttl=1200, timeframe="month")
        assert props.ttl == 1200

    def test_boundary_month_invalid(self) -> None:
        with pytest.raises(ValidationError):
            BenefitLicenseKeyExpirationProperties(ttl=1201, timeframe="month")

    def test_boundary_day_valid(self) -> None:
        props = BenefitLicenseKeyExpirationProperties(ttl=36500, timeframe="day")
        assert props.ttl == 36500

    def test_boundary_day_invalid(self) -> None:
        with pytest.raises(ValidationError):
            BenefitLicenseKeyExpirationProperties(ttl=36501, timeframe="day")

    def test_seconds_confused_as_years(self) -> None:
        with pytest.raises(ValidationError):
            BenefitLicenseKeyExpirationProperties(ttl=31536000, timeframe="year")


class TestGenerateExpirationDt:
    def test_normal_year(self) -> None:
        result = LicenseKeyCreate.generate_expiration_dt(ttl=1, timeframe="year")
        assert isinstance(result, datetime)

    def test_normal_month(self) -> None:
        result = LicenseKeyCreate.generate_expiration_dt(ttl=1, timeframe="month")
        assert isinstance(result, datetime)

    def test_normal_day(self) -> None:
        result = LicenseKeyCreate.generate_expiration_dt(ttl=1, timeframe="day")
        assert isinstance(result, datetime)

    def test_overflow_raises_value_error(self) -> None:
        with pytest.raises(ValueError, match="Expiration date overflows"):
            LicenseKeyCreate.generate_expiration_dt(ttl=999999999, timeframe="year")
