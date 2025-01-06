import hashlib
import hmac

from fastapi import Depends, Header, HTTPException, Request

from polar.config import settings
from polar.postgres import AsyncSession, get_db_session
from polar.routing import APIRouter

from .schemas import CustomerCardsRequest, CustomerCardsResponse
from .service import plain as plain_service

router = APIRouter(
    prefix="/integrations/plain", tags=["integrations_plain"], include_in_schema=False
)


@router.post("/cards")
async def get_cards(
    request: Request,
    customer_cards_request: CustomerCardsRequest,
    plain_request_signature: str = Header(...),
    session: AsyncSession = Depends(get_db_session),
) -> CustomerCardsResponse:
    secret = settings.PLAIN_REQUEST_SIGNING_SECRET
    if secret is None:
        raise HTTPException(status_code=404)

    raw_body = await request.body()
    signature = hmac.new(secret.encode("utf-8"), raw_body, hashlib.sha256).hexdigest()
    if not hmac.compare_digest(signature, plain_request_signature):
        raise HTTPException(status_code=403)

    return await plain_service.get_cards(session, customer_cards_request)
