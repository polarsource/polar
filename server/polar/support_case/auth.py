from dataclasses import dataclass
from typing import Annotated, Any

from fastapi import Depends, Path
from pydantic import UUID4

from polar.auth.dependencies import Authenticator
from polar.auth.models import AuthSubject, Organization, User
from polar.auth.scope import Scope
from polar.authz.policies import organization as org_policy
from polar.authz.service import get_accessible_organization
from polar.exceptions import NotPermitted, ResourceNotFound
from polar.models import Organization as OrganizationModel
from polar.models.support_case import SupportCase
from polar.postgres import AsyncSession, get_db_session

from .service import support_case as support_case_service


@dataclass(frozen=True)
class CaseContext[S: User | Organization]:
    """Resolved support case + its owning organization + the auth subject."""

    case: SupportCase
    organization: OrganizationModel
    auth_subject: AuthSubject[S]


def CasePolicyGuard(
    *,
    allowed_subjects: set[type],
    required_scopes: set[Scope],
) -> Any:
    """Authenticate, load the case, resolve its owning org, then authorize.

    Generic across case types: the organization is derived from the case's
    domain object (review appeal, dispute, …) via
    ``support_case_service.get_organization_id``, then the org-manage policy is
    applied — so org admins of the owning org can read/reply, and nobody else.
    A missing case, an unresolvable/inaccessible org all return 404 to avoid
    leaking existence.
    """
    authenticator = Authenticator(
        allowed_subjects=allowed_subjects, required_scopes=required_scopes
    )

    async def dependency(
        id: Annotated[UUID4, Path()],
        auth_subject: Annotated[
            AuthSubject[User | Organization], Depends(authenticator)
        ],
        session: AsyncSession = Depends(get_db_session),
    ) -> CaseContext[User | Organization]:
        case = await support_case_service.get(session, id)
        if case is None:
            raise ResourceNotFound()
        organization_id = await support_case_service.get_organization_id(session, case)
        if organization_id is None:
            raise ResourceNotFound()
        organization = await get_accessible_organization(
            session, auth_subject, organization_id
        )
        if organization is None:
            raise ResourceNotFound()
        result = await org_policy.can_manage(session, auth_subject, organization)
        if result is not True:
            raise NotPermitted(result)
        return CaseContext(
            case=case, organization=organization, auth_subject=auth_subject
        )

    return dependency


# Read accepts read-or-write scope (read-only sessions can view); replies
# require write + a User subject.
CaseRead = Annotated[
    CaseContext[User | Organization],
    Depends(
        CasePolicyGuard(
            allowed_subjects={User, Organization},
            required_scopes={Scope.organizations_read, Scope.organizations_write},
        )
    ),
]
CaseReply = Annotated[
    CaseContext[User],
    Depends(
        CasePolicyGuard(
            allowed_subjects={User},
            required_scopes={Scope.organizations_write},
        )
    ),
]
