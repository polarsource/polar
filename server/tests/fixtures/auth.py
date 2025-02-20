from typing import Any, Literal

import pytest

from polar.auth.models import Anonymous, AuthMethod, AuthSubject, Subject
from polar.auth.scope import Scope
from polar.models import Customer, Organization, User


class AuthSubjectFixture:
    def __init__(
        self,
        *,
        subject: Literal[
            "anonymous",
            "user",
            "user_second",
            "user_blocked",
            "organization",
            "organization_second",
            "organization_blocked",
            "customer",
        ] = "user",
        scopes: set[Scope] = {Scope.web_default},
        method: AuthMethod = AuthMethod.COOKIE,
    ):
        self.subject = subject
        self.scopes = scopes
        self.method = method

    def __repr__(self) -> str:
        scopes = (
            "{" + ", ".join(repr(scope.value) for scope in sorted(self.scopes)) + "}"
        )
        return (
            "AuthSubjectFixture("
            f"subject={self.subject!r}, "
            f"scopes={scopes}, "
            f"method={self.method})"
        )


CUSTOMER_AUTH_SUBJECT = AuthSubjectFixture(
    subject="customer", scopes={Scope.customer_portal_read, Scope.customer_portal_write}
)


@pytest.fixture
def auth_subject(
    request: pytest.FixtureRequest,
    user: User,
    user_second: User,
    user_blocked: User,
    organization: Organization,
    organization_second: Organization,
    organization_blocked: Organization,
    customer: Customer,
) -> AuthSubject[Subject]:
    """
    This fixture generates an AuthSubject instance used by the `client` fixture
    to override the FastAPI authentication dependency, but also can be used manually
    if needed.

    Its parameters are generated through the `auth` marker.
    See `pytest_generate_tests` below for more information.
    """
    auth_subject_fixture: AuthSubjectFixture = request.param
    subjects_map: dict[str, Anonymous | Customer | User | Organization] = {
        "anonymous": Anonymous(),
        "user": user,
        "user_second": user_second,
        "user_blocked": user_blocked,
        "organization": organization,
        "organization_second": organization_second,
        "organization_blocked": organization_blocked,
        "customer": customer,
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

        # The test is decorated with the `auth` marker
        auth_marker = metafunc.definition.get_closest_marker("auth")
        if auth_marker is not None:
            # No argument: use a default AuthSubjectFixture
            args: tuple[Any] = auth_marker.args
            if len(args) == 0:
                args = (AuthSubjectFixture(),)

            # Generate a test for each AuthSubjectFixture argument
            for arg in args:
                if not isinstance(arg, AuthSubjectFixture):
                    raise ValueError(
                        "auth marker arguments must be "
                        f"of type AuthSubjectFixture, got {type(arg)}"
                    )
                pytest_params.append(pytest.param(arg, id=repr(arg)))
        # Test is not decorated with `auth` marker: consider the user anonymous
        else:
            pytest_params = [
                pytest.param(AuthSubjectFixture(subject="anonymous"), id="anonymous")
            ]
        metafunc.parametrize("auth_subject", pytest_params, indirect=["auth_subject"])
