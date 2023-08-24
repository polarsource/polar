from fastapi import APIRouter, Depends, HTTPException

from polar.auth.dependencies import Auth
from polar.postgres import AsyncSession, get_db_session

from .service import invite

router = APIRouter(tags=["invite"])


@router.post("/invite/claim_code")
async def claim(
    code: str,
    auth: Auth = Depends(Auth.current_user),
    session: AsyncSession = Depends(get_db_session),
) -> dict[str, bool]:
    if not auth.user:
        raise HTTPException(status_code=401, detail="Unauthorized")

    ok = await invite.verify_and_claim_code(session, auth.user, code)
    return {"status": ok}
