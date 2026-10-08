import pytest

from outpost.env import Environment


def test_redis_url(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("REDIS_URL", "redis://localhost:6379/0")
    assert str(Environment().redis_url) == "redis://localhost:6379/0"
