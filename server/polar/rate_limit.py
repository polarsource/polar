import hashlib
from collections.abc import Awaitable, Callable, Sequence

from ratelimit import RateLimitMiddleware, Rule
from ratelimit.auths import EmptyInformation
from ratelimit.auths.ip import client_ip
from ratelimit.backends.redis import RedisBackend
from ratelimit.types import ASGIApp, Scope

from polar.config import Environment, settings
from polar.enums import RateLimitGroup
from polar.redis import Redis

_IDENTITY_KEY_PREFIX = "rl:ident:"
_IDENTITY_TTL_SECONDS = 300

_AUTHORIZATION_HEADER = b"authorization"
_BEARER_PREFIX = b"bearer "


def _bearer_token(scope: Scope) -> bytes | None:
    if scope.get("type") != "http":
        return None
    for name, value in scope.get("headers", ()):
        if (
            name == _AUTHORIZATION_HEADER
            and value[: len(_BEARER_PREFIX)].lower() == _BEARER_PREFIX
        ):
            token = value[len(_BEARER_PREFIX) :].strip()
            return token or None
    return None


def _hash_token(token: bytes) -> str:
    return hashlib.blake2b(token, digest_size=16).hexdigest()


def identity_cache_key(token: bytes) -> str:
    return f"{_IDENTITY_KEY_PREFIX}{_hash_token(token)}"


async def _read_cached_identity(
    redis: Redis, token: bytes
) -> tuple[str, RateLimitGroup] | None:
    raw = await redis.get(identity_cache_key(token))
    if raw is None:
        return None
    group_str, sep, user = raw.partition("|")
    if not sep:
        return None
    try:
        return user, RateLimitGroup(group_str)
    except ValueError:
        return None


async def write_cached_identity(
    redis: Redis, token: bytes, key: tuple[str, RateLimitGroup]
) -> None:
    user, group = key
    await redis.set(
        identity_cache_key(token),
        f"{group.value}|{user}",
        ex=_IDENTITY_TTL_SECONDS,
    )


def _make_authenticate(
    redis: Redis,
) -> Callable[[Scope], Awaitable[tuple[str, RateLimitGroup]]]:
    async def _authenticate(scope: Scope) -> tuple[str, RateLimitGroup]:
        token = _bearer_token(scope)
        if token is not None:
            cached = await _read_cached_identity(redis, token)
            if cached is not None:
                return cached

        try:
            ip, _ = await client_ip(scope)
            return ip, RateLimitGroup.default
        except (EmptyInformation, ValueError, TypeError):
            return "anonymous", RateLimitGroup.default

    return _authenticate


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
    return RateLimitMiddleware(
        app, _make_authenticate(redis), RedisBackend(redis), rules
    )
