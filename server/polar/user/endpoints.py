from fastapi import Depends

from polar.auth.dependencies import Authenticator, WebUserRead, WebUserWrite
from polar.auth.models import AuthSubject
from polar.customer_portal.endpoints.downloadables import router as downloadables_router
from polar.customer_portal.endpoints.license_keys import router as license_keys_router
from polar.customer_portal.endpoints.order import router as order_router
from polar.customer_portal.endpoints.subscription import router as subscription_router
from polar.models import User
from polar.models.user import OAuthPlatform
from polar.openapi import APITag
from polar.postgres import AsyncSession, get_db_session
from polar.routing import APIRouter
from polar.user.oauth_service import oauth_account_service
from polar.user.service import user as user_service

from .auth import UserWrite
from .schemas import (
    UserDeletionResponse,
    UserIdentityVerification,
    UserRead,
    UserScopes,
)

router = APIRouter(prefix="/users", tags=["users", APITag.private])

# Include customer portal endpoints for backwards compatibility
router.include_router(order_router, deprecated=True, include_in_schema=False)
router.include_router(subscription_router, deprecated=True, include_in_schema=False)
router.include_router(downloadables_router, deprecated=True, include_in_schema=False)
router.include_router(license_keys_router, deprecated=True, include_in_schema=False)


@router.get("/me", response_model=UserRead)
async def get_authenticated(auth_subject: WebUserRead) -> User:
    return auth_subject.subject


@router.get("/me/scopes", response_model=UserScopes)
async def scopes(
    auth_subject: AuthSubject[User] = Depends(Authenticator(allowed_subjects={User})),
) -> UserScopes:
    return UserScopes(scopes=list(auth_subject.scopes))


@router.post("/me/identity-verification", response_model=UserIdentityVerification)
async def create_identity_verification(
    auth_subject: WebUserWrite,
    session: AsyncSession = Depends(get_db_session),
) -> UserIdentityVerification:
    return await user_service.create_identity_verification(
        session, user=auth_subject.subject
    )


@router.delete(
    "/me",
    response_model=UserDeletionResponse,
    responses={
        200: {"description": "Deletion result"},
    },
)
async def delete_authenticated_user(
    auth_subject: UserWrite,
    session: AsyncSession = Depends(get_db_session),
) -> UserDeletionResponse:
    """
    Delete the authenticated user account.

    A user can only be deleted if all organizations they are members of have been
    deleted first. If the user has active organizations, the response will include
    the list of organizations that must be deleted before the user account can be
    removed.

    When deleted:
    - User's email is anonymized
    - User's avatar and metadata are cleared
    - User's OAuth accounts are deleted (cascade)
    - User's Account (payout account) is deleted if present
    """
    return await user_service.request_deletion(session, auth_subject.subject)


@router.delete(
    "/me/oauth-accounts/{platform}",
    status_code=204,
    responses={
        404: {"description": "OAuth account not found"},
        400: {"description": "Cannot disconnect last authentication method"},
    },
)
async def disconnect_oauth_account(
    platform: OAuthPlatform,
    auth_subject: WebUserWrite,
    session: AsyncSession = Depends(get_db_session),
) -> None:
    """
    Disconnect an OAuth account (GitHub or Google) from the authenticated user.

    This allows users to unlink their OAuth provider while keeping their Polar account.
    They can still authenticate using other methods (email magic link or other OAuth providers).

    Note: You cannot disconnect your last authentication method if your email is not verified.
    """
    user = auth_subject.subject
    await oauth_account_service.disconnect_platform(session, user, platform)
