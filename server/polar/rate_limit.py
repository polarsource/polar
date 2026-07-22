import hashlib
from collections.abc import Sequence
from functools import partial

from fastapi.requests import Request
from fastapi.security.utils import get_authorization_scheme_param
from ratelimit import RateLimitMiddleware, Rule
from ratelimit.auths import EmptyInformation
from ratelimit.backends.redis import RedisBackend
from ratelimit.types import ASGIApp, Scope

from polar.config import Environment, settings
from polar.enums import RateLimitGroup
from polar.kit.http import get_ip_address
from polar.redis import Redis

_IDENTITY_KEY_PREFIX = "rl:ident:"
_IDENTITY_TTL_SECONDS = 300
_ANONYMOUS_IDENTITY = "anonymous"


def _bearer_token(scope: Scope) -> str | None:
    if scope.get("type") != "http":
        return None

    request = Request(scope)

    authorization = request.headers.get("authorization")
    if authorization is None:
        return None

    scheme, token = get_authorization_scheme_param(authorization)
    if not scheme or scheme.lower() != "bearer" or not token:
        return None

    return token


def _session_cookie(scope: Scope) -> str | None:
    if scope.get("type") != "http":
        return None

    request = Request(scope)
    value = request.cookies.get(settings.USER_SESSION_COOKIE_KEY)
    return value or None


def _auth_session_cookie(scope: Scope) -> str | None:
    if scope.get("type") != "http":
        return None

    request = Request(scope)
    value = request.cookies.get(settings.AUTHENTICATION_SESSION_COOKIE_KEY)
    return value or None


def _token_hash(token: str) -> str:
    return hashlib.blake2b(token.encode(), digest_size=16).hexdigest()


def _identity_cache_key(token: str) -> str:
    digest = hashlib.blake2b(token.encode(), digest_size=16).hexdigest()
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


def _get_ip(scope: Scope) -> tuple[str, RateLimitGroup]:
    ip = get_ip_address(Request(scope))
    if ip is None:
        raise EmptyInformation(scope)
    return ip, RateLimitGroup.default


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

    auth_session_cookie = _auth_session_cookie(scope)
    if auth_session_cookie is not None:
        return (
            f"auth_session_cookie:{_token_hash(auth_session_cookie)}",
            RateLimitGroup.default,
        )

    try:
        return _get_ip(scope)
    except (EmptyInformation, ValueError, TypeError):
        return _ANONYMOUS_IDENTITY, RateLimitGroup.default


# Each sensitive endpoint gets a `pending_auth` twin so requests with an
# unvalidated bearer token / cookie are counted in the endpoint's own zone
# instead of falling through to the catch-all `api` zone on `^/v1`.
_BASE_RULES: dict[str, Sequence[Rule]] = {
    "^/v1/login-code": [
        Rule(minute=6, hour=12, block_time=900, zone="login-code"),
        Rule(
            group=RateLimitGroup.pending_auth,
            minute=6,
            hour=12,
            block_time=900,
            zone="login-code",
        ),
    ],
    "^/v1/auth/email-otp": [
        Rule(minute=6, hour=12, block_time=900, zone="auth-email-otp"),
        Rule(
            group=RateLimitGroup.pending_auth,
            minute=6,
            hour=12,
            block_time=900,
            zone="auth-email-otp",
        ),
    ],
    "^/v1/auth/totp": [
        Rule(minute=6, hour=12, block_time=900, zone="auth-totp"),
        Rule(
            group=RateLimitGroup.pending_auth,
            minute=6,
            hour=12,
            block_time=900,
            zone="auth-totp",
        ),
    ],
    "^/v1/auth/backup-codes": [
        Rule(minute=6, hour=12, block_time=900, zone="auth-backup-codes"),
        Rule(
            group=RateLimitGroup.pending_auth,
            minute=6,
            hour=12,
            block_time=900,
            zone="auth-backup-codes",
        ),
    ],
    "^/v1/email-update/(request|verify)": [
        Rule(minute=6, hour=12, block_time=900, zone="email-update"),
        Rule(
            group=RateLimitGroup.web,
            minute=6,
            hour=12,
            block_time=900,
            zone="email-update",
        ),
    ],
    "^/v1/customer-portal/customer-session/(request|authenticate)": [
        Rule(minute=6, hour=12, block_time=900, zone="customer-session-login"),
        Rule(
            group=RateLimitGroup.pending_auth,
            minute=6,
            hour=12,
            block_time=900,
            zone="customer-session-login",
        ),
    ],
    "^/v1/customer-portal/customers/me/email-update/(request|check|verify)": [
        Rule(minute=6, hour=12, block_time=900, zone="customer-email-update"),
        Rule(
            group=RateLimitGroup.pending_auth,
            minute=6,
            hour=12,
            block_time=900,
            zone="customer-email-update",
        ),
    ],
    "^/v1/customer-portal/license-keys/(validate|activate|deactivate)": [
        Rule(second=3, block_time=60, zone="customer-license-key"),
        Rule(
            group=RateLimitGroup.pending_auth,
            second=3,
            block_time=60,
            zone="customer-license-key",
        ),
    ],
    "^/v1/customer-seats/claim/.+/stream": [
        Rule(minute=10, block_time=300, zone="seat-claim-stream"),
        Rule(
            group=RateLimitGroup.pending_auth,
            minute=10,
            block_time=300,
            zone="seat-claim-stream",
        ),
    ],
    "^/v1/checkouts/.+/confirm": [
        Rule(minute=6, hour=20, block_time=1800, zone="checkout-confirm"),
        Rule(
            group=RateLimitGroup.pending_auth,
            minute=6,
            hour=20,
            block_time=1800,
            zone="checkout-confirm",
        ),
    ],
    # Each call is a live Stripe API read, so it's capped well below the `web` group's
    # catch-all allowance.
    "^/v1/payout-accounts/[^/]+/sync": [
        Rule(minute=10, hour=60, zone="payout-account-sync"),
        Rule(
            group=RateLimitGroup.web,
            minute=10,
            hour=60,
            zone="payout-account-sync",
        ),
        Rule(
            group=RateLimitGroup.pending_auth,
            minute=10,
            hour=60,
            zone="payout-account-sync",
        ),
    ],
    "^/v1/feedbacks/": [
        Rule(hour=5, block_time=3600, zone="feedback-submit"),
        Rule(
            group=RateLimitGroup.pending_auth,
            hour=5,
            block_time=3600,
            zone="feedback-submit",
        ),
    ],
}

_SANDBOX_RULES: dict[str, Sequence[Rule]] = {
    **_BASE_RULES,
    "^/v1": [
        Rule(group=RateLimitGroup.restricted, minute=10, zone="api"),
        Rule(group=RateLimitGroup.default, minute=100, zone="api"),
        Rule(group=RateLimitGroup.web, second=50, zone="api"),
        Rule(group=RateLimitGroup.elevated, second=50, zone="api"),
        Rule(group=RateLimitGroup.pending_auth, minute=60, zone="api"),
    ],
}

_PRODUCTION_RULES: dict[str, Sequence[Rule]] = {
    **_BASE_RULES,
    "^/v1": [
        Rule(group=RateLimitGroup.restricted, minute=60, zone="api"),
        Rule(group=RateLimitGroup.default, minute=500, zone="api"),
        Rule(group=RateLimitGroup.web, second=100, zone="api"),
        Rule(group=RateLimitGroup.elevated, second=100, zone="api"),
        Rule(group=RateLimitGroup.pending_auth, minute=60, zone="api"),
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
