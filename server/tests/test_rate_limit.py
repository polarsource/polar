from collections.abc import AsyncIterator
from unittest.mock import MagicMock

import pytest
import pytest_asyncio
from fakeredis import FakeAsyncRedis
from starlette.types import Message, Receive, Scope, Send

from polar.auth.models import Anonymous, AuthSubject
from polar.models import User
from polar.rate_limit import (
    _BLOCK_KEY_PREFIX,
    _DEFAULT_BLOCK_SECONDS,
    _MAX_BLOCK_SECONDS,
    RateLimitFastPathMiddleware,
    _caller_identity,
)
from polar.redis import Redis


@pytest_asyncio.fixture
async def redis() -> AsyncIterator[Redis]:
    # Override the shared autouse fixture (tests/fixtures/redis.py) with
    # decode_responses=True so .get() returns str matching the project-wide
    # Redis type hint — letting tests assert direct string equality.
    yield FakeAsyncRedis(decode_responses=True)


_ANON_SUBJECT = AuthSubject(Anonymous(), set(), None)
_AUTHED_SUBJECT = AuthSubject(MagicMock(spec=User), set(), None)


_BEARER_HEADER = (b"authorization", b"Bearer secret-abc")


def _http_scope(
    *,
    path: str = "/v1/orders",
    headers: list[tuple[bytes, bytes]] | None = None,
    client: tuple[str, int] | None = ("1.2.3.4", 5000),
    auth_subject: object | None = None,
) -> Scope:
    scope: Scope = {
        "type": "http",
        "path": path,
        "headers": headers or [],
        "client": client,
    }
    if auth_subject is not None:
        scope["state"] = {"auth_subject": auth_subject}
    return scope


async def _noop_receive() -> Message:
    return {"type": "http.disconnect"}


class _RecordingApp:
    def __init__(
        self,
        status: int = 200,
        extra_headers: list[tuple[bytes, bytes]] | None = None,
        auth_subject_to_set: object | None = None,
    ) -> None:
        self.status = status
        self.extra_headers = extra_headers or []
        self.auth_subject_to_set = auth_subject_to_set
        self.calls = 0

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        self.calls += 1
        # Simulate AuthSubjectMiddleware populating scope state on the way in.
        if self.auth_subject_to_set is not None:
            scope.setdefault("state", {})["auth_subject"] = self.auth_subject_to_set
        await send(
            {
                "type": "http.response.start",
                "status": self.status,
                "headers": [
                    (b"content-type", b"text/plain"),
                    *self.extra_headers,
                ],
            }
        )
        await send({"type": "http.response.body", "body": b"ok"})


class _CapturingSend:
    def __init__(self) -> None:
        self.messages: list[Message] = []

    async def __call__(self, message: Message) -> None:
        self.messages.append(message)

    @property
    def status(self) -> int | None:
        for msg in self.messages:
            if msg["type"] == "http.response.start":
                return msg["status"]
        return None

    def header(self, name: bytes) -> bytes | None:
        for msg in self.messages:
            if msg["type"] == "http.response.start":
                for k, v in msg["headers"]:
                    if k == name:
                        return v
        return None


class TestCallerIdentity:
    def test_bearer_token_hashed(self) -> None:
        scope = _http_scope(headers=[_BEARER_HEADER])
        ident = _caller_identity(scope)
        assert ident is not None
        assert ident.startswith("t:")
        assert "secret-abc" not in ident  # raw token must not appear

    def test_bearer_is_case_insensitive(self) -> None:
        scope = _http_scope(headers=[(b"authorization", b"bearer xyz")])
        assert _caller_identity(scope) is not None

    def test_non_bearer_falls_back_to_ip(self) -> None:
        scope = _http_scope(headers=[(b"authorization", b"Basic abc")])
        assert _caller_identity(scope) == "ip:1.2.3.4"

    def test_ip_when_no_auth_header(self) -> None:
        scope = _http_scope()
        assert _caller_identity(scope) == "ip:1.2.3.4"

    def test_returns_none_without_auth_or_client(self) -> None:
        scope = _http_scope(client=None)
        assert _caller_identity(scope) is None

    def test_empty_bearer_falls_back_to_ip(self) -> None:
        scope = _http_scope(headers=[(b"authorization", b"Bearer   ")])
        assert _caller_identity(scope) == "ip:1.2.3.4"


