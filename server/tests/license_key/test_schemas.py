"""Test for license key prefix validation fix."""

from datetime import datetime
from uuid import uuid4

import pytest
from pydantic import ValidationError

from polar.benefit.strategies.license_keys.schemas import (
    BenefitLicenseKeyExpirationProperties,
    BenefitLicenseKeysCreateProperties,
)
from polar.license_key.schemas import LicenseKeyCreate

INT32_MAX = 2147483647


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


class TestBenefitLicenseKeysLimitUsageValidation:
    def test_valid_limit_usage(self) -> None:
        properties = BenefitLicenseKeysCreateProperties(limit_usage=100)
        assert properties.limit_usage == 100

    def test_int32_max_limit_usage_valid(self) -> None:
        properties = BenefitLicenseKeysCreateProperties(limit_usage=INT32_MAX)
        assert properties.limit_usage == INT32_MAX

    def test_int32_max_plus_one_limit_usage_invalid(self) -> None:
        with pytest.raises(ValidationError):
            BenefitLicenseKeysCreateProperties(limit_usage=INT32_MAX + 1)

    def test_large_limit_usage_invalid(self) -> None:
        # Value from the bug report: accepted pre-fix, broke grant post-purchase.
        with pytest.raises(ValidationError):
            BenefitLicenseKeysCreateProperties(limit_usage=3_000_000_000)

    def test_zero_limit_usage_invalid(self) -> None:
        with pytest.raises(ValidationError):
            BenefitLicenseKeysCreateProperties(limit_usage=0)

    def test_negative_limit_usage_invalid(self) -> None:
        with pytest.raises(ValidationError):
            BenefitLicenseKeysCreateProperties(limit_usage=-1)

    def test_none_limit_usage_valid(self) -> None:
        properties = BenefitLicenseKeysCreateProperties(limit_usage=None)
        assert properties.limit_usage is None

    def test_default_limit_usage_is_none(self) -> None:
        properties = BenefitLicenseKeysCreateProperties()
        assert properties.limit_usage is None


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
            BenefitLicenseKeyExpirationProperties(ttl=458, timeframe="year")

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


class TestLimitUsageDataFlowConsistency:
    """The value accepted at benefit creation must also be accepted at grant time.

    Pre-fix, ``BenefitLicenseKeysCreateProperties.limit_usage`` used ``int | None``
    while ``LicenseKeyCreate`` (via ``LicenseKeyUpdate``) validated ``Int32 | None``,
    so large values passed creation but raised ``ValidationError`` in the grant task
    after a customer paid. These tests pin the two schemas to the same Int32 bounds.
    """

    @pytest.mark.parametrize("limit_usage", [None, 1, 100, INT32_MAX])
    def test_create_value_passes_grant_schema(self, limit_usage: int | None) -> None:
        properties = BenefitLicenseKeysCreateProperties(limit_usage=limit_usage)

        license_key = LicenseKeyCreate.build(
            organization_id=uuid4(),
            customer_id=uuid4(),
            benefit_id=uuid4(),
            prefix="POLAR",
            limit_usage=properties.limit_usage,
        )

        assert license_key.limit_usage == limit_usage

    def test_overflow_value_rejected_at_creation(self) -> None:
        # The value from the bug report must now be rejected at benefit creation,
        # before it can reach the grant task and fail after payment.
        with pytest.raises(ValidationError):
            BenefitLicenseKeysCreateProperties(limit_usage=3_000_000_000)

    def test_grant_schema_rejects_overflow(self) -> None:
        # Guards the downstream Int32 bound: if the create schema bound is ever
        # loosened again, this confirms the grant task would still reject overflow.
        with pytest.raises(ValidationError):
            LicenseKeyCreate.build(
                organization_id=uuid4(),
                customer_id=uuid4(),
                benefit_id=uuid4(),
                prefix="POLAR",
                limit_usage=3_000_000_000,
            )
