from typing import Annotated
from uuid import UUID

from fastapi import Depends

from polar.auth.dependencies import Authenticator
from polar.auth.models import AuthSubject, Organization, User
from polar.auth.scope import Scope
from polar.authz.dependencies import AuthorizedResource, ResourcePolicyGuard
from polar.authz.policies import custom_field as custom_field_policy
from polar.models import CustomField
from polar.postgres import AsyncSession

from .repository import CustomFieldRepository

# List/create endpoints — scope check only; service applies the
# accessible-org filter for list, and the policy is enforced at create
# time once the target organization is resolved from the payload.
_CustomFieldListCreate = Authenticator(
    required_scopes={
        Scope.custom_fields_read,
        Scope.custom_fields_write,
    },
    allowed_subjects={User, Organization},
)
CustomFieldListCreate = Annotated[
    AuthSubject[User | Organization], Depends(_CustomFieldListCreate)
]


async def _resolve(session: AsyncSession, id: UUID) -> CustomField | None:
    repository = CustomFieldRepository.from_session(session)
    return await repository.get_by_id(id)


# Per-id endpoints — full PolicyGuard (resolve resource → check org access → policy).
AuthorizeCustomFieldRead = Annotated[
    AuthorizedResource[CustomField],
    Depends(
        ResourcePolicyGuard(
            resolve=_resolve,
            get_organization_id=lambda cf: cf.organization_id,
            policy_fn=custom_field_policy.can_read,
            required_scopes={
                Scope.custom_fields_read,
                Scope.custom_fields_write,
            },
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
            required_scopes={Scope.custom_fields_write},
        )
    ),
]
