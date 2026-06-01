from fastapi import Depends, Header, Request
from fastapi.responses import JSONResponse

from polar.openapi import APITag
from polar.postgres import AsyncSession, get_db_session
from polar.routing import APIRouter

from .service.secret_scanning import secret_scanning as secret_scanning_service

router = APIRouter(
    prefix="/integrations/github", tags=["integrations_github", APITag.private]
)


@router.post("/secret-scanning", include_in_schema=False)
async def secret_scanning(
    request: Request,
    github_public_key_identifier: str = Header(),
    github_public_key_signature: str = Header(),
    session: AsyncSession = Depends(get_db_session),
) -> JSONResponse:
    payload = (await request.body()).decode()
    await secret_scanning_service.verify_signature(
        payload, github_public_key_signature, github_public_key_identifier
    )

    data = secret_scanning_service.validate_payload(payload)

    response_data = await secret_scanning_service.handle_alert(session, data)
    return JSONResponse(content=response_data)
