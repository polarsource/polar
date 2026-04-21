from collections.abc import Awaitable, Callable
from dataclasses import dataclass
from typing import Annotated

from fastapi import Depends

from polar.auth.dependencies import Authenticator
from polar.auth.models import AuthSubject, Organization, User
from polar.auth.scope import Scope
from polar.exceptions import NotPermitted, ResourceNotFound
from polar.models import Organization as OrganizationModel
from polar.organization.schemas import OrganizationID
from polar.postgres import AsyncReadSession, get_db_read_session

from .service import get_accessible_org_ids

# Policy functions return True if allowed, or a denial reason string if denied.
PolicyResult = bool | str

PolicyFn = Callable[
    [AsyncReadSession, AuthSubject[User | Organization], OrganizationModel],
    Awaitable[PolicyResult],
]


@dataclass(frozen=True)
class AuthorizedOrganization:
    """Result of a PolicyGuard dependency.

    Contains both the resolved organization and the authenticated subject,
    so endpoints have a single entry point for auth context.
    """

    organization: OrganizationModel
    auth_subject: AuthSubject[User | Organization]


def PolicyGuard(
    policy_fn: PolicyFn,
    *,
    allowed_subjects: set[type] | None = None,
    required_scopes: set[Scope] | None = None,
) -> type:
    """Create a FastAPI dependency that authenticates, resolves an organization,
    and checks a policy — all in one step.

    Steps:
    1. Authenticate the subject via Authenticator.
    2. Resolve the organization from the ``{id}`` path parameter.
    3. Verify the subject is a member of the organization.
    4. Evaluate the policy function.
    5. Return an ``AuthorizedOrganization`` (organization + auth_subject).

    Raises:
        Unauthorized (401): The request has no valid credentials, or the
            subject type is not in ``allowed_subjects``.
        InsufficientScopeError (403): The token lacks the required scopes.
        ResourceNotFound (404): The organization does not exist, or the
            subject is not a member of it. Both cases return 404 to avoid
            leaking the existence of organizations the subject cannot access.
        NotPermitted (403): The subject is a member but the policy function
            returned False (e.g. not an admin for finance endpoints).
    """

    _allowed = allowed_subjects or {User, Organization}
    _scopes = required_scopes or {
        Scope.web_read,
        Scope.web_write,
        Scope.organizations_read,
        Scope.organizations_write,
    }

    _authenticator = Authenticator(
        allowed_subjects=_allowed,
        required_scopes=_scopes,
    )

    async def dependency(
        id: OrganizationID,
        auth_subject: Annotated[
            AuthSubject[User | Organization], Depends(_authenticator)
        ],
        session: AsyncReadSession = Depends(get_db_read_session),
    ) -> AuthorizedOrganization:
        from polar.organization.repository import OrganizationRepository

        org_ids = await get_accessible_org_ids(session, auth_subject)

        repository = OrganizationRepository.from_session(session)
        organization = await repository.get_by_id(id)

        if organization is None or organization.id not in org_ids:
            raise ResourceNotFound()

        result = await policy_fn(session, auth_subject, organization)
        if result is not True:
            raise NotPermitted(result if isinstance(result, str) else "Not permitted")

        return AuthorizedOrganization(
            organization=organization, auth_subject=auth_subject
        )

    return dependency


async def _always_allow(
    session: AsyncReadSession,
    auth_subject: AuthSubject[User | Organization],
    organization: OrganizationModel,
) -> PolicyResult:
    return True


def _finance_can_read() -> PolicyFn:
    async def policy(
        session: AsyncReadSession,
        auth_subject: AuthSubject[User | Organization],
        organization: OrganizationModel,
    ) -> PolicyResult:
        from .policies import finance

        return await finance.can_read(session, auth_subject, organization)

    return policy


def _finance_can_write() -> PolicyFn:
    async def policy(
        session: AsyncReadSession,
        auth_subject: AuthSubject[User | Organization],
        organization: OrganizationModel,
    ) -> PolicyResult:
        from .policies import finance

        return await finance.can_write(session, auth_subject, organization)

    return policy


def _members_can_manage() -> PolicyFn:
    async def policy(
        session: AsyncReadSession,
        auth_subject: AuthSubject[User | Organization],
        organization: OrganizationModel,
    ) -> PolicyResult:
        from .policies import members

        return await members.can_manage(session, auth_subject, organization)

    return policy


def _org_can_delete() -> PolicyFn:
    async def policy(
        session: AsyncReadSession,
        auth_subject: AuthSubject[User | Organization],
        organization: OrganizationModel,
    ) -> PolicyResult:
        from .policies import organization as org_policy

        return await org_policy.can_delete(session, auth_subject, organization)

    return policy


AuthorizeFinanceRead = Annotated[
    AuthorizedOrganization, Depends(PolicyGuard(_finance_can_read()))
]
AuthorizeFinanceWrite = Annotated[
    AuthorizedOrganization, Depends(PolicyGuard(_finance_can_write()))
]
AuthorizeMembersManage = Annotated[
    AuthorizedOrganization,
    Depends(
        PolicyGuard(
            _members_can_manage(),
            allowed_subjects={User},
            required_scopes={Scope.web_write, Scope.organizations_write},
        )
    ),
]
AuthorizeOrgDelete = Annotated[
    AuthorizedOrganization,
    Depends(
        PolicyGuard(
            _org_can_delete(),
            allowed_subjects={User},
            required_scopes={Scope.web_write, Scope.organizations_write},
        )
    ),
]
AuthorizeOrgAccess = Annotated[
    AuthorizedOrganization, Depends(PolicyGuard(_always_allow))
]
