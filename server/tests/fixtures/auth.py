from typing import Any, Literal

import pytest

from polar.auth.models import Anonymous, AuthMethod, AuthSubject, Subject
from polar.auth.scope import Scope
from polar.models import User
from polar.models.organization import Organization


class AuthSubjectFixture:
    def __init__(
        self,
        *,
        subject: Literal[
            "anonymous", "user", "user_second", "organization", "organization_second"
        ] = "user",
        scopes: set[Scope] = {Scope.web_default},
        method: AuthMethod = AuthMethod.COOKIE,
    ):
        self.subject = subject
        self.scopes = scopes
        self.method = method

    def __repr__(self) -> str:
        scopes = "{" + ", ".join(repr(scope.value) for scope in self.scopes) + "}"
        return (
            "AuthSubjectFixture("
            f"subject={self.subject!r}, "
            f"scopes={scopes}, "
            f"method={self.method})"
        )


@pytest.fixture
def auth_subject(
    request: pytest.FixtureRequest,
    user: User,
    user_second: User,
    organization: Organization,
    organization_second: Organization,
) -> AuthSubject[Subject]:
    """
    This fixture generates an AuthSubject instance used by the `client` fixture
    to override the FastAPI authentication dependency, but also can be used manually
    if needed.

    Its parameters are generated through the `authenticated` marker.
    Seee `pytest_generate_tests` below for more information.
    """
    auth_subject_fixture: AuthSubjectFixture = request.param
    subjects_map: dict[str, Anonymous | User | Organization] = {
        "anonymous": Anonymous(),
        "user": user,
        "user_second": user_second,
        "organization": organization,
        "organization_second": organization_second,
    }
    return AuthSubject(
        subjects_map[auth_subject_fixture.subject],
        auth_subject_fixture.scopes,
        auth_subject_fixture.method,
    )


def pytest_generate_tests(metafunc: pytest.Metafunc) -> None:
    # The test requests the `auth_subject` fixture
    if "auth_subject" in metafunc.fixturenames:
        pytest_params = []

        # The test is decorated with the `authenticated` marker
        authenticated_marker = metafunc.definition.get_closest_marker("authenticated")
        if authenticated_marker is not None:
            # No argument: use a default AuthSubjectFixture
            args: tuple[Any] = authenticated_marker.args
            if len(args) == 0:
                args = (AuthSubjectFixture(),)

            # Generate a test for each AuthSubjectFixture argument
            for arg in args:
                if not isinstance(arg, AuthSubjectFixture):
                    raise ValueError(
                        "authenticated marker arguments must be "
                        f"of type AuthSubjectFixture, got {type(arg)}"
                    )
                pytest_params.append(pytest.param(arg, id=repr(arg)))
        # Test is not decorated with `authenticated` marker: consider the user anonymous
        else:
            pytest_params = [
                pytest.param(AuthSubjectFixture(subject="anonymous"), id="anonymous")
            ]
        metafunc.parametrize("auth_subject", pytest_params, indirect=["auth_subject"])
