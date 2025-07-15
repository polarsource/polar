from fastapi import Depends

from polar.auth.dependencies import Authenticator, WebUser
from polar.auth.models import AuthSubject
from polar.customer_portal.endpoints.downloadables import router as downloadables_router
from polar.customer_portal.endpoints.license_keys import router as license_keys_router
from polar.customer_portal.endpoints.order import router as order_router
from polar.customer_portal.endpoints.subscription import router as subscription_router
from polar.models import User
from polar.openapi import APITag
from polar.postgres import AsyncSession, get_db_session
from polar.routing import APIRouter
from polar.user.service import user as user_service

from .schemas import UserIdentityVerification, UserRead, UserScopes

router = APIRouter(prefix="/users", tags=["users", APITag.private])

# Include customer portal endpoints for backwards compatibility
router.include_router(order_router, deprecated=True, include_in_schema=False)
router.include_router(subscription_router, deprecated=True, include_in_schema=False)
router.include_router(downloadables_router, deprecated=True, include_in_schema=False)
router.include_router(license_keys_router, deprecated=True, include_in_schema=False)


@router.get("/me", response_model=UserRead)
async def get_authenticated(auth_subject: WebUser) -> User:
    return auth_subject.subject


@router.get("/me/scopes", response_model=UserScopes)
async def scopes(
    auth_subject: AuthSubject[User] = Depends(Authenticator(allowed_subjects={User})),
) -> UserScopes:
    return UserScopes(scopes=list(auth_subject.scopes))


@router.post("/me/identity-verification", response_model=UserIdentityVerification)
async def create_identity_verification(
    auth_subject: WebUser,
    session: AsyncSession = Depends(get_db_session),
) -> UserIdentityVerification:
    return await user_service.create_identity_verification(
        session, user=auth_subject.subject
    )
