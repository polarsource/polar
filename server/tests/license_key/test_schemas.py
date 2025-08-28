"""Test for license key prefix validation fix."""

from polar.benefit.strategies.license_keys.schemas import (
    BenefitLicenseKeysCreateProperties,
)


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
