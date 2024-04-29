from collections.abc import Generator
from typing import TypeVar

import pytest

from polar.app import app
from polar.auth.dependencies import get_auth_subject as get_auth_subject_dependency
from polar.auth.models import Anonymous, AuthMethod, AuthSubject, Subject
from polar.auth.scope import Scope
from polar.models import User
from polar.models.organization import Organization

S = TypeVar("S", bound=Subject)


def get_auth_subject(
    subject: S,
    *,
    scopes: set[Scope] = {Scope.web_default},
    auth_method: AuthMethod = AuthMethod.COOKIE,
) -> AuthSubject[S]:
    return AuthSubject[S](subject, scopes, auth_method)


@pytest.fixture
def authenticated_marker(
    request: pytest.FixtureRequest,
    user: User,
    user_second: User,
    organization: Organization,
) -> Generator[AuthSubject[Subject], None, None]:
    auth_subject = AuthSubject[Subject](Anonymous(), set(), AuthMethod.NONE)

    authenticated_marker = request.node.get_closest_marker("authenticated")
    if authenticated_marker is not None:
        subject = authenticated_marker.kwargs.get("subject", "user")
        method = authenticated_marker.kwargs.get("method", AuthMethod.COOKIE)
        scopes = authenticated_marker.kwargs.get("scopes", {Scope.web_default})

        subjects_map: dict[str, User | Organization] = {
            "user": user,
            "user_second": user_second,
            "organization": organization,
        }
        auth_subject = AuthSubject(subjects_map[subject], scopes, method)

    app.dependency_overrides[get_auth_subject_dependency] = lambda: auth_subject

    yield auth_subject

    app.dependency_overrides.pop(get_auth_subject_dependency)
