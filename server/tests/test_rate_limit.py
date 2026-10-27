import re
from collections.abc import Sequence

import pytest
from fakeredis import FakeAsyncRedis
from httpx import ASGITransport, AsyncClient
from pytest_mock import MockerFixture
from ratelimit import RateLimitMiddleware, Rule
from ratelimit.backends.redis import RedisBackend
from starlette.responses import Response
from starlette.types import Receive, Scope, Send

from polar.app import create_app
from polar.auth.middlewares import AuthSubjectMiddleware
from polar.auth.models import AuthSubject, Subject
from polar.config import Environment, settings
from polar.enums import RateLimitGroup
from polar.middlewares import TransactionalMiddleware
from polar.oauth2.constants import CLIENT_REGISTRATION_TOKEN_PREFIX
from polar.postgres import AsyncSession
from polar.rate_limit import (
    _PRODUCTION_RULES,
    _SANDBOX_RULES,
    _authenticate,
    get_ip_middleware,
    get_middleware,
)
from polar.redis import Redis
from tests.fixtures.auth import AuthSubjectFixture


@pytest.mark.anyio
class TestAuthenticate:
    @pytest.mark.auth(
        AuthSubjectFixture(subject="user"),
        AuthSubjectFixture(subject="organization"),
        AuthSubjectFixture(subject="customer"),
    )
    async def test_authenticated_identity(
        self, auth_subject: AuthSubject[Subject]
    ) -> None:
        identity = await _authenticate(
            {
                "type": "http",
                "headers": [(b"authorization", b"Bearer random-token")],
                "client": ("8.8.8.8", 1234),
                "state": {"auth_subject": auth_subject},
            }
        )
        assert identity == auth_subject.rate_limit_key

    @pytest.mark.parametrize(
        ("headers", "client", "expected"),
        [
            ([], ("8.8.8.8", 1234), "8.8.8.8"),
            ([(b"true-client-ip", b"1.1.1.1")], ("8.8.8.8", 1234), "1.1.1.1"),
            ([], None, "anonymous"),
        ],
    )
    async def test_anonymous_identity(
        self,
        auth_subject: AuthSubject[Subject],
        headers: list[tuple[bytes, bytes]],
        client: tuple[str, int] | None,
        expected: str,
    ) -> None:
        identity = await _authenticate(
            {
                "type": "http",
                "headers": headers,
                "client": client,
                "state": {"auth_subject": auth_subject},
            }
        )
        assert identity == (expected, RateLimitGroup.default)


@pytest.mark.anyio
class TestMiddleware:
    @pytest.mark.parametrize(
        ("header", "prefix"),
        [
            ("cookie", f"{settings.USER_SESSION_COOKIE_KEY}=random-"),
            ("cookie", f"{settings.AUTHENTICATION_SESSION_COOKIE_KEY}=random-"),
            ("authorization", f"Bearer {CLIENT_REGISTRATION_TOKEN_PREFIX}random-"),
        ],
    )
    async def test_rotating_credentials_share_ip_limit(
        self, session: AsyncSession, header: str, prefix: str
    ) -> None:
        async def endpoint(scope: Scope, receive: Receive, send: Send) -> None:
            await Response(status_code=204)(scope, receive, send)

        limiter = RateLimitMiddleware(
            endpoint,
            _authenticate,
            RedisBackend(FakeAsyncRedis(decode_responses=True)),
            _PRODUCTION_RULES,
        )
        auth = AuthSubjectMiddleware(limiter)

        async def app(scope: Scope, receive: Receive, send: Send) -> None:
            scope["state"] = {"async_session": session}
            await auth(scope, receive, send)

        async with AsyncClient(
            transport=ASGITransport(app=app), base_url="http://test"
        ) as client:
            statuses = []
            for index in range(7):
                response = await client.post(
                    "/v1/login-code/request",
                    headers={header: f"{prefix}{index}"},
                )
                statuses.append(response.status_code)
        assert statuses == [204] * 6 + [429]

    def test_app_middleware_order(self, mocker: MockerFixture, redis: Redis) -> None:
        mocker.patch("polar.app.settings.is_testing", return_value=False)
        create_redis = mocker.patch("polar.app.create_redis", return_value=redis)
        app = create_app()
        create_redis.assert_called_once_with("rate-limit")
        assert app.state.rate_limit_redis is redis
        middleware: list[object] = [item.cls for item in app.user_middleware]
        for factory in (get_middleware, get_ip_middleware):
            assert (
                app.user_middleware[middleware.index(factory)].kwargs["redis"] is redis
            )
        assert (
            middleware.index(get_ip_middleware)
            < middleware.index(TransactionalMiddleware)
            < middleware.index(AuthSubjectMiddleware)
            < middleware.index(get_middleware)
        )


