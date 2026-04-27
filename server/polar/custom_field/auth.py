from typing import Annotated
from uuid import UUID

from fastapi import Depends

from polar.auth.dependencies import Authenticator
from polar.auth.models import AuthSubject, Organization, User
from polar.auth.scope import Scope
from polar.authz.dependencies import AuthorizedResource, ResourcePolicyGuard
from polar.authz.policies import custom_field as custom_field_policy
from polar.authz.service import get_accessible_org_ids
from polar.authz.types import AccessibleOrganizationID
from polar.exceptions import NotPermitted
from polar.models import CustomField
from polar.models import Organization as OrganizationModel
from polar.organization.resolver import get_payload_organization
from polar.postgres import AsyncSession, get_db_session

from .repository import CustomFieldRepository
from .schemas import CustomFieldCreate

_LIST_SCOPES = {Scope.custom_fields_read, Scope.custom_fields_write}
_WRITE_SCOPES = {Scope.custom_fields_write}


# List endpoint — authenticate + resolve accessible org IDs.
_list_authenticator = Authenticator(
    allowed_subjects={User, Organization},
    required_scopes=_LIST_SCOPES,
)


async def _authorize_list(
    auth_subject: Annotated[
        AuthSubject[User | Organization], Depends(_list_authenticator)
    ],
    session: AsyncSession = Depends(get_db_session),
) -> set[AccessibleOrganizationID]:
    return await get_accessible_org_ids(session, auth_subject)


AuthorizeCustomFieldList = Annotated[
    set[AccessibleOrganizationID], Depends(_authorize_list)
]


# Create endpoint — authenticate + parse body + resolve target org + run policy.
_create_authenticator = Authenticator(
    allowed_subjects={User, Organization},
    required_scopes=_WRITE_SCOPES,
)


async def _authorize_create(
    custom_field_create: CustomFieldCreate,
    auth_subject: Annotated[
        AuthSubject[User | Organization], Depends(_create_authenticator)
    ],
    session: AsyncSession = Depends(get_db_session),
) -> OrganizationModel:
    organization = await get_payload_organization(
        session, auth_subject, custom_field_create
    )
    result = await custom_field_policy.can_write(session, auth_subject, organization)
    if result is not True:
        raise NotPermitted(result if isinstance(result, str) else "Not permitted")
    return organization


AuthorizeCustomFieldCreate = Annotated[OrganizationModel, Depends(_authorize_create)]


# Per-id endpoints — full PolicyGuard (resolve resource → check org access → policy).
async def _resolve(session: AsyncSession, id: UUID) -> CustomField | None:
    repository = CustomFieldRepository.from_session(session)
    return await repository.get_by_id(id)


AuthorizeCustomFieldRead = Annotated[
    AuthorizedResource[CustomField],
    Depends(
        ResourcePolicyGuard(
            resolve=_resolve,
            get_organization_id=lambda cf: cf.organization_id,
            policy_fn=custom_field_policy.can_read,
            required_scopes=_LIST_SCOPES,
        )
    ),
]

AuthorizeCustomFieldWrite = Annotated[
    AuthorizedResource[CustomField],
    Depends(
        ResourcePolicyGuard(
            resolve=_resolve,
            get_organization_id=lambda cf: cf.organization_id,
            policy_fn=custom_field_policy.can_write,
            required_scopes=_WRITE_SCOPES,
        )
    ),
]
