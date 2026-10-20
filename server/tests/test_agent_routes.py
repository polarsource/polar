from collections.abc import Sequence
from typing import Annotated, Any

import pytest
from fastapi import APIRouter, Depends, FastAPI
from fastapi.dependencies.models import Dependant
from fastapi.routing import APIRoute, APIWebSocketRoute, iter_route_contexts
from httpx import AsyncClient
from starlette.routing import BaseRoute

from polar.app import app
from polar.auth.dependencies import Authenticator, _Authenticator
from polar.auth.models import Agent, AuthSubject, User
from polar.authz.dependencies import OrgPolicyGuard
from polar.models import OAuth2Token
from polar.oauth2.dependencies import get_optional_token, get_token
from tests.fixtures.auth import AuthSubjectFixture

# Every route an unclaimed agent can call, as "METHOD /path".
AGENT_ROUTES: set[str] = {
    # Takes any valid OAuth2 access token, without an `Authenticator`.
    "GET /v1/oauth2/userinfo",
    "POST /v1/oauth2/userinfo",
}

# Dependencies that accept any valid OAuth2 access token, an agent's included.
_TOKEN_DEPENDENCIES = {get_token, get_optional_token}


def _accepts(dependant: Dependant, subject_type: type) -> bool:
    for dependency in dependant.dependencies:
        if dependency.call in _TOKEN_DEPENDENCIES:
            return True
        if (
            isinstance(dependency.call, _Authenticator)
            and subject_type in dependency.call.allowed_subjects
        ):
            return True
        if _accepts(dependency, subject_type):
            return True
    return False


def _routes_accepting(routes: Sequence[BaseRoute], subject_type: type) -> set[str]:
    accepted: set[str] = set()
    for route in iter_route_contexts(routes):
        if not isinstance(route.original_route, APIRoute | APIWebSocketRoute):
            continue
        dependant: Dependant | None = getattr(route, "dependant", None) or getattr(
            route.original_route, "dependant", None
        )
        assert dependant is not None, f"No dependant for {route.path}"
        if _accepts(dependant, subject_type):
            for method in route.methods or {"WEBSOCKET"}:
                accepted.add(f"{method} {route.path}")
    return accepted


def test_agent_routes() -> None:
    AGENT_ROUTES_MESSAGE = """
    The routes that accept the `Agent` subject changed. An unclaimed agent may
    only reach the catalog setup endpoints listed in ADR-0014, so every route
    that lists `Agent` in its `Authenticator`'s `allowed_subjects`, or takes any
    OAuth2 token directly, is pinned here.

    If you opened a route to agents on purpose, add it to `AGENT_ROUTES` in this
    test so it shows up in review. Otherwise, remove `Agent` from that route's
    `allowed_subjects`.
    """.strip()

    assert "GET /v1/products/" in _routes_accepting(app.routes, User)
    assert _routes_accepting(app.routes, Agent) == AGENT_ROUTES, AGENT_ROUTES_MESSAGE


def test_routes_accepting_detection() -> None:
    agent_authenticator = Authenticator(allowed_subjects={Agent})
    user_authenticator = Authenticator(allowed_subjects={User})

    async def nested(
        auth_subject: Annotated[AuthSubject[Agent], Depends(agent_authenticator)],
    ) -> None: ...

    test_app = FastAPI()

    @test_app.get("/policy-guard")
    async def policy_guard(
        context: Any = Depends(OrgPolicyGuard(allowed_subjects={User, Agent})),
    ) -> None: ...

    @test_app.get("/annotated")
    async def annotated(
        auth_subject: Annotated[AuthSubject[Agent], Depends(agent_authenticator)],
    ) -> None: ...

    @test_app.get("/nested", dependencies=[Depends(nested)])
    async def nested_route() -> None: ...

    @test_app.get("/token")
    async def token(token: OAuth2Token = Depends(get_token)) -> None: ...

    @test_app.get("/user")
    async def user(
        auth_subject: Annotated[AuthSubject[User], Depends(user_authenticator)],
    ) -> None: ...

    router = APIRouter(dependencies=[Depends(agent_authenticator)])

    @router.get("/router")
    async def router_route() -> None: ...

    test_app.include_router(router)

    assert _routes_accepting(test_app.routes, Agent) == {
        "GET /policy-guard",
        "GET /annotated",
        "GET /nested",
        "GET /token",
        "GET /router",
    }


@pytest.mark.anyio
@pytest.mark.auth(AuthSubjectFixture(subject="agent"))
async def test_route_without_agent_rejects_agent(client: AsyncClient) -> None:
    response = await client.get("/v1/products/")

    assert response.status_code == 401