@pytest.mark.asyncio
class TestRateLimitFastPathMiddlewareShortCircuit:
    """Behavior when reading an existing block on the way in."""

    async def test_passes_through_when_no_block(self, redis: Redis) -> None:
        app = _RecordingApp()
        middleware = RateLimitFastPathMiddleware(app, redis)
        send = _CapturingSend()

        await middleware(_http_scope(), _noop_receive, send)

        assert app.calls == 1
        assert send.status == 200

    async def test_returns_429_when_blocked(self, redis: Redis) -> None:
        scope = _http_scope()
        ident = _caller_identity(scope)
        assert ident is not None
        await redis.set(_BLOCK_KEY_PREFIX + ident, 300, ex=300)

        app = _RecordingApp()
        middleware = RateLimitFastPathMiddleware(app, redis)
        send = _CapturingSend()

        await middleware(scope, _noop_receive, send)

        assert app.calls == 0  # downstream never invoked
        assert send.status == 429
        assert send.header(b"retry-after") == b"300"

    async def test_skips_non_v1_paths(self, redis: Redis) -> None:
        scope = _http_scope(path="/healthz")
        ident = _caller_identity(scope)
        assert ident is not None
        await redis.set(_BLOCK_KEY_PREFIX + ident, 300, ex=300)

        app = _RecordingApp()
        middleware = RateLimitFastPathMiddleware(app, redis)
        send = _CapturingSend()

        await middleware(scope, _noop_receive, send)

        assert app.calls == 1
        assert send.status == 200

    async def test_lifespan_passes_through(self, redis: Redis) -> None:
        app = _RecordingApp()
        middleware = RateLimitFastPathMiddleware(app, redis)
        # Lifespan scopes do not have headers/client; middleware must not crash.
        await middleware({"type": "lifespan"}, _noop_receive, _CapturingSend())
        assert app.calls == 1


@pytest.mark.asyncio
class TestRateLimitFastPathMiddlewareWriteOnTrip:
    """Behavior when observing a downstream 429 on the way out."""

    async def test_no_block_written_on_2xx(self, redis: Redis) -> None:
        app = _RecordingApp(status=200)
        middleware = RateLimitFastPathMiddleware(app, redis)

        await middleware(_http_scope(), _noop_receive, _CapturingSend())

        keys = [k async for k in redis.scan_iter("rl:*")]
        assert keys == []

    async def test_uses_retry_after_for_block_duration(
        self, redis: Redis
    ) -> None:
        app = _RecordingApp(status=429, extra_headers=[(b"retry-after", b"42")])
        middleware = RateLimitFastPathMiddleware(app, redis)
        scope = _http_scope()
        ident = _caller_identity(scope)
        assert ident is not None

        await middleware(scope, _noop_receive, _CapturingSend())

        block = await redis.get(_BLOCK_KEY_PREFIX + ident)
        assert block is not None
        assert block == "42"
        ttl = await redis.ttl(_BLOCK_KEY_PREFIX + ident)
        assert 0 < ttl <= 42

    async def test_falls_back_to_default_when_no_retry_after(
        self, redis: Redis
    ) -> None:
        app = _RecordingApp(status=429)
        middleware = RateLimitFastPathMiddleware(app, redis)
        scope = _http_scope()
        ident = _caller_identity(scope)
        assert ident is not None

        await middleware(scope, _noop_receive, _CapturingSend())

        block = await redis.get(_BLOCK_KEY_PREFIX + ident)
        assert block is not None
        assert block == str(_DEFAULT_BLOCK_SECONDS)

    async def test_ignores_unparseable_retry_after(self, redis: Redis) -> None:
        # asgi-ratelimit always emits seconds, but RFC allows HTTP-date too.
        # We don't parse dates; we just fall back to the default.
        app = _RecordingApp(
            status=429,
            extra_headers=[(b"retry-after", b"Wed, 21 Oct 2026 07:28:00 GMT")],
        )
        middleware = RateLimitFastPathMiddleware(app, redis)
        scope = _http_scope()
        ident = _caller_identity(scope)
        assert ident is not None

        await middleware(scope, _noop_receive, _CapturingSend())

        block = await redis.get(_BLOCK_KEY_PREFIX + ident)
        assert block is not None
        assert block == str(_DEFAULT_BLOCK_SECONDS)

    async def test_isolates_identities(self, redis: Redis) -> None:
        app = _RecordingApp(status=429)
        middleware = RateLimitFastPathMiddleware(app, redis)

        attacker = _http_scope(client=("9.9.9.9", 1))
        bystander = _http_scope(client=("1.1.1.1", 1))

        await middleware(attacker, _noop_receive, _CapturingSend())
        # Bystander never trips, so no entry should exist for them.

        attacker_id = _caller_identity(attacker)
        bystander_id = _caller_identity(bystander)
        assert attacker_id is not None
        assert bystander_id is not None

        assert await redis.get(_BLOCK_KEY_PREFIX + attacker_id) is not None
        assert await redis.get(_BLOCK_KEY_PREFIX + bystander_id) is None

    async def test_negative_retry_after_falls_back_to_default(
        self, redis: Redis
    ) -> None:
        # A negative ex on real Redis would raise after http.response.start
        # was already sent, corrupting the response. Clamp to the default.
        app = _RecordingApp(
            status=429, extra_headers=[(b"retry-after", b"-1")]
        )
        middleware = RateLimitFastPathMiddleware(app, redis)
        scope = _http_scope()
        ident = _caller_identity(scope)
        assert ident is not None

        await middleware(scope, _noop_receive, _CapturingSend())

        block = await redis.get(_BLOCK_KEY_PREFIX + ident)
        assert block is not None
        assert block == str(_DEFAULT_BLOCK_SECONDS)

    async def test_huge_retry_after_falls_back_to_default(
        self, redis: Redis
    ) -> None:
        app = _RecordingApp(
            status=429,
            extra_headers=[(b"retry-after", str(_MAX_BLOCK_SECONDS + 1).encode())],
        )
        middleware = RateLimitFastPathMiddleware(app, redis)
        scope = _http_scope()
        ident = _caller_identity(scope)
        assert ident is not None

        await middleware(scope, _noop_receive, _CapturingSend())

        block = await redis.get(_BLOCK_KEY_PREFIX + ident)
        assert block is not None
        assert block == str(_DEFAULT_BLOCK_SECONDS)


