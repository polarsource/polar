from collections.abc import Sequence

from ratelimit import RateLimitMiddleware, Rule
from ratelimit.auths import EmptyInformation
from ratelimit.auths.ip import client_ip
from ratelimit.backends.redis import RedisBackend
from ratelimit.types import ASGIApp, Scope

from polar.auth.models import AuthSubject, Subject, is_anonymous
from polar.enums import RateLimitGroup
from polar.redis import create_redis


async def _authenticate(scope: Scope) -> tuple[str, RateLimitGroup]:
    auth_subject: AuthSubject[Subject] = scope["state"]["auth_subject"]

    if is_anonymous(auth_subject):
        try:
            ip, _ = await client_ip(scope)
            return ip, RateLimitGroup.default
        except EmptyInformation:
            return auth_subject.rate_limit_key

    return auth_subject.rate_limit_key


_RULES: dict[str, Sequence[Rule]] = {
    "^/v1/login-code": [Rule(minute=3, hour=10, block_time=900, zone="login-code")],
    "^/v1/customer-portal/customer-session": [
        Rule(minute=3, hour=10, block_time=900, zone="customer-session")
    ],
    "^/v1/customer-portal/license-keys/(validate|activate|deactivate)": [
        Rule(second=3, block_time=60, zone="customer-license-key")
    ],
    "^/v1": [
        Rule(group=RateLimitGroup.default, minute=500, zone="api"),
        Rule(group=RateLimitGroup.web, second=100, zone="api"),
        Rule(group=RateLimitGroup.elevated, second=100, zone="api"),
    ],
}


def get_middleware(app: ASGIApp) -> RateLimitMiddleware:
    return RateLimitMiddleware(
        app, _authenticate, RedisBackend(create_redis("rate-limit")), _RULES
    )


__all__ = ["get_middleware"]
