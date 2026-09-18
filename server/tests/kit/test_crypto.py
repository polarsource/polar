import pytest
from pydantic import ValidationError

from polar.config import Settings, settings
from polar.kit.crypto import get_token_hash, get_token_hash_candidates

SECRETS = {"k1": "first secret", "k2": "second secret"}


@pytest.fixture
def current_secret(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(settings, "HASH_SECRETS", SECRETS)
    monkeypatch.setattr(settings, "CURRENT_HASH_SECRET_ID", "k2")


@pytest.fixture
def no_current_secret(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(settings, "HASH_SECRETS", {})
    monkeypatch.setattr(settings, "CURRENT_HASH_SECRET_ID", None)


def test_hash_is_a_bare_digest_without_a_current_secret(
    no_current_secret: None,
) -> None:
    hash = get_token_hash("polar_at_xxx")
    assert len(hash) == 64
    assert get_token_hash_candidates("polar_at_xxx") == [hash]


def test_hash_carries_the_current_secret_id(current_secret: None) -> None:
    hash = get_token_hash("polar_at_xxx")
    secret_id, _, digest = hash.partition("$")
    assert secret_id == "k2"
    assert len(digest) == 64


def test_candidates_cover_every_secret_and_the_legacy_form(
    current_secret: None,
) -> None:
    candidates = get_token_hash_candidates("polar_at_xxx")
    assert candidates[0] == get_token_hash("polar_at_xxx")
    assert len(candidates) == 3
    assert sum(1 for c in candidates if c.startswith("k1$")) == 1
    assert sum(1 for c in candidates if "$" not in c) == 1


def test_a_hash_written_under_a_retired_secret_is_still_a_candidate(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(settings, "HASH_SECRETS", SECRETS)
    monkeypatch.setattr(settings, "CURRENT_HASH_SECRET_ID", "k1")
    stored = get_token_hash("polar_at_xxx")

    monkeypatch.setattr(settings, "CURRENT_HASH_SECRET_ID", "k2")
    assert stored != get_token_hash("polar_at_xxx")
    assert stored in get_token_hash_candidates("polar_at_xxx")


@pytest.mark.parametrize(
    "secret_id", ["", "sixteen_char_id_", "has$separator"], ids=repr
)
def test_config_rejects_an_unusable_secret_id(secret_id: str) -> None:
    with pytest.raises(ValidationError):
        Settings(HASH_SECRETS={secret_id: "secret"}, CURRENT_HASH_SECRET_ID=None)


def test_config_rejects_a_current_id_it_has_no_secret_for() -> None:
    with pytest.raises(ValidationError):
        Settings(HASH_SECRETS=SECRETS, CURRENT_HASH_SECRET_ID="k3")