@pytest.mark.anyio
class TestIPMiddleware:
    @pytest.mark.parametrize(
        "headers",
        [
            {"authorization": "Bearer random-token"},
            {"cookie": f"{settings.USER_SESSION_COOKIE_KEY}=random-session"},
        ],
    )
    async def test_blocked_ip_skips_database_and_authentication(
        self, mocker: MockerFixture, redis: Redis, headers: dict[str, str]
    ) -> None:
        mocker.patch.object(settings, "ENV", Environment.production)

        async def endpoint(scope: Scope, receive: Receive, send: Send) -> None:
            raise AssertionError("Blocked requests must not reach the endpoint")

        limiter = get_ip_middleware(
            TransactionalMiddleware(AuthSubjectMiddleware(endpoint)), redis
        )
        rule = next(iter(limiter.config.values()))[0]
        for key in rule.ruleset("ip", "ip:1.1.1.1"):
            await redis.set(key, 0, ex=60)

        async with AsyncClient(
            transport=ASGITransport(app=limiter), base_url="http://test"
        ) as client:
            response = await client.get(
                "/v1/products/", headers={**headers, "true-client-ip": "1.1.1.1"}
            )
        assert response.status_code == 429
        assert response.headers["retry-after"] == "1"

    async def test_ip_budgets_are_separate_and_health_is_exempt(
        self, mocker: MockerFixture, redis: Redis
    ) -> None:
        mocker.patch.object(settings, "ENV", Environment.production)

        async def endpoint(scope: Scope, receive: Receive, send: Send) -> None:
            await Response(status_code=204)(scope, receive, send)

        limiter = get_ip_middleware(endpoint, redis)
        rule = next(iter(limiter.config.values()))[0]
        for key in rule.ruleset("ip", "ip:1.1.1.1"):
            await redis.set(key, 1, ex=60)

        async with AsyncClient(
            transport=ASGITransport(app=limiter), base_url="http://test"
        ) as client:
            first = await client.get(
                "/v1/products/", headers={"true-client-ip": "1.1.1.1"}
            )
            blocked = await client.get(
                "/v1/orders/", headers={"true-client-ip": "1.1.1.1"}
            )
            other_ip = await client.get(
                "/v1/products/", headers={"true-client-ip": "2.2.2.2"}
            )
            health = await client.get("/healthz", headers={"true-client-ip": "1.1.1.1"})
        assert first.status_code == 204
        assert blocked.status_code == 429
        assert other_ip.status_code == 204
        assert health.status_code == 204


def _select_rule(
    rules: dict[str, Sequence[Rule]],
    path: str,
    group: RateLimitGroup,
    method: str = "GET",
) -> Rule | None:
    """Mirror the rule selection in ratelimit/core.py."""
    method = method.lower()
    for pattern, pattern_rules in rules.items():
        if not re.compile(pattern).match(path):
            continue
        for rule in pattern_rules:
            if rule.group == group and rule.method.lower() in (method, "*"):
                return rule
    return None


_SENSITIVE_PATHS: list[tuple[str, str]] = [
    ("/v1/login-code/request", "login-code"),
    ("/v1/customer-portal/customer-session/request", "customer-session-login"),
    ("/v1/customer-portal/customer-session/authenticate", "customer-session-login"),
    (
        "/v1/customer-portal/customers/me/email-update/request",
        "customer-email-update",
    ),
    ("/v1/customer-portal/license-keys/validate", "customer-license-key"),
    ("/v1/customer-seats/claim/abc-123/stream", "seat-claim-stream"),
    ("/v1/checkouts/xyz-789/confirm", "checkout-confirm"),
    ("/v1/feedbacks/", "feedback-submit"),
]


@pytest.mark.parametrize("rules", [_PRODUCTION_RULES, _SANDBOX_RULES])
@pytest.mark.parametrize(("path", "expected_zone"), _SENSITIVE_PATHS)
class TestSensitiveEndpointZoneIsolation:
    def test_resolves_to_endpoint_zone(
        self,
        rules: dict[str, Sequence[Rule]],
        path: str,
        expected_zone: str,
    ) -> None:
        rule = _select_rule(rules, path, RateLimitGroup.default)
        assert rule is not None
        assert rule.zone == expected_zone


@pytest.mark.parametrize("rules", [_PRODUCTION_RULES, _SANDBOX_RULES])
@pytest.mark.parametrize(
    "path", ["/v1/outpost/telemetry", "/v1/outpost/telemetry/metrics"]
)
@pytest.mark.parametrize(
    ("group", "expected_zone"),
    [
        (RateLimitGroup.default, "outpost-telemetry"),
        (RateLimitGroup.web, "outpost-telemetry"),
        (RateLimitGroup.elevated, "outpost-telemetry"),
        (RateLimitGroup.restricted, "api"),
    ],
)
class TestOutpostTelemetryZone:
    """SDK telemetry never spends the `api` budget of the token that ingests
    events, except for restricted tokens, which keep their
    tighter `api` limits."""

    def test_resolves_to_zone(
        self,
        rules: dict[str, Sequence[Rule]],
        path: str,
        group: RateLimitGroup,
        expected_zone: str,
    ) -> None:
        rule = _select_rule(rules, path, group, method="POST")
        assert rule is not None
        assert rule.zone == expected_zone


