from datetime import UTC, datetime

from pydantic import IPvAnyAddress, TypeAdapter

from polar.kit.address import Address, CountryAlpha2
from polar.kit.anonymization import (
    ANONYMIZED_EMAIL_DOMAIN,
    ANONYMIZED_IP_ADDRESS,
    anonymize_address_for_deletion,
    anonymize_email_for_deletion,
    anonymize_for_deletion,
    anonymize_metadata_for_deletion,
)


class TestAnonymizeForDeletion:
    def test_deterministic_for_same_inputs(self) -> None:
        created_at = datetime(2024, 1, 1, 12, 0, 0, tzinfo=UTC)
        assert anonymize_for_deletion("value", created_at) == anonymize_for_deletion(
            "value", created_at
        )

    def test_different_created_at_yields_different_hash(self) -> None:
        first = anonymize_for_deletion(
            "value", datetime(2024, 1, 1, 12, 0, 0, tzinfo=UTC)
        )
        second = anonymize_for_deletion(
            "value", datetime(2024, 6, 1, 12, 0, 0, tzinfo=UTC)
        )
        assert first != second

    def test_different_value_yields_different_hash(self) -> None:
        created_at = datetime(2024, 1, 1, 12, 0, 0, tzinfo=UTC)
        assert anonymize_for_deletion("a", created_at) != anonymize_for_deletion(
            "b", created_at
        )


class TestAnonymizeEmailForDeletion:
    def test_uses_anonymized_domain(self) -> None:
        created_at = datetime(2024, 1, 1, 12, 0, 0, tzinfo=UTC)
        result = anonymize_email_for_deletion("user@example.com", created_at)
        assert result.endswith(f"@{ANONYMIZED_EMAIL_DOMAIN}")

    def test_same_email_different_created_at_yields_different_hash(self) -> None:
        """Re-registration with the same email after a soft-delete must not
        collide on ix_users_email_case_insensitive."""
        email = "user@example.com"
        first = anonymize_email_for_deletion(
            email, datetime(2024, 1, 1, 12, 0, 0, tzinfo=UTC)
        )
        second = anonymize_email_for_deletion(
            email, datetime(2025, 1, 1, 12, 0, 0, tzinfo=UTC)
        )
        assert first != second

    def test_same_email_and_created_at_is_deterministic(self) -> None:
        email = "user@example.com"
        created_at = datetime(2024, 1, 1, 12, 0, 0, tzinfo=UTC)
        assert anonymize_email_for_deletion(
            email, created_at
        ) == anonymize_email_for_deletion(email, created_at)


class TestAnonymizeAddressForDeletion:
    def test_hashes_street_level_parts_and_keeps_jurisdiction(self) -> None:
        created_at = datetime(2024, 1, 1, 12, 0, 0, tzinfo=UTC)
        address = Address(
            line1="123 Main St",
            line2="Apt 4",
            city="San Francisco",
            state="CA",
            postal_code="94102",
            country=CountryAlpha2("US"),
        )

        result = anonymize_address_for_deletion(address, created_at)

        assert result.line1 == anonymize_for_deletion("123 Main St", created_at)
        assert result.line2 == anonymize_for_deletion("Apt 4", created_at)
        assert result.city == anonymize_for_deletion("San Francisco", created_at)
        assert result.postal_code == anonymize_for_deletion("94102", created_at)
        assert result.country == "US"
        assert result.state == "US-CA"

    def test_keeps_unset_parts_unset(self) -> None:
        address = Address(country=CountryAlpha2("FR"))

        result = anonymize_address_for_deletion(
            address, datetime(2024, 1, 1, 12, 0, 0, tzinfo=UTC)
        )

        assert result.line1 is None
        assert result.line2 is None
        assert result.city is None
        assert result.postal_code is None
        assert result.state is None


class TestAnonymizeMetadataForDeletion:
    def test_keeps_keys_and_hashes_values(self) -> None:
        created_at = datetime(2024, 1, 1, 12, 0, 0, tzinfo=UTC)

        result = anonymize_metadata_for_deletion(
            {"phone": "+3312345678", "seats": 3}, created_at
        )

        assert result == {
            "phone": anonymize_for_deletion("+3312345678", created_at),
            "seats": anonymize_for_deletion("3", created_at),
        }


class TestAnonymizedIPAddress:
    def test_is_a_valid_ip_address(self) -> None:
        """The checkout schema types the field as an IP, so the sentinel must
        survive serialization."""
        parsed: IPvAnyAddress = TypeAdapter(IPvAnyAddress).validate_python(
            ANONYMIZED_IP_ADDRESS
        )
        assert str(parsed) == ANONYMIZED_IP_ADDRESS
