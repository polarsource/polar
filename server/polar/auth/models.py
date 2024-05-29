from enum import Enum, auto
from typing import Generic, TypeGuard, TypeVar

from polar.models import Organization, User

from .scope import Scope


class Anonymous: ...


Subject = User | Organization | Anonymous
SubjectType = type[User] | type[Organization] | type[Anonymous]
SUBJECTS: set[SubjectType] = {User, Organization, Anonymous}


class AuthMethod(Enum):
    NONE = auto()
    COOKIE = auto()
    PERSONAL_ACCESS_TOKEN = auto()
    OAUTH2_ACCESS_TOKEN = auto()


S = TypeVar("S", bound=Subject, covariant=True)


class AuthSubject(Generic[S]):
    subject: S
    scopes: set[Scope]
    method: AuthMethod

    def __init__(self, subject: S, scopes: set[Scope], method: AuthMethod) -> None:
        self.subject = subject
        self.scopes = scopes
        self.method = method

    def has_web_default_scope(self) -> bool:
        return Scope.web_default in self.scopes


def is_anonymous(auth_subject: AuthSubject[S]) -> TypeGuard[AuthSubject[Anonymous]]:
    return isinstance(auth_subject.subject, Anonymous)


def is_user(auth_subject: AuthSubject[S]) -> TypeGuard[AuthSubject[User]]:
    return isinstance(auth_subject.subject, User)


def is_direct_user(auth_subject: AuthSubject[S]) -> TypeGuard[AuthSubject[User]]:
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


def is_organization(
    auth_subject: AuthSubject[S],
) -> TypeGuard[AuthSubject[Organization]]:
    return isinstance(auth_subject.subject, Organization)


__all__ = [
    "Subject",
    "SubjectType",
    "SUBJECTS",
    "AuthMethod",
    "AuthSubject",
    "is_anonymous",
    "is_user",
    "is_organization",
    # Re-export subject types for convenience
    "Anonymous",
    "User",
    "Organization",
]
