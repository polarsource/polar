import hashlib
from collections.abc import Iterable, Sequence

import structlog
from ratelimit import RateLimitMiddleware, Rule
from ratelimit.auths import EmptyInformation
from ratelimit.auths.ip import client_ip
from ratelimit.backends.redis import RedisBackend
from starlette.types import ASGIApp, Message, Receive, Send
from starlette.types import Scope as ASGIScope

from polar.auth.models import AuthSubject, Subject, is_anonymous
from polar.config import Environment, settings
from polar.enums import RateLimitGroup
from polar.logging import Logger
from polar.redis import Redis

log: Logger = structlog.get_logger()


async def _authenticate(scope: ASGIScope) -> tuple[str, RateLimitGroup]:
    auth_subject: AuthSubject[Subject] = scope["state"]["auth_subject"]

    if is_anonymous(auth_subject):
        try:
            ip, _ = await client_ip(scope)
            return ip, RateLimitGroup.default
        except (EmptyInformation, ValueError, TypeError):
            return auth_subject.rate_limit_key

    return auth_subject.rate_limit_key


_BASE_RULES: dict[str, Sequence[Rule]] = {
    "^/v1/login-code": [Rule(minute=6, hour=12, block_time=900, zone="login-code")],
    "^/v1/customer-portal/customer-session/(request|authenticate)": [
        Rule(minute=6, hour=12, block_time=900, zone="customer-session-login")
    ],
    "^/v1/customer-portal/customers/me/email-update/(request|check|verify)": [
        Rule(minute=6, hour=12, block_time=900, zone="customer-email-update")
    ],
    "^/v1/customer-portal/license-keys/(validate|activate|deactivate)": [
        Rule(second=3, block_time=60, zone="customer-license-key")
    ],
    "^/v1/customer-seats/claim/.+/stream": [
        Rule(minute=10, block_time=300, zone="seat-claim-stream")
    ],
    "^/v1/checkouts/.+/confirm": [
        Rule(minute=6, hour=20, block_time=1800, zone="checkout-confirm")
    ],
    "^/v1/feedbacks/": [Rule(hour=5, block_time=3600, zone="feedback-submit")],
}

_SANDBOX_RULES: dict[str, Sequence[Rule]] = {
    **_BASE_RULES,
    "^/v1": [
        Rule(group=RateLimitGroup.restricted, minute=10, zone="api"),
        Rule(group=RateLimitGroup.default, minute=100, zone="api"),
        Rule(group=RateLimitGroup.web, second=50, zone="api"),
        Rule(group=RateLimitGroup.elevated, second=50, zone="api"),
    ],
}

_PRODUCTION_RULES: dict[str, Sequence[Rule]] = {
    **_BASE_RULES,
    "^/v1": [
        Rule(group=RateLimitGroup.restricted, minute=60, zone="api"),
        Rule(group=RateLimitGroup.default, minute=500, zone="api"),
        Rule(group=RateLimitGroup.web, second=100, zone="api"),
        Rule(group=RateLimitGroup.elevated, second=100, zone="api"),
    ],
}


def get_middleware(app: ASGIApp, redis: Redis) -> RateLimitMiddleware:
    match settings.ENV:
        case Environment.production:
            rules = _PRODUCTION_RULES
        case Environment.sandbox:
            rules = _SANDBOX_RULES
        case _:
            rules = {}
    return RateLimitMiddleware(app, _authenticate, RedisBackend(redis), rules)


# --- Fast path ----------------------------------------------------------
#
# The post-auth limiter above runs after AuthSubjectMiddleware has already
# done up to 5 sequential token lookups + Dramatiq enqueues. Under abuse
# that's enough work to spike CPU even though every response is a 429.
#
# RateLimitFastPathMiddleware sits *outside* auth and the DB session and
# does both halves of the same loop using a coarse caller identity (bearer
# token hash or client IP):
#
#   - On the way in: one Redis GET. If a block is set, return 429
#     immediately with no DB, no auth, no Dramatiq.
#   - On the way out: if downstream returned 429, write a block whose TTL
#     mirrors the response's Retry-After header (clamped to a sane range)
#     so the block matches whatever the rate-limit rule already decided
#     (window reset time or the rule's block_time), falling back to
#     _DEFAULT_BLOCK_SECONDS.
#
# The auto-block write is gated on caller identity being trustworthy: if
# the request presented a bearer token but AuthSubjectMiddleware did not
# validate it to a non-anonymous subject, we skip the write. Otherwise an
# unauthenticated attacker could supply arbitrary bearer bytes and get a
# block keyed on that hash, which would lock out the legitimate owner of
# any token whose hash collides (or, more realistically, lock out anyone
# whose token they observed).

