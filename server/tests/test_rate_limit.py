import pytest
from httpx import ASGITransport, AsyncClient
from pytest_mock import MockerFixture
from starlette.responses import Response
from starlette.types import Receive, Scope, Send

from polar.app import create_app
from polar.auth.middlewares import AuthSubjectMiddleware
from polar.auth.models import AuthSubject, Subject
from polar.config import Environment, settings
from polar.enums import RateLimitGroup
from polar.middlewares import TransactionalMiddleware
from polar.rate_limit import (
    _authenticate,
    get_authentication_middleware,
    get_ip_middleware,
    get_middleware,
)
from polar.redis import Redis
from tests.fixtures.auth import AuthSubjectFixture

_AUTHENTICATION_PATHS = [
    "/v1/login-code/request",
    "/v1/login-code/authenticate",
    "/v1/auth/email-otp/request",
    "/v1/auth/email-otp/verify",
    "/v1/auth/totp/verify",
    "/v1/auth/backup-codes/verify",
    "/v1/customer-portal/customer-session/start",
    "/v1/customer-portal/customer-session/email-otp/request",
    "/v1/customer-portal/customer-session/email-otp/verify",
]


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
class TestAuthenticationMiddleware:
    @pytest.mark.auth
    @pytest.mark.parametrize(
        "environment", [Environment.production, Environment.sandbox]
    )
    @pytest.mark.parametrize("path", _AUTHENTICATION_PATHS)
    async def test_authentication_attempts_share_ip_limit(
        self,
        mocker: MockerFixture,
        redis: Redis,
        auth_subject: AuthSubject[Subject],
        environment: Environment,
        path: str,
    ) -> None:
        mocker.patch.object(settings, "ENV", environment)

        async def endpoint(scope: Scope, receive: Receive, send: Send) -> None:
            await Response(status_code=204)(scope, receive, send)

        limiter = get_authentication_middleware(get_middleware(endpoint, redis), redis)
        ip_limiter = get_ip_middleware(limiter, redis)

        async def app(scope: Scope, receive: Receive, send: Send) -> None:
            scope["state"] = {"auth_subject": auth_subject}
            await ip_limiter(scope, receive, send)

        async with AsyncClient(
            transport=ASGITransport(app=app), base_url="http://test"
        ) as client:
            statuses = []
            for index in range(7):
                group = list(RateLimitGroup)[index % len(RateLimitGroup)]
                mocker.patch.object(
                    auth_subject, "rate_limit_key", (f"credential:{index}", group)
                )
                response = await client.post(path)
                statuses.append(response.status_code)
            other_ip = await client.post(path, headers={"true-client-ip": "2.2.2.2"})
            api = await client.get("/v1/products/")

        assert statuses == [204] * 6 + [429]
        assert response.headers["retry-after"] == "900"
        assert other_ip.status_code == 204
        assert api.status_code == 204

    async def test_authentication_block_skips_database_and_authentication(
        self, mocker: MockerFixture, redis: Redis
    ) -> None:
        mocker.patch.object(settings, "ENV", Environment.production)
        await redis.set("blocking:authentication:ip:1.1.1.1", 1, ex=900)

        async def endpoint(scope: Scope, receive: Receive, send: Send) -> None:
            raise AssertionError("Blocked requests must not reach the endpoint")

        limiter = get_authentication_middleware(
            TransactionalMiddleware(AuthSubjectMiddleware(endpoint)), redis
        )
        async with AsyncClient(
            transport=ASGITransport(app=limiter), base_url="http://test"
        ) as client:
            response = await client.post(
                "/v1/auth/email-otp/verify",
                headers={"true-client-ip": "1.1.1.1"},
            )

        assert response.status_code == 429


