from fastapi import APIRouter, Depends, Response

from polar.auth.dependencies import Auth
from polar.auth.service import AuthService, LoginResponse, LogoutResponse
from polar.models import User
from polar.postgres import AsyncSession, get_db_session
from polar.user.service import user as user_service

from .schemas import UserRead, UserUpdateSettings

router = APIRouter(prefix="/users", tags=["users"])


@router.get("/me", response_model=UserRead)
async def get_authenticated(auth: Auth = Depends(Auth.current_user)) -> User:
    return auth.user


@router.post("/me/token")
async def create_token(auth: Auth = Depends(Auth.current_user)) -> LoginResponse:
    return AuthService.generate_login_json_response(user=auth.user)


@router.post("/me/accept_terms", response_model=UserRead)
async def accept_terms(
    auth: Auth = Depends(Auth.current_user),
    session: AsyncSession = Depends(get_db_session),
) -> User:
    auth.user.accepted_terms_of_service = True
    await auth.user.save(session)
    return auth.user


@router.put("/me", response_model=UserRead)
async def update_preferences(
    settings: UserUpdateSettings,
    auth: Auth = Depends(Auth.current_user),
    session: AsyncSession = Depends(get_db_session),
) -> User:
    user = await user_service.update_preferences(session, auth.user, settings)
    return user


@router.get("/logout")
async def logout(
    response: Response, auth: Auth = Depends(Auth.current_user)
) -> LogoutResponse:
    return AuthService.generate_logout_response(response=response)
