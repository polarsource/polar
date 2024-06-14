import structlog
from fastapi import Depends

from polar.auth.dependencies import WebUser
from polar.integrations.stripe.service import stripe as stripe_service
from polar.kit.pagination import ListResource, Pagination
from polar.openapi import IN_DEVELOPMENT_ONLY
from polar.postgres import AsyncSession, get_db_session
from polar.routing import APIRouter

from .schemas import PaymentMethod

log = structlog.get_logger()

router = APIRouter(tags=["payment_methods"], include_in_schema=IN_DEVELOPMENT_ONLY)


@router.get(
    "/payment_methods", response_model=ListResource[PaymentMethod], status_code=200
)
async def list(
    auth_subject: WebUser,
    session: AsyncSession = Depends(get_db_session),
) -> ListResource[PaymentMethod]:
    pms = await stripe_service.list_user_payment_methods(session, auth_subject.subject)

    return ListResource(
        items=[PaymentMethod.from_stripe(pm) for pm in pms],
        pagination=Pagination(total_count=len(pms), max_page=1),
    )


@router.post(
    "/payment_methods/{id}/detach", response_model=PaymentMethod, status_code=200
)
async def detach(id: str, auth_subject: WebUser) -> PaymentMethod:
    pm = stripe_service.detach_payment_method(id)
    return PaymentMethod.from_stripe(pm)
