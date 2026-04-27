from typing import Annotated
from uuid import UUID

from fastapi import Depends

from polar.auth.dependencies import Authenticator
from polar.auth.models import AuthSubject, Organization, User
from polar.auth.scope import Scope
from polar.authz.dependencies import (
    AuthorizedCreate,
    AuthorizedList,
    AuthorizedResource,
    OrgListGuard,
    ResourcePolicyGuard,
    authorize_create_payload,
)
from polar.authz.policies import custom_field as custom_field_policy
from polar.models import CustomField
from polar.postgres import AsyncSession, get_db_session

from .repository import CustomFieldRepository
from .schemas import CustomFieldCreate

_LIST_SCOPES = {Scope.custom_fields_read, Scope.custom_fields_write}
_WRITE_SCOPES = {Scope.custom_fields_write}


# List endpoint — authenticate + resolve accessible org IDs at the dep layer.
AuthorizeCustomFieldList = Annotated[
    AuthorizedList, Depends(OrgListGuard(required_scopes=_LIST_SCOPES))
]


# Create endpoint — parse body, resolve target org from payload, run can_write.
_create_authenticator = Authenticator(
    allowed_subjects={User, Organization},
    required_scopes=_WRITE_SCOPES,
)


async def _authorize_custom_field_create(
    custom_field_create: CustomFieldCreate,
    auth_subject: Annotated[
        AuthSubject[User | Organization], Depends(_create_authenticator)
    ],
    session: AsyncSession = Depends(get_db_session),
) -> AuthorizedCreate[CustomFieldCreate]:
    return await authorize_create_payload(
        session=session,
        auth_subject=auth_subject,
        body=custom_field_create,
        policy_fn=custom_field_policy.can_write,
    )


AuthorizeCustomFieldCreate = Annotated[
    AuthorizedCreate[CustomFieldCreate],
    Depends(_authorize_custom_field_create),
]


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
