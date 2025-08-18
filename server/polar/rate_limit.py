from collections.abc import Sequence

from ratelimit import RateLimitMiddleware, Rule
from ratelimit.auths import EmptyInformation
from ratelimit.auths.ip import client_ip
from ratelimit.backends.redis import RedisBackend
from ratelimit.types import ASGIApp, Scope

from polar.auth.models import AuthSubject, Subject, is_anonymous
from polar.redis import create_redis


async def _authenticate(scope: Scope) -> tuple[str, str]:
    auth_subject: AuthSubject[Subject] = scope["state"]["auth_subject"]

    if is_anonymous(auth_subject):
        try:
            return await client_ip(scope)
        except EmptyInformation:
            return auth_subject.rate_limit_key, "default"

    return auth_subject.rate_limit_key, "default"


_RULES: dict[str, Sequence[Rule]] = {
    "^/v1/login-code": [Rule(minute=3, hour=10, block_time=900, zone="login-code")],
    "^/v1/customer-portal/customer-session": [
        Rule(minute=3, hour=10, block_time=900, zone="customer-session")
    ],
    "^/v1/customer-portal/license-keys/(validate|activate|deactivate)": [
        Rule(second=1, block_time=60, zone="customer-license-key")
    ],
    "^/v1": [Rule(second=100, zone="api")],
}


def get_middleware(app: ASGIApp) -> RateLimitMiddleware:
    return RateLimitMiddleware(
        app, _authenticate, RedisBackend(create_redis("rate-limit")), _RULES
    )


__all__ = ["get_middleware"]
