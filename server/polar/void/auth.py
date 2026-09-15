from typing import Annotated

from fastapi import Depends

from polar.auth.dependencies import Authenticator
from polar.auth.models import AuthSubject
from polar.auth.scope import Scope
from polar.config import settings
from polar.customer.auth import CustomerRead, CustomerWrite
from polar.exceptions import ResourceNotFound, Unauthorized
from polar.models import Organization, OrganizationAccessToken


def require_void_enabled() -> None:
    if not settings.VOID_ENABLED:
        raise ResourceNotFound()


def _require_void_organization(
    auth_subject: AuthSubject[Organization],
) -> AuthSubject[Organization]:
    require_void_enabled()
    if not isinstance(auth_subject.session, OrganizationAccessToken):
        raise Unauthorized()
    if auth_subject.subject.id not in settings.VOID_ORGANIZATION_IDS:
        raise ResourceNotFound()
    return auth_subject


_VoidRead = Authenticator(
    allowed_subjects={Organization},
    required_scopes={Scope.void_read, Scope.void_write},
)
_VoidWrite = Authenticator(
    allowed_subjects={Organization},
    required_scopes={Scope.void_write},
)


async def _void_read(
    auth_subject: Annotated[AuthSubject[Organization], Depends(_VoidRead)],
) -> AuthSubject[Organization]:
    return _require_void_organization(auth_subject)


async def _void_write(
    auth_subject: Annotated[AuthSubject[Organization], Depends(_VoidWrite)],
) -> AuthSubject[Organization]:
    return _require_void_organization(auth_subject)


VoidRead = Annotated[AuthSubject[Organization], Depends(_void_read)]
VoidWrite = Annotated[AuthSubject[Organization], Depends(_void_write)]


async def _void_customer_read(
    auth_subject: VoidRead,
    _customer_auth_subject: CustomerRead,
) -> AuthSubject[Organization]:
    return auth_subject


async def _void_customer_write(
    auth_subject: VoidWrite,
    _customer_auth_subject: CustomerWrite,
) -> AuthSubject[Organization]:
    return auth_subject


VoidCustomerRead = Annotated[AuthSubject[Organization], Depends(_void_customer_read)]
VoidCustomerWrite = Annotated[AuthSubject[Organization], Depends(_void_customer_write)]
