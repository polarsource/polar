from typing import Generic, TypeGuard, TypeVar

from polar.models import (
    Customer,
    CustomerSession,
    OAuth2Token,
    Organization,
    OrganizationAccessToken,
    PersonalAccessToken,
    User,
    UserSession,
)

from .scope import Scope


class Anonymous: ...


Subject = User | Organization | Customer | Anonymous
SubjectType = type[User] | type[Organization] | type[Customer] | type[Anonymous]
Session = (
    UserSession
    | OrganizationAccessToken
    | OAuth2Token
    | PersonalAccessToken
    | CustomerSession
)


S = TypeVar("S", bound=Subject, covariant=True)


class AuthSubject(Generic[S]):  # noqa: UP046 # Don't use the new syntax as it allows us to force covariant typing
    subject: S
    scopes: set[Scope]
    session: Session | None

    def __init__(self, subject: S, scopes: set[Scope], session: Session | None) -> None:
        self.subject = subject
        self.scopes = scopes
        self.session = session

    def __repr__(self) -> str:
        return f"AuthSubject(subject={self.subject!r}, scopes={self.scopes!r})"

    @property
    def rate_limit_key(self) -> str:
        if isinstance(self.session, OAuth2Token):
            return f"oauth2_client:{self.session.client_id}"

        match self.subject:
            case User():
                return f"user:{self.subject.id}"
            case Organization():
                return f"organization:{self.subject.id}"
            case Customer():
                return f"customer:{self.subject.id}"
            case Anonymous():
                return "anonymous"


def is_anonymous[S: Subject](
    auth_subject: AuthSubject[S],
) -> TypeGuard[AuthSubject[Anonymous]]:
    return isinstance(auth_subject.subject, Anonymous)


def is_user[S: Subject](auth_subject: AuthSubject[S]) -> TypeGuard[AuthSubject[User]]:
    return isinstance(auth_subject.subject, User)


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
