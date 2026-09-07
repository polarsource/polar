from typing import Annotated

from fastapi import Depends

from polar.auth.models import AuthSubject
from polar.models import User, UserSession

from .access import AdminSession
from .dependencies import get_admin


async def get_backoffice_web_user(
    admin_session: Annotated[AdminSession, Depends(get_admin)],
) -> AuthSubject[User]:
    assert isinstance(admin_session, UserSession)
    return AuthSubject(
        admin_session.user,
        set(admin_session.scopes),
        admin_session,
        organization_ids=frozenset(
            scope.organization_id for scope in admin_session.organization_scopes
        )
        or None,
    )


BackofficeWebUser = Annotated[AuthSubject[User], Depends(get_backoffice_web_user)]
