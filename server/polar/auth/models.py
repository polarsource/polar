from functools import cached_property
from typing import Generic, TypeGuard, TypeVar

from polar.enums import RateLimitGroup
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

    @cached_property
    def rate_limit_key(self) -> tuple[str, RateLimitGroup]:
        return self.rate_limit_user, self.rate_limit_group

    @cached_property
    def rate_limit_user(self) -> str:
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

    @cached_property
    def rate_limit_group(self) -> RateLimitGroup:
        if isinstance(self.session, UserSession):
            return RateLimitGroup.web

        if isinstance(self.subject, Organization):
            return self.subject.rate_limit_group

        if isinstance(self.session, OAuth2Token):
            return self.session.client.rate_limit_group

        return RateLimitGroup.default

    @cached_property
    def log_context(self) -> dict[str, str]:
        baggage: dict[str, str] = {
            "subject_type": self.subject.__class__.__name__,
            "rate_limit_group": self.rate_limit_group.value,
            "rate_limit_user": self.rate_limit_user,
        }
        if isinstance(self.subject, User | Organization | Customer):
            baggage["subject_id"] = str(self.subject.id)

        if self.session:
            baggage["session_type"] = self.session.__class__.__name__

        return baggage


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
    # Re-export subject types for convenience
    "Anonymous",
    "AuthSubject",
    "Customer",
    "Organization",
    "Subject",
    "SubjectType",
    "User",
    "is_anonymous",
    "is_organization",
    "is_user",
]
