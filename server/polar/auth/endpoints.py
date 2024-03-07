from uuid import UUID

from fastapi import APIRouter, Depends
from fastapi.responses import RedirectResponse

from polar.auth.dependencies import UserRequiredAuth
from polar.auth.schemas import (
    CustomDomainExchangeRequest,
    CustomDomainExchangeResponse,
    CustomDomainForwardResponse,
)
from polar.config import settings
from polar.exceptions import ResourceNotFound
from polar.kit import jwt
from polar.organization.service import organization as organization_service
from polar.postgres import AsyncSession, get_db_session
from polar.user.service import user as user_service

from .service import AuthService

router = APIRouter(tags=["auth"])


@router.get(
    "/auth/custom_domain_forward",
)
async def custom_domain_forward(
    auth: UserRequiredAuth,
    organization_id: UUID,
    session: AsyncSession = Depends(get_db_session),
) -> CustomDomainForwardResponse:
    org = await organization_service.get(session, organization_id)
    if not org:
        raise ResourceNotFound()

    if not org.custom_domain:
        raise ResourceNotFound()

    token = jwt.encode(
        type="custom_domain_forward",
        data={
            "user_id": str(auth.subject.id),
            "domain": org.custom_domain,
        },
        secret=settings.SECRET_CUSTOM_DOMAIN_EXCHANGE,
        expires_in=5 * 60,  # 5 minutes
    )

    return CustomDomainForwardResponse(
        token=token,
    )


@router.post(
    "/auth/custom_domain_exchange",
)
async def custom_domain_exchange(
    request: CustomDomainExchangeRequest,
    session: AsyncSession = Depends(get_db_session),
) -> CustomDomainExchangeResponse:
    decoded = jwt.decode(
        token=request.token,
        secret=settings.SECRET_CUSTOM_DOMAIN_EXCHANGE,
        type="custom_domain_forward",
    )

    # get user
    user = await user_service.get(session, decoded["user_id"])
    if not user:
        raise ResourceNotFound()

    # create a real auth token
    token, expires_at = AuthService.generate_token(user)

    return CustomDomainExchangeResponse(
        token=token,
        expires_at=expires_at,
    )


@router.get(
    "/auth/logout",
)
async def logout(
    organization_id: UUID | None = None,
    session: AsyncSession = Depends(get_db_session),
) -> RedirectResponse:
    redirect_to = settings.FRONTEND_BASE_URL

    # redirect to custom domain to logout there as well
    if organization_id:
        org = await organization_service.get(session, organization_id)
        if not org:
            raise ResourceNotFound()

        if not org.custom_domain:
            raise ResourceNotFound()

        redirect_to = f"https://{org.custom_domain}/api/auth/logout"

    response = RedirectResponse(redirect_to)
    AuthService.set_auth_cookie(response=response, value="", expires=0)
    return response
