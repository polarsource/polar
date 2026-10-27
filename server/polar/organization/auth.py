from typing import Annotated

from fastapi import Depends

from polar.auth.dependencies import Authenticator
from polar.auth.models import Agent, AuthSubject, Organization, User
from polar.auth.scope import Scope
from polar.authz.dependencies import AuthzContext, OrgPolicyGuard
from polar.authz.policies import organization as org_policy

OrganizationsRead = Annotated[
    AuthSubject[User | Organization | Agent],
    Depends(
        Authenticator(
            required_scopes={
                Scope.organizations_read,
                Scope.organizations_write,
            },
            allowed_subjects={User, Organization, Agent},
        )
    ),
]

OrganizationsCreate = Annotated[
    AuthSubject[User | Agent],
    Depends(
        Authenticator(
            required_scopes={
                Scope.organizations_write,
            },
            allowed_subjects={User, Agent},
        )
    ),
]

OrganizationsAccess = Annotated[
    AuthzContext[User | Organization | Agent],
    Depends(OrgPolicyGuard(allowed_subjects={User, Organization, Agent})),
]

OrganizationsManage = Annotated[
    AuthzContext[User | Organization | Agent],
    Depends(
        OrgPolicyGuard(
            org_policy.can_manage,
            allowed_subjects={User, Organization, Agent},
            required_scopes={Scope.organizations_write},
        )
    ),
]
