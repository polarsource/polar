from collections.abc import Sequence

from fastapi.requests import Request
from ratelimit import RateLimitMiddleware, Rule
from ratelimit.backends.redis import RedisBackend
from ratelimit.types import ASGIApp, Scope

from polar.auth.models import AuthSubject, Subject, is_anonymous
from polar.config import Environment, settings
from polar.enums import RateLimitGroup
from polar.kit.http import get_ip_address
from polar.redis import Redis


async def _authenticate_ip(scope: Scope) -> tuple[str, RateLimitGroup]:
    ip = get_ip_address(Request(scope))
    return f"ip:{ip or 'anonymous'}", RateLimitGroup.default


async def _authenticate(scope: Scope) -> tuple[str, RateLimitGroup]:
    auth_subject: AuthSubject[Subject] = scope["state"]["auth_subject"]
    if is_anonymous(auth_subject):
        ip = get_ip_address(Request(scope))
        if ip is not None:
            return ip, RateLimitGroup.default
    return auth_subject.rate_limit_key


async def _authentication_ip(scope: Scope) -> tuple[str, RateLimitGroup]:
    user, group = await _authenticate_ip(scope)
    return f"authentication:{user}", group


_AUTHENTICATION_RULES: dict[str, Sequence[Rule]] = {
    "^/v1/login-code": [
        Rule(minute=6, hour=12, block_time=900, zone="login-code"),
    ],
    "^/v1/auth/email-otp": [
        Rule(minute=6, hour=12, block_time=900, zone="auth-email-otp"),
    ],
    "^/v1/auth/totp": [
        Rule(minute=6, hour=12, block_time=900, zone="auth-totp"),
    ],
    "^/v1/auth/backup-codes": [
        Rule(minute=6, hour=12, block_time=900, zone="auth-backup-codes"),
    ],
    "^/v1/customer-portal/customer-session/(start|email-otp)": [
        Rule(minute=6, hour=12, block_time=900, zone="customer-session-login"),
    ],
}

_BASE_RULES: dict[str, Sequence[Rule]] = {
    (
        "^/v1/(organizations/[^/]+/members/invite|"
        "(customer-seats|customer-portal/seats)(/[^/]+/resend)?)/?$"
    ): [
        Rule(
            group=group,
            method="POST",
            minute=6,
            hour=12,
            block_time=900,
            zone="invitations",
        )
        for group in RateLimitGroup
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
    "^/v1/customer-portal/customers/me/email-update/(request|check|verify)": [
        Rule(minute=6, hour=12, block_time=900, zone="customer-email-update"),
    ],
    "^/v1/customer-portal/license-keys/(validate|activate|deactivate)": [
        Rule(second=3, block_time=60, zone="customer-license-key"),
    ],
    "^/v1/customer-seats/claim/.+/stream": [
        Rule(minute=10, block_time=300, zone="seat-claim-stream"),
    ],
    "^/v1/checkouts/.+/confirm": [
        Rule(minute=6, hour=20, block_time=1800, zone="checkout-confirm"),
    ],
    # Caps refund creation well below the catch-all. Elevated is omitted so it
    # falls through to `^/v1`. POST-only so GET listing is unaffected.
    # No `block_time`: the library blocks the user on every path, not just this one.
    "^/v1/refunds": [
        Rule(method="POST", hour=10, zone="refunds"),
        Rule(group=RateLimitGroup.web, method="POST", hour=10, zone="refunds"),
        Rule(group=RateLimitGroup.restricted, method="POST", hour=10, zone="refunds"),
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
    ],
    # Each call is a live DNS lookup on a domain the caller chose, and resolvers
    # cache negative answers, so retrying quickly doesn't help.
    "^/v1/organizations/[^/]+/domains/[^/]+/verify": [
        Rule(minute=10, hour=60, zone="organization-domain-verify"),
        Rule(
            group=RateLimitGroup.web,
            minute=10,
            hour=60,
            zone="organization-domain-verify",
        ),
    ],
    "^/v1/feedbacks/": [
        Rule(hour=5, block_time=3600, zone="feedback-submit"),
    ],
    # Each call is an LLM run Polar pays for, so it's capped well below the
    # catch-all. All groups listed — an unmatched one falls through to `api`.
    "^/v1/compass/assistant": [
        Rule(minute=60, hour=500, zone="compass-assistant"),
        Rule(group=RateLimitGroup.web, minute=60, hour=500, zone="compass-assistant"),
        Rule(
            group=RateLimitGroup.elevated, minute=60, hour=500, zone="compass-assistant"
        ),
        Rule(
            group=RateLimitGroup.restricted,
            minute=60,
            hour=500,
            zone="compass-assistant",
        ),
    ],
    # Product name check validation in the dashboard product creation flow
    "^/v1/products/name-check": [
        Rule(minute=60, hour=500, zone="product-name-check"),
        Rule(group=RateLimitGroup.web, minute=60, hour=500, zone="product-name-check"),
        Rule(
            group=RateLimitGroup.elevated,
            minute=60,
            hour=500,
            zone="product-name-check",
        ),
        Rule(
            group=RateLimitGroup.restricted,
            minute=60,
            hour=500,
            zone="product-name-check",
        ),
    ],
    # Each sign-up creates an OAuth client and an agent.
    "^/v1/agent/identity/?$": [
        Rule(minute=5, hour=20, block_time=3600, zone="agent-sign-up"),
    ],
    # The claim code is three words, so wrong guesses are capped like login codes.
    # Only confirming counts: loading the claim page is `/v1/agent/claim/{token}`.
    "^/v1/agent/claim/?$": [
        Rule(minute=6, hour=12, block_time=900, zone="agent-claim"),
        Rule(
            group=RateLimitGroup.web,
            minute=6,
            hour=12,
            block_time=900,
            zone="agent-claim",
        ),
    ],
    # SDK telemetry exports share the token with event ingestion; their own zone
    # keeps a chatty exporter from spending the `api` budget of the events.
    # Restricted tokens keep their tighter `^/v1` limits.
    "^/v1/outpost/telemetry": [
        Rule(group=group, minute=120, zone="outpost-telemetry")
        for group in RateLimitGroup
        if group != RateLimitGroup.restricted
    ],
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


def get_ip_middleware(app: ASGIApp, redis: Redis) -> RateLimitMiddleware:
    rules: dict[str, Sequence[Rule]] = {}
    if settings.ENV in {Environment.production, Environment.sandbox}:
        # Allow shared IPs ten times the highest per-identity rate.
        rules = {"^/v1": [Rule(second=1000, zone="ip")]}
    return RateLimitMiddleware(app, _authenticate_ip, RedisBackend(redis), rules)


def get_authentication_middleware(app: ASGIApp, redis: Redis) -> RateLimitMiddleware:
    rules = (
        _AUTHENTICATION_RULES
        if settings.ENV in {Environment.production, Environment.sandbox}
        else {}
    )
    return RateLimitMiddleware(app, _authentication_ip, RedisBackend(redis), rules)


__all__ = ["get_authentication_middleware", "get_ip_middleware", "get_middleware"]
