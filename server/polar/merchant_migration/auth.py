from typing import Annotated

from fastapi import Depends

from polar.auth.dependencies import Authenticator
from polar.auth.models import AuthSubject, Organization, User
from polar.auth.scope import Scope

_MerchantMigrationRead = Authenticator(
    required_scopes={Scope.organizations_read, Scope.organizations_write},
    allowed_subjects={User, Organization},
)
MerchantMigrationRead = Annotated[
    AuthSubject[User | Organization], Depends(_MerchantMigrationRead)
]

_MerchantMigrationWrite = Authenticator(
    required_scopes={Scope.organizations_write},
    allowed_subjects={User, Organization},
)
MerchantMigrationWrite = Annotated[
    AuthSubject[User | Organization], Depends(_MerchantMigrationWrite)
]
