from fastapi import Depends

from polar.authz.dependencies import AuthorizeOrgManageRead, AuthorizeOrgManageUser
from polar.exceptions import ResourceNotFound
from polar.openapi import APITag
from polar.postgres import (
    AsyncReadSession,
    AsyncSession,
    get_db_read_session,
    get_db_session,
)
from polar.routing import APIRouter

from .schemas import OrganizationEmailStatus, OrganizationEmailVerify
from .service import InvalidVerificationCode, OrganizationEmailMissing
from .service import organization_email as organization_email_service

router = APIRouter(
    prefix="/organizations/{id}/email",
    tags=["organization_email", APITag.private],
)

OrganizationNotFound = {
    "description": "Organization not found.",
    "model": ResourceNotFound.schema(),
}


@router.get(
    "/",
    summary="Get Organization Email Status",
    response_model=OrganizationEmailStatus,
    responses={404: OrganizationNotFound},
)
async def get_organization_email(
    authz: AuthorizeOrgManageRead,
    session: AsyncReadSession = Depends(get_db_read_session),
) -> OrganizationEmailStatus:
    current = await organization_email_service.get_current(session, authz.organization)
    return organization_email_service.get_status(authz.organization, current)


@router.post(
    "/send-code",
    summary="Send Organization Email Code",
    status_code=204,
    responses={
        404: OrganizationNotFound,
        409: {"model": OrganizationEmailMissing.schema()},
    },
)
async def send_organization_email_code(
    authz: AuthorizeOrgManageUser,
    session: AsyncSession = Depends(get_db_session),
) -> None:
    await organization_email_service.send_code(session, authz.organization)


@router.post(
    "/verify",
    summary="Verify Organization Email",
    response_model=OrganizationEmailStatus,
    responses={
        400: {"model": InvalidVerificationCode.schema()},
        404: OrganizationNotFound,
    },
)
async def verify_organization_email(
    authz: AuthorizeOrgManageUser,
    body: OrganizationEmailVerify,
    session: AsyncSession = Depends(get_db_session),
) -> OrganizationEmailStatus:
    current = await organization_email_service.verify(
        session, authz.organization, body.code
    )
    return organization_email_service.get_status(authz.organization, current)
