from collections.abc import AsyncIterator

import pytest
import pytest_asyncio
from fakeredis import FakeAsyncRedis

from polar.enums import RateLimitGroup
from polar.rate_limit import (
    _bearer_token,
    _make_authenticate,
    identity_cache_key,
    write_cached_identity,
)
from polar.redis import Redis


@pytest_asyncio.fixture
async def redis() -> AsyncIterator[Redis]:
    yield FakeAsyncRedis(decode_responses=True)


def _http_scope(
    *,
    headers: list[tuple[bytes, bytes]] | None = None,
    client: tuple[str, int] | None = ("8.8.8.8", 1234),
) -> dict[str, object]:
    return {
        "type": "http",
        "headers": headers or [],
        "client": client,
    }


class TestBearerToken:
    def test_returns_token_bytes(self) -> None:
        scope = _http_scope(headers=[(b"authorization", b"Bearer polar_pat_xyz")])
        assert _bearer_token(scope) == b"polar_pat_xyz"

    def test_case_insensitive_scheme(self) -> None:
        scope = _http_scope(headers=[(b"authorization", b"BEARER polar_pat_xyz")])
        assert _bearer_token(scope) == b"polar_pat_xyz"

    def test_missing_header(self) -> None:
        scope = _http_scope(headers=[])
        assert _bearer_token(scope) is None

    def test_other_scheme(self) -> None:
        scope = _http_scope(headers=[(b"authorization", b"Basic dXNlcjpwYXNz")])
        assert _bearer_token(scope) is None

    def test_empty_token(self) -> None:
        scope = _http_scope(headers=[(b"authorization", b"Bearer ")])
        assert _bearer_token(scope) is None

    def test_non_http_scope(self) -> None:
        scope: dict[str, object] = {"type": "websocket", "headers": []}
        assert _bearer_token(scope) is None


@pytest.mark.asyncio
class TestIdentityCacheRoundTrip:
    async def test_write_then_read_via_authenticate(self, redis: Redis) -> None:
        token = b"polar_pat_round_trip"
        await write_cached_identity(
            redis, token, ("user:abc-123", RateLimitGroup.elevated)
        )

        authenticate = _make_authenticate(redis)
        identity = await authenticate(
            _http_scope(headers=[(b"authorization", b"Bearer polar_pat_round_trip")])
        )

        assert identity == ("user:abc-123", RateLimitGroup.elevated)

    async def test_write_sets_ttl(self, redis: Redis) -> None:
        token = b"polar_pat_ttl"
        await write_cached_identity(redis, token, ("user:1", RateLimitGroup.default))

        ttl = await redis.ttl(identity_cache_key(token))
        assert 0 < ttl <= 300


@pytest.mark.asyncio
class TestAuthenticate:
    async def test_cache_miss_falls_back_to_client_ip(self, redis: Redis) -> None:
        authenticate = _make_authenticate(redis)
        identity = await authenticate(
            _http_scope(
                headers=[(b"authorization", b"Bearer polar_pat_unknown")],
                client=("8.8.8.8", 1234),
            )
        )
        assert identity == ("8.8.8.8", RateLimitGroup.default)

    async def test_no_token_uses_client_ip(self, redis: Redis) -> None:
        authenticate = _make_authenticate(redis)
        identity = await authenticate(_http_scope(client=("1.1.1.1", 80)))
        assert identity == ("1.1.1.1", RateLimitGroup.default)

    async def test_no_client_returns_anonymous(self, redis: Redis) -> None:
        authenticate = _make_authenticate(redis)
        identity = await authenticate(_http_scope(client=None))
        assert identity == ("anonymous", RateLimitGroup.default)

    async def test_malformed_cache_value_falls_back(self, redis: Redis) -> None:
        token = b"polar_pat_corrupt"
        await redis.set(identity_cache_key(token), "garbage-no-pipe")

        authenticate = _make_authenticate(redis)
        identity = await authenticate(
            _http_scope(
                headers=[(b"authorization", b"Bearer polar_pat_corrupt")],
                client=("8.8.8.8", 1234),
            )
        )
        assert identity == ("8.8.8.8", RateLimitGroup.default)

    async def test_unknown_group_in_cache_falls_back(self, redis: Redis) -> None:
        token = b"polar_pat_bad_group"
        await redis.set(identity_cache_key(token), "not_a_group|user:abc")

        authenticate = _make_authenticate(redis)
        identity = await authenticate(
            _http_scope(
                headers=[(b"authorization", b"Bearer polar_pat_bad_group")],
                client=("8.8.8.8", 1234),
            )
        )
        assert identity == ("8.8.8.8", RateLimitGroup.default)

    async def test_distinct_tokens_get_distinct_identities(self, redis: Redis) -> None:
        token_a = b"polar_pat_a"
        token_b = b"polar_pat_b"
        await write_cached_identity(redis, token_a, ("user:a", RateLimitGroup.default))
        await write_cached_identity(
            redis, token_b, ("organization:b", RateLimitGroup.elevated)
        )

        authenticate = _make_authenticate(redis)
        ident_a = await authenticate(
            _http_scope(headers=[(b"authorization", b"Bearer polar_pat_a")])
        )
        ident_b = await authenticate(
            _http_scope(headers=[(b"authorization", b"Bearer polar_pat_b")])
        )

        assert ident_a == ("user:a", RateLimitGroup.default)
        assert ident_b == ("organization:b", RateLimitGroup.elevated)
