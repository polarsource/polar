from fastapi import APIRouter, Depends, HTTPException, Response

from polar.auth.dependencies import Auth
from polar.auth.service import AuthService, LoginResponse, LogoutResponse
from polar.models import User
from polar.postgres import AsyncSession, get_db_session
from polar.user.service import user as user_service

from .schemas import UserRead, UserUpdateSettings

router = APIRouter(prefix="/users", tags=["users"])


@router.get("/me", response_model=UserRead)
async def get_authenticated(auth: Auth = Depends(Auth.current_user)) -> User:
    if not auth.user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    return auth.user


@router.post("/me/token")
async def create_token(auth: Auth = Depends(Auth.current_user)) -> LoginResponse:
    if not auth.user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    return AuthService.generate_login_json_response(user=auth.user)


@router.put("/me", response_model=UserRead)
async def update_preferences(
    settings: UserUpdateSettings,
    auth: Auth = Depends(Auth.current_user),
    session: AsyncSession = Depends(get_db_session),
) -> User:
    if not auth.user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    user = await user_service.update_preferences(session, auth.user, settings)
    return user


@router.get("/logout")
async def logout(
    response: Response, auth: Auth = Depends(Auth.current_user)
) -> LogoutResponse:
    return AuthService.generate_logout_response(response=response)
