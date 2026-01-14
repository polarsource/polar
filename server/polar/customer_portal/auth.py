from typing import Annotated

from fastapi import Depends

from polar.auth.dependencies import Authenticator
from polar.auth.models import Anonymous, AuthSubject, Customer, Member
from polar.auth.scope import Scope
from polar.exceptions import NotPermitted
from polar.models.member import MemberRole

# Customer-only authenticators (legacy, for non-migrated orgs)
_CustomerPortalRead = Authenticator(
    required_scopes={
        Scope.customer_portal_read,
        Scope.customer_portal_write,
    },
    allowed_subjects={Customer},
)
CustomerPortalRead = Annotated[AuthSubject[Customer], Depends(_CustomerPortalRead)]

_CustomerPortalWrite = Authenticator(
    required_scopes={Scope.customer_portal_write},
    allowed_subjects={Customer},
)
CustomerPortalWrite = Annotated[AuthSubject[Customer], Depends(_CustomerPortalWrite)]

_CustomerPortalOAuthAccount = Authenticator(
    required_scopes={Scope.customer_portal_write},
    allowed_subjects={Customer, Anonymous},
)
CustomerPortalOAuthAccount = Annotated[
    AuthSubject[Customer | Anonymous], Depends(_CustomerPortalOAuthAccount)
]


# Member-only authenticators (for orgs with member_model_enabled=true)
_CustomerPortalMemberRead = Authenticator(
    required_scopes={
        Scope.customer_portal_read,
        Scope.customer_portal_write,
    },
    allowed_subjects={Member},
)
CustomerPortalMemberRead = Annotated[
    AuthSubject[Member], Depends(_CustomerPortalMemberRead)
]

_CustomerPortalMemberWrite = Authenticator(
    required_scopes={Scope.customer_portal_write},
    allowed_subjects={Member},
)
CustomerPortalMemberWrite = Annotated[
    AuthSubject[Member], Depends(_CustomerPortalMemberWrite)
]


class _RoleCheck:
    """Dependency that checks if a Member has one of the allowed roles."""

    def __init__(self, allowed_roles: set[MemberRole]) -> None:
        self.allowed_roles = allowed_roles

    async def __call__(
        self, auth_subject: AuthSubject[Member] = Depends(_CustomerPortalMemberWrite)
    ) -> AuthSubject[Member]:
        if auth_subject.subject.role not in self.allowed_roles:
            raise NotPermitted("Insufficient role for this operation")
        return auth_subject


# Role-based authenticators (Member-only, with role restrictions)
CustomerPortalOwner = Annotated[
    AuthSubject[Member],
    Depends(_RoleCheck(allowed_roles={MemberRole.owner})),
]

CustomerPortalBillingManager = Annotated[
    AuthSubject[Member],
    Depends(_RoleCheck(allowed_roles={MemberRole.owner, MemberRole.billing_manager})),
]


# Union authenticators (accept both Customer and Member during migration)
_CustomerPortalUnionRead = Authenticator(
    required_scopes={
        Scope.customer_portal_read,
        Scope.customer_portal_write,
    },
    allowed_subjects={Customer, Member},
)
CustomerPortalUnionRead = Annotated[
    AuthSubject[Customer | Member], Depends(_CustomerPortalUnionRead)
]

_CustomerPortalUnionWrite = Authenticator(
    required_scopes={Scope.customer_portal_write},
    allowed_subjects={Customer, Member},
)
CustomerPortalUnionWrite = Annotated[
    AuthSubject[Customer | Member], Depends(_CustomerPortalUnionWrite)
]
