from enum import Enum, auto
from typing import Generic, TypeGuard, TypeVar

from polar.models import Customer, Organization, User

from .scope import Scope


class Anonymous: ...


Subject = User | Organization | Customer | Anonymous
SubjectType = type[User] | type[Organization] | type[Customer] | type[Anonymous]


class AuthMethod(Enum):
    NONE = auto()
    COOKIE = auto()
    PERSONAL_ACCESS_TOKEN = auto()
    ORGANIZATION_ACCESS_TOKEN = auto()
    OAUTH2_ACCESS_TOKEN = auto()
    CUSTOMER_SESSION_TOKEN = auto()


S = TypeVar("S", bound=Subject, covariant=True)


class AuthSubject(Generic[S]):  # noqa: UP046 # Don't use the new syntax as it allows us to force covariant typing
    subject: S
    scopes: set[Scope]
    method: AuthMethod

    def __init__(self, subject: S, scopes: set[Scope], method: AuthMethod) -> None:
        self.subject = subject
        self.scopes = scopes
        self.method = method

    def has_web_default_scope(self) -> bool:
        return Scope.web_default in self.scopes

    def __repr__(self) -> str:
        return f"AuthSubject(subject={self.subject!r}, scopes={self.scopes!r}, method={self.method!r})"


def is_anonymous[S: Subject](
    auth_subject: AuthSubject[S],
) -> TypeGuard[AuthSubject[Anonymous]]:
    return isinstance(auth_subject.subject, Anonymous)


def is_user[S: Subject](auth_subject: AuthSubject[S]) -> TypeGuard[AuthSubject[User]]:
    return isinstance(auth_subject.subject, User)


def is_direct_user[S: Subject](
    auth_subject: AuthSubject[S],
) -> TypeGuard[AuthSubject[User]]:
    """
    Whether we can trust this subject to be a user acting directly.

    Useful when creating checkout sessions or subscriptions, where we need to
    be sure we can tie it to the calling user (i.e., not being a creator with
    a PAT).
    """
    return is_user(auth_subject) and auth_subject.method in {
        AuthMethod.COOKIE,
        AuthMethod.OAUTH2_ACCESS_TOKEN,
    }


def is_organization[S: Subject](
    auth_subject: AuthSubject[S],
) -> TypeGuard[AuthSubject[Organization]]:
    return isinstance(auth_subject.subject, Organization)


def is_customer[S: Subject](
    auth_subject: AuthSubject[S],
) -> TypeGuard[AuthSubject[Customer]]:
    return isinstance(auth_subject.subject, Customer)


__all__ = [
    "Subject",
    "SubjectType",
    "AuthMethod",
    "AuthSubject",
    "is_anonymous",
    "is_user",
    "is_organization",
    # Re-export subject types for convenience
    "Anonymous",
    "User",
    "Organization",
    "Customer",
]
