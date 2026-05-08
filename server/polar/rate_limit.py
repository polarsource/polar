import hashlib
from collections.abc import Sequence
from functools import partial

from fastapi.security.utils import get_authorization_scheme_param
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
_ANONYMOUS_IDENTITY = "anonymous"

_AUTHORIZATION_HEADER = b"authorization"
_COOKIE_HEADER = b"cookie"


def _bearer_token(scope: Scope) -> str | None:
    if scope.get("type") != "http":
        return None
    for name, value in scope.get("headers", ()):
        if name != _AUTHORIZATION_HEADER:
            continue
        try:
            authorization = value.decode("ascii")
        except UnicodeDecodeError:
            return None
        scheme, token = get_authorization_scheme_param(authorization)
        if not scheme or scheme.lower() != "bearer" or not token:
            return None
        return token
    return None


def _session_cookie(scope: Scope) -> str | None:
    if scope.get("type") != "http":
        return None
    name_bytes = settings.USER_SESSION_COOKIE_KEY.encode("ascii")
    for header_name, header_value in scope.get("headers", ()):
        if header_name != _COOKIE_HEADER:
            continue
        for part in header_value.split(b";"):
            part = part.strip()
            equal = part.find(b"=")
            if equal == -1:
                continue
            if part[:equal] != name_bytes:
                continue
            try:
                value = part[equal + 1 :].decode("ascii")
            except UnicodeDecodeError:
                return None
            return value or None
    return None


def _token_hash(token: str) -> str:
    return hashlib.blake2b(token.encode(), digest_size=16).hexdigest()


def _identity_cache_key(token: str) -> str:
    digest = hashlib.blake2b(token.encode("ascii"), digest_size=16).hexdigest()
    return f"{_IDENTITY_KEY_PREFIX}{digest}"


async def _read_cached_identity(
    redis: Redis, token: str
) -> tuple[str, RateLimitGroup] | None:
    raw = await redis.get(_identity_cache_key(token))
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
    redis: Redis, token: str, key: tuple[str, RateLimitGroup]
) -> None:
    user, group = key
    await redis.set(
        _identity_cache_key(token),
        f"{group.value}|{user}",
        ex=_IDENTITY_TTL_SECONDS,
    )


async def clear_cached_identity(redis: Redis, token: str) -> None:
    await redis.delete(_identity_cache_key(token))


async def _authenticate(scope: Scope, *, redis: Redis) -> tuple[str, RateLimitGroup]:
    token = _bearer_token(scope)
    if token is not None:
        cached = await _read_cached_identity(redis, token)
        if cached is not None:
            return cached
        return f"token:{_token_hash(token)}", RateLimitGroup.pending_auth

    cookie = _session_cookie(scope)
    if cookie is not None:
        cached = await _read_cached_identity(redis, cookie)
        if cached is not None:
            return cached
        return f"cookie:{_token_hash(cookie)}", RateLimitGroup.pending_auth

    try:
        ip, _ = await client_ip(scope)
        return ip, RateLimitGroup.default
    except (EmptyInformation, ValueError, TypeError):
        return _ANONYMOUS_IDENTITY, RateLimitGroup.default


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
        Rule(group=RateLimitGroup.pending_auth, minute=10, zone="api"),
    ],
}

_PRODUCTION_RULES: dict[str, Sequence[Rule]] = {
    **_BASE_RULES,
    "^/v1": [
        Rule(group=RateLimitGroup.restricted, minute=60, zone="api"),
        Rule(group=RateLimitGroup.default, minute=500, zone="api"),
        Rule(group=RateLimitGroup.web, second=100, zone="api"),
        Rule(group=RateLimitGroup.elevated, second=100, zone="api"),
        Rule(group=RateLimitGroup.pending_auth, minute=10, zone="api"),
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
        app, partial(_authenticate, redis=redis), RedisBackend(redis), rules
    )


__all__ = [
    "clear_cached_identity",
    "get_middleware",
    "write_cached_identity",
]
