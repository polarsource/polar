from fastapi import Depends

from polar.exceptions import ResourceNotFound
from polar.openapi import APITag
from polar.postgres import AsyncReadSession, get_db_read_session
from polar.routing import APIRouter

from .activity.endpoints import router as activity_router
from .auth import VoidRead
from .customer.endpoints import router as customer_router
from .deploy.endpoints import router as deploy_router
from .entitlement.endpoints import router as entitlement_router
from .event.endpoints import router as event_router
from .identity.endpoints import router as identity_router
from .judge.endpoints import router as judge_router
from .meter.endpoints import router as meter_router
from .metric.endpoints import router as metric_router
from .organization.service import organization as organization_service
from .product.endpoints import router as product_router
from .reducer.endpoints import router as reducer_router
from .scenario.endpoints import router as scenario_router
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
    auth: VoidRead, session: AsyncReadSession = Depends(get_db_read_session)
) -> VoidOrganization:
    return await organization_service.current(session, auth.organization)


router.include_router(identity_router)
router.include_router(judge_router)
router.include_router(customer_router)

router.include_router(event_router)
router.include_router(activity_router)
router.include_router(reducer_router)
router.include_router(metric_router)

router.include_router(deploy_router)
router.include_router(scenario_router)
router.include_router(entitlement_router)
router.include_router(meter_router)
router.include_router(product_router)

router.include_router(subscription_router)