@pytest.mark.parametrize("rules", [_PRODUCTION_RULES, _SANDBOX_RULES])
@pytest.mark.parametrize(
    "path", ["/v1/email-update/request", "/v1/email-update/verify"]
)
@pytest.mark.parametrize("group", [RateLimitGroup.default, RateLimitGroup.web])
class TestEmailUpdateZone:
    """Email update is a web-session-only endpoint, so its callers resolve to
    the `web` group; without a dedicated `web` rule they would fall through to
    the catch-all "api" zone and its permissive per-second limits."""

    def test_resolves_to_email_update_zone(
        self, rules: dict[str, Sequence[Rule]], path: str, group: RateLimitGroup
    ) -> None:
        rule = _select_rule(rules, path, group)
        assert rule is not None
        assert rule.zone == "email-update"


@pytest.mark.parametrize("rules", [_PRODUCTION_RULES, _SANDBOX_RULES])
@pytest.mark.parametrize("group", list(RateLimitGroup))
class TestCompassAssistantZone:
    """Every call costs an LLM run, so no caller may reach the catch-all "api"
    zone. Rules are selected by exact group match and an unmatched group falls
    through rather than being denied, so every group needs its own rule."""

    def test_resolves_to_compass_zone(
        self, rules: dict[str, Sequence[Rule]], group: RateLimitGroup
    ) -> None:
        rule = _select_rule(rules, "/v1/compass/assistant", group)

        assert rule is not None, f"No rule selected for group={group.value!r}"
        assert rule.zone == "compass-assistant", (
            f"Group {group.value!r} resolved to zone {rule.zone!r} — it would "
            f"fall through to the catch-all allowance"
        )


@pytest.mark.parametrize("rules", [_PRODUCTION_RULES, _SANDBOX_RULES])
@pytest.mark.parametrize("path", ["/v1/refunds", "/v1/refunds/"])
@pytest.mark.parametrize(
    "group",
    [
        RateLimitGroup.default,
        RateLimitGroup.web,
        RateLimitGroup.restricted,
    ],
)
class TestRefundsPostZone:
    """Refund creation is capped for normal groups. Elevated is omitted so it
    falls through to the catch-all `api` zone."""

    def test_post_resolves_to_refunds_zone(
        self, rules: dict[str, Sequence[Rule]], path: str, group: RateLimitGroup
    ) -> None:
        rule = _select_rule(rules, path, group, method="POST")
        assert rule is not None, (
            f"No rule selected for path={path!r} group={group.value!r} POST"
        )
        assert rule.zone == "refunds"
        assert rule.hour == 10
        assert rule.block_time is None


@pytest.mark.parametrize("rules", [_PRODUCTION_RULES, _SANDBOX_RULES])
class TestRefundsElevatedAndGetFallThrough:
    def test_elevated_post_falls_through_to_api(
        self, rules: dict[str, Sequence[Rule]]
    ) -> None:
        rule = _select_rule(
            rules, "/v1/refunds/", RateLimitGroup.elevated, method="POST"
        )
        assert rule is not None
        assert rule.zone == "api"

    def test_get_uses_api_zone(self, rules: dict[str, Sequence[Rule]]) -> None:
        rule = _select_rule(rules, "/v1/refunds/", RateLimitGroup.default, method="GET")
        assert rule is not None
        assert rule.zone == "api"


@pytest.mark.parametrize("rules", [_PRODUCTION_RULES, _SANDBOX_RULES])
@pytest.mark.parametrize(
    "group",
    [RateLimitGroup.default, RateLimitGroup.web],
)
class TestAgentClaimZone:
    """Confirming a claim checks a 6-digit code, so guesses are capped like
    login codes; loading the claim page isn't."""

    def test_confirm_resolves_to_agent_claim_zone(
        self, rules: dict[str, Sequence[Rule]], group: RateLimitGroup
    ) -> None:
        rule = _select_rule(rules, "/v1/agent/claim", group, method="POST")

        assert rule is not None
        assert rule.zone == "agent-claim"

    def test_get_claim_uses_api_zone(
        self, rules: dict[str, Sequence[Rule]], group: RateLimitGroup
    ) -> None:
        rule = _select_rule(rules, "/v1/agent/claim/polar_acl_link", group)

        assert rule is not None
        assert rule.zone == "api"


@pytest.mark.parametrize("rules", [_PRODUCTION_RULES, _SANDBOX_RULES])
@pytest.mark.parametrize("path", ["/v1/agent/identity", "/v1/agent/identity/"])
class TestAgentSignUpZone:
    """Each sign-up creates an OAuth client and an agent, so anonymous callers
    are capped per IP like login codes."""

    def test_resolves_to_agent_sign_up_zone(
        self, rules: dict[str, Sequence[Rule]], path: str
    ) -> None:
        rule = _select_rule(rules, path, RateLimitGroup.default, method="POST")

        assert rule is not None
        assert rule.zone == "agent-sign-up"
