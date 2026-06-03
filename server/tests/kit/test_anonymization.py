from datetime import UTC, datetime

from polar.kit.anonymization import (
    ANONYMIZED_EMAIL_DOMAIN,
    anonymize_email_for_deletion,
    anonymize_for_deletion,
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