@pytest.mark.asyncio
class TestRateLimitFastPathMiddlewareAuthGating:
    """Auto-block writes are gated on the bearer token having been
    validated by AuthSubjectMiddleware to a non-anonymous subject.

    Without this gate, an unauthenticated attacker could supply arbitrary
    bearer bytes, trigger any 429, and write a block keyed on the hash —
    locking out the legitimate owner of any token they can observe.
    """

    async def test_block_written_for_authenticated_bearer(
        self, redis: Redis
    ) -> None:
        app = _RecordingApp(status=429, auth_subject_to_set=_AUTHED_SUBJECT)
        middleware = RateLimitFastPathMiddleware(app, redis)
        scope = _http_scope(headers=[_BEARER_HEADER])
        ident = _caller_identity(scope)
        assert ident is not None
        assert ident.startswith("t:")

        await middleware(scope, _noop_receive, _CapturingSend())

        assert await redis.get(_BLOCK_KEY_PREFIX + ident) is not None

    async def test_no_block_for_anonymous_bearer(self, redis: Redis) -> None:
        # Bearer header present but auth resolved to Anonymous (e.g.
        # registration-token-prefix path, or any other case where the
        # bearer bytes were not validated as a real credential).
        app = _RecordingApp(status=429, auth_subject_to_set=_ANON_SUBJECT)
        middleware = RateLimitFastPathMiddleware(app, redis)
        scope = _http_scope(headers=[_BEARER_HEADER])
        ident = _caller_identity(scope)
        assert ident is not None
        assert ident.startswith("t:")

        await middleware(scope, _noop_receive, _CapturingSend())

        assert await redis.get(_BLOCK_KEY_PREFIX + ident) is None

    async def test_no_block_when_auth_subject_missing(
        self, redis: Redis
    ) -> None:
        # Defensive: scope state may be empty if AuthSubjectMiddleware
        # didn't run (e.g. an earlier middleware short-circuited).
        app = _RecordingApp(status=429)  # does not set auth_subject
        middleware = RateLimitFastPathMiddleware(app, redis)
        scope = _http_scope(headers=[_BEARER_HEADER])
        ident = _caller_identity(scope)
        assert ident is not None
        assert ident.startswith("t:")

        await middleware(scope, _noop_receive, _CapturingSend())

        assert await redis.get(_BLOCK_KEY_PREFIX + ident) is None

    async def test_block_written_for_ip_identity_without_auth_subject(
        self, redis: Redis
    ) -> None:
        # No bearer header → identity is IP-based → gate does not apply.
        app = _RecordingApp(status=429)
        middleware = RateLimitFastPathMiddleware(app, redis)
        scope = _http_scope()
        ident = _caller_identity(scope)
        assert ident is not None
        assert ident.startswith("ip:")

        await middleware(scope, _noop_receive, _CapturingSend())

        assert await redis.get(_BLOCK_KEY_PREFIX + ident) is not None


@pytest.mark.asyncio
class TestRateLimitFastPathMiddlewareEndToEnd:
    """First request trips downstream → second request takes the short-circuit."""

    async def test_trip_then_short_circuit(self, redis: Redis) -> None:
        app = _RecordingApp(status=429, extra_headers=[(b"retry-after", b"30")])
        middleware = RateLimitFastPathMiddleware(app, redis)
        scope = _http_scope()

        # First request: hits downstream, gets 429, block written.
        await middleware(scope, _noop_receive, _CapturingSend())
        assert app.calls == 1

        # Second request: short-circuited by the block, downstream not invoked.
        send = _CapturingSend()
        await middleware(scope, _noop_receive, send)
        assert app.calls == 1
        assert send.status == 429
        assert send.header(b"retry-after") == b"30"
