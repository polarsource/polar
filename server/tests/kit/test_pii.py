import pytest

from polar.config import settings
from polar.kit.pii import hash_pii


def test_deterministic_for_same_value() -> None:
    assert hash_pii("customer@example.com") == hash_pii("customer@example.com")


def test_does_not_carry_the_value() -> None:
    hash = hash_pii("customer@example.com")
    assert "customer@example.com" not in hash
    assert len(hash) == 64


def test_different_values_yield_different_hashes() -> None:
    assert hash_pii("customer@example.com") != hash_pii("other@example.com")


def test_salt_changes_the_hash(monkeypatch: pytest.MonkeyPatch) -> None:
    hash = hash_pii("customer@example.com")
    monkeypatch.setattr(settings, "PII_SCRUBBING_SALT", "another salt")
    assert hash_pii("customer@example.com") != hash