class TestMiddleware:
    @pytest.mark.anyio
    @pytest.mark.auth
    @pytest.mark.parametrize(
        "environment", [Environment.production, Environment.sandbox]
    )
    @pytest.mark.parametrize("group", list(RateLimitGroup))
    async def test_invitations_share_limit_across_routes(
        self,
        mocker: MockerFixture,
        redis: Redis,
        auth_subject: AuthSubject[Subject],
        environment: Environment,
        group: RateLimitGroup,
    ) -> None:
        mocker.patch.object(settings, "ENV", environment)
        mocker.patch.object(auth_subject, "rate_limit_key", ("inviter", group))

        async def endpoint(scope: Scope, receive: Receive, send: Send) -> None:
            await Response(status_code=204)(scope, receive, send)

        limiter = get_authentication_middleware(get_middleware(endpoint, redis), redis)

        async def app(scope: Scope, receive: Receive, send: Send) -> None:
            scope["state"] = {"auth_subject": auth_subject}
            await limiter(scope, receive, send)

        async with AsyncClient(
            transport=ASGITransport(app=app), base_url="http://test"
        ) as client:
            statuses = []
            for path in (
                "/v1/organizations/org-1/members/invite",
                "/v1/organizations/org-2/members/invite",
                "/v1/customer-seats",
                "/v1/customer-seats/seat-1/resend",
                "/v1/customer-portal/seats",
                "/v1/customer-portal/seats/seat-2/resend",
                "/v1/customer-seats/seat-3/resend",
            ):
                response = await client.post(path)
                statuses.append(response.status_code)
        assert statuses == [204] * 6 + [429]

    def test_app_middleware_order(self, mocker: MockerFixture, redis: Redis) -> None:
        mocker.patch("polar.app.settings.is_testing", return_value=False)
        create_redis = mocker.patch("polar.app.create_redis", return_value=redis)
        app = create_app()
        create_redis.assert_called_once_with("rate-limit")
        assert app.state.rate_limit_redis is redis
        middleware: list[object] = [item.cls for item in app.user_middleware]
        for factory in (
            get_middleware,
            get_authentication_middleware,
            get_ip_middleware,
        ):
            assert (
                app.user_middleware[middleware.index(factory)].kwargs["redis"] is redis
            )
        assert (
            middleware.index(get_ip_middleware)
            < middleware.index(get_authentication_middleware)
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


@pytest.mark.anyio
class TestEndpointRules:
    @pytest.mark.auth
    @pytest.mark.parametrize(
        "environment", [Environment.production, Environment.sandbox]
    )
    @pytest.mark.parametrize(
        ("path", "method", "group", "expected_zone"),
        [
            (path, method, group, zone)
            for paths, method, groups, zone in [
                (
                    [
                        f"{path}{suffix}"
                        for path in [
                            "/v1/organizations/org-id/members/invite",
                            "/v1/customer-seats",
                            "/v1/customer-seats/seat-id/resend",
                            "/v1/customer-portal/seats",
                            "/v1/customer-portal/seats/seat-id/resend",
                        ]
                        for suffix in ["", "/"]
                    ],
                    "POST",
                    list(RateLimitGroup),
                    "invitations",
                ),
                (
                    ["/v1/organizations/abc-123/domains/xyz-789/verify"],
                    "POST",
                    [RateLimitGroup.default],
                    "organization-domain-verify",
                ),
                (
                    ["/v1/customer-portal/customers/me/email-update/request"],
                    "POST",
                    [RateLimitGroup.default],
                    "customer-email-update",
                ),
                (
                    ["/v1/customer-portal/license-keys/validate"],
                    "POST",
                    [RateLimitGroup.default],
                    "customer-license-key",
                ),
                (
                    ["/v1/customer-seats/claim/abc-123/stream"],
                    "GET",
                    [RateLimitGroup.default],
                    "seat-claim-stream",
                ),
                (
                    ["/v1/checkouts/xyz-789/confirm"],
                    "POST",
                    [RateLimitGroup.default],
                    "checkout-confirm",
                ),
                (
                    ["/v1/feedbacks/"],
                    "POST",
                    [RateLimitGroup.default],
                    "feedback-submit",
                ),
                (
                    ["/v1/outpost/telemetry", "/v1/outpost/telemetry/metrics"],
                    "POST",
                    [
                        RateLimitGroup.default,
                        RateLimitGroup.web,
                        RateLimitGroup.elevated,
                    ],
                    "outpost-telemetry",
                ),
                (
                    ["/v1/outpost/telemetry"],
                    "POST",
                    [RateLimitGroup.restricted],
                    "api",
                ),
                (
                    ["/v1/email-update/request", "/v1/email-update/verify"],
                    "POST",
                    [RateLimitGroup.default, RateLimitGroup.web],
                    "email-update",
                ),
                (
                    ["/v1/compass/assistant"],
                    "POST",
                    list(RateLimitGroup),
                    "compass-assistant",
                ),
                (
                    ["/v1/refunds", "/v1/refunds/"],
                    "POST",
                    [
                        RateLimitGroup.default,
                        RateLimitGroup.web,
                        RateLimitGroup.restricted,
                    ],
                    "refunds",
                ),
                (
                    ["/v1/refunds/"],
                    "POST",
                    [RateLimitGroup.elevated],
                    "api",
                ),
                (
                    ["/v1/refunds/"],
                    "GET",
                    [RateLimitGroup.default],
                    "api",
                ),
                (
                    ["/v1/agent/claim"],
                    "POST",
                    [RateLimitGroup.default, RateLimitGroup.web],
                    "agent-claim",
                ),
                (
                    ["/v1/agent/claim/polar_acl_link"],
                    "GET",
                    [RateLimitGroup.default, RateLimitGroup.web],
                    "api",
                ),
                (
                    ["/v1/agent/identity", "/v1/agent/identity/"],
                    "POST",
                    [RateLimitGroup.default],
                    "agent-sign-up",
                ),
            ]
            for path in paths
            for group in groups
        ],
    )
    async def test_selected_rule(
        self,
        mocker: MockerFixture,
        redis: Redis,
        auth_subject: AuthSubject[Subject],
        environment: Environment,
        path: str,
        method: str,
        group: RateLimitGroup,
        expected_zone: str,
    ) -> None:
        mocker.patch.object(settings, "ENV", environment)
        mocker.patch.object(auth_subject, "rate_limit_key", ("credential", group))

        async def endpoint(scope: Scope, receive: Receive, send: Send) -> None:
            await Response(status_code=204)(scope, receive, send)

        limiter = get_middleware(endpoint, redis)
        retry_after = mocker.patch.object(
            limiter.backend, "retry_after", return_value=0
        )

        async def app(scope: Scope, receive: Receive, send: Send) -> None:
            scope["state"] = {"auth_subject": auth_subject}
            await limiter(scope, receive, send)

        async with AsyncClient(
            transport=ASGITransport(app=app), base_url="http://test"
        ) as client:
            response = await client.request(method, path)

        assert response.status_code == 204
        retry_after.assert_awaited_once()
        zone, identity, rule = retry_after.call_args.args
        assert zone == expected_zone
        assert identity == "credential"
        assert rule.group == group
        if expected_zone == "refunds":
            assert rule.hour == 10
            assert rule.block_time is None
        if expected_zone == "invitations":
            assert (rule.minute, rule.hour, rule.block_time) == (6, 12, 900)