_BLOCK_KEY_PREFIX = "rl:block:"
_DEFAULT_BLOCK_SECONDS = 60
_MAX_BLOCK_SECONDS = 3600  # ceiling for downstream-supplied Retry-After


def _parse_retry_after(headers: Iterable[tuple[bytes, bytes]]) -> int | None:
    """Extract a sane Retry-After value (seconds) from response headers.

    Returns None if absent, unparseable, non-positive, or larger than
    _MAX_BLOCK_SECONDS — so a misbehaving downstream component cannot pin a
    block for an arbitrary duration.
    """
    for name, value in headers:
        if name.lower() != b"retry-after":
            continue
        try:
            parsed = int(value)
        except ValueError:
            return None
        return parsed if 0 < parsed <= _MAX_BLOCK_SECONDS else None
    return None


def _caller_identity(scope: ASGIScope) -> str | None:
    """Coarse caller identity from the raw ASGI scope, no DB or auth.

    Returns a hashed bearer token if present, else the client IP.
    None when neither is available (we let the request through in that
    case rather than block-by-default).
    """
    for name, value in scope.get("headers", ()):
        if name == b"authorization":
            if value[:7].lower() == b"bearer ":
                token = value[7:].strip()
                if token:
                    return "t:" + hashlib.blake2b(token, digest_size=16).hexdigest()
            break
    client = scope.get("client")
    if client and client[0]:
        return f"ip:{client[0]}"
    return None


class RateLimitFastPathMiddleware:
    """Short-circuits blocked callers around the auth + DB stack.

    Returns 429 from a single Redis GET when a block is set, and writes
    that block whenever a downstream 429 is observed.
    """

    def __init__(self, app: ASGIApp, redis: Redis) -> None:
        self.app = app
        self.redis = redis

    async def __call__(self, scope: ASGIScope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http" or not scope["path"].startswith("/v1"):
            await self.app(scope, receive, send)
            return

        ident = _caller_identity(scope)
        if ident is None:
            await self.app(scope, receive, send)
            return

        block_key = _BLOCK_KEY_PREFIX + ident
        blocked = await self.redis.get(block_key)
        if blocked:
            await send(
                {
                    "type": "http.response.start",
                    "status": 429,
                    "headers": [
                        (b"content-type", b"text/plain; charset=utf-8"),
                        (b"retry-after", str(int(blocked)).encode()),
                    ],
                }
            )
            await send({"type": "http.response.body", "body": b"Too Many Requests"})
            return

        start_message: Message | None = None

        async def send_wrapper(message: Message) -> None:
            nonlocal start_message
            if start_message is None and message["type"] == "http.response.start":
                start_message = message
            await send(message)

        await self.app(scope, receive, send_wrapper)

        if start_message is None or start_message["status"] != 429:
            return

        # If the caller presented a bearer token but auth did NOT validate
        # it to a real subject, the token bytes are attacker-controlled —
        # do not write a block keyed on their hash.
        if ident.startswith("t:"):
            auth_subject = scope.get("state", {}).get("auth_subject")
            if auth_subject is None or is_anonymous(auth_subject):
                return

        retry_after = _parse_retry_after(start_message["headers"])
        block_seconds = retry_after if retry_after else _DEFAULT_BLOCK_SECONDS
        await self.redis.set(block_key, block_seconds, ex=block_seconds)
        log.info(
            "rate_limit.fastpath.block_set",
            identity=ident,
            ttl_seconds=block_seconds,
        )
