from fastapi import Depends

from polar.exceptions import ResourceNotFound
from polar.openapi import APITag
from polar.postgres import AsyncSession, get_db_session
from polar.routing import APIRouter

from .auth import VoidRead, VoidWrite
from .customer.endpoints import router as customer_router
from .deploy.endpoints import router as deploy_router
from .entitlement.endpoints import router as entitlement_router
from .event.endpoints import router as event_router
from .identity.endpoints import router as identity_router
from .meter.endpoints import router as meter_router
from .metric.endpoints import router as metric_router
from .organization.schemas import OrganizationUpdate
from .organization.service import InvalidDefaultVersion
from .organization.service import organization as organization_service
from .product.endpoints import router as product_router
from .reducer.endpoints import router as reducer_router
from .schemas import VoidOrganization
from .subscription.endpoints import router as subscription_router

router = APIRouter(
    prefix="/void",
    tags=["void", APITag.private],
    include_in_schema=False,
)


@router.get(
    "/organizations/current",
    response_model=VoidOrganization,
    operation_id="organizations:current",
    responses={404: {"model": ResourceNotFound.schema()}},
)
async def current(
    auth_subject: VoidRead, session: AsyncSession = Depends(get_db_session)
) -> VoidOrganization:
    return await organization_service.current(session, auth_subject.subject)


@router.patch(
    "/organizations/current",
    response_model=VoidOrganization,
    operation_id="organizations:updateCurrent",
    responses={400: {"model": InvalidDefaultVersion.schema()}},
)
async def update_current(
    body: OrganizationUpdate,
    auth_subject: VoidWrite,
    session: AsyncSession = Depends(get_db_session),
) -> VoidOrganization:
    return await organization_service.update(session, auth_subject.subject, body)


router.include_router(identity_router)
router.include_router(customer_router)

router.include_router(event_router)
router.include_router(reducer_router)
router.include_router(metric_router)

router.include_router(deploy_router)
router.include_router(entitlement_router)
router.include_router(meter_router)
router.include_router(product_router)

router.include_router(subscription_router)
