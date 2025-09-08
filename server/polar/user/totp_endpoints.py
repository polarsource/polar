from urllib.parse import urlencode

from fastapi import Depends, Form, HTTPException, Request, status
from fastapi.responses import RedirectResponse

from polar.auth.dependencies import WebUserWrite
from polar.auth.service import auth as auth_service
from polar.config import settings
from polar.kit.db.postgres import AsyncSession
from polar.kit.http import ReturnTo
from polar.postgres import get_db_session
from polar.routing import APIRouter
from polar.user.repository import UserRepository

from .schemas import (
    TOTPBackupCodesResponse,
    TOTPDisableRequest,
    TOTPEnableRequest,
    TOTPSetupRequest,
    TOTPSetupResponse,
    TOTPStatusResponse,
    TOTPVerificationRequest,
)
from .totp_service import totp_service

router = APIRouter(prefix="/2fa", tags=["2fa"])


@router.get("/status", response_model=TOTPStatusResponse)
async def get_totp_status(
    auth_subject: WebUserWrite,
    session: AsyncSession = Depends(get_db_session),
) -> TOTPStatusResponse:
    user = auth_subject.subject

    backup_codes_remaining = 0
    if user.backup_codes and user.totp_enabled:
        used_codes = set(user.backup_codes.get("used", []))
        total_codes = len(user.backup_codes.get("codes", []))
        backup_codes_remaining = total_codes - len(used_codes)

    return TOTPStatusResponse(
        enabled=user.totp_enabled,
        backup_codes_remaining=backup_codes_remaining
    )


@router.post("/setup", response_model=TOTPSetupResponse)
async def setup_totp(
    setup_request: TOTPSetupRequest,
    auth_subject: WebUserWrite,
    session: AsyncSession = Depends(get_db_session),
) -> TOTPSetupResponse:
    user = auth_subject.subject

    if user.totp_enabled:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="2FA is already enabled. Disable it first to set up again."
        )

    secret, qr_code, backup_codes = await totp_service.setup_totp(session, user)

    return TOTPSetupResponse(
        secret=secret,
        qr_code=qr_code,
        backup_codes=backup_codes
    )


@router.post("/enable")
async def enable_totp(
    enable_request: TOTPEnableRequest,
    auth_subject: WebUserWrite,
    session: AsyncSession = Depends(get_db_session),
) -> dict[str, str]:
    user = auth_subject.subject

    if user.totp_enabled:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="2FA is already enabled."
        )

    if not user.totp_secret:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="2FA setup not found. Please set up 2FA first."
        )

    success = await totp_service.enable_totp(
        session, user, enable_request.verification_code
    )

    if not success:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid verification code."
        )

    return {"message": "2FA has been successfully enabled."}


@router.post("/disable")
async def disable_totp(
    disable_request: TOTPDisableRequest,
    auth_subject: WebUserWrite,
    session: AsyncSession = Depends(get_db_session),
) -> dict[str, str]:
    user = auth_subject.subject

    if not user.totp_enabled:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="2FA is not enabled."
        )

    is_valid = await totp_service.verify_user_totp(user, disable_request.verification_code)

    if not is_valid:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid verification code."
        )

    await totp_service.disable_totp(session, user)

    return {"message": "2FA has been successfully disabled."}


@router.post("/verify")
async def verify_totp(
    verification_request: TOTPVerificationRequest,
    auth_subject: WebUserWrite,
    session: AsyncSession = Depends(get_db_session),
) -> dict[str, bool]:
    user = auth_subject.subject

    if not user.totp_enabled:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="2FA is not enabled."
        )

    is_valid = await totp_service.verify_user_totp(user, verification_request.code)

    return {"valid": is_valid}


@router.post("/backup-codes/regenerate", response_model=TOTPBackupCodesResponse)
async def regenerate_backup_codes(
    auth_subject: WebUserWrite,
    session: AsyncSession = Depends(get_db_session),
) -> TOTPBackupCodesResponse:
    user = auth_subject.subject

    if not user.totp_enabled:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="2FA is not enabled."
        )

    backup_codes = await totp_service.regenerate_backup_codes(session, user)

    if backup_codes is None:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to regenerate backup codes."
        )

    return TOTPBackupCodesResponse(backup_codes=backup_codes)


@router.post("/verify-login")
async def verify_2fa_login(
    request: Request,
    return_to: ReturnTo,
    email: str = Form(),
    code: str = Form(),
    session: AsyncSession = Depends(get_db_session),
) -> RedirectResponse:
    repository = UserRepository.from_session(session)
    user = await repository.get_by_email(email)

    if not user or not user.totp_enabled:
        base_url = str(settings.generate_frontend_url("/login"))
        url_params = {
            "return_to": return_to,
            "error": "Invalid authentication request",
        }
        error_return_to = f"{base_url}?{urlencode(url_params)}"
        return RedirectResponse(error_return_to, 303)

    is_valid = await totp_service.verify_user_totp(user, code)

    if not is_valid:
        base_url = str(settings.generate_frontend_url("/2fa/verify"))
        url_params = {
            "return_to": return_to,
            "email": email,
            "error": "Invalid verification code",
        }
        error_return_to = f"{base_url}?{urlencode(url_params)}"
        return RedirectResponse(error_return_to, 303)

    return await auth_service.get_login_response(
        session, request, user, return_to=return_to
    )
