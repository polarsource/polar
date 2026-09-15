from fastapi import Depends

from polar.exceptions import ResourceNotFound
from polar.models import Organization
from polar.openapi import APITag
from polar.routing import APIRouter

from .auth import VoidRead, require_void_enabled
from .customer.endpoints import router as customer_router
from .event.endpoints import router as event_router
from .identity.endpoints import router as identity_router
from .metric.endpoints import router as metric_router
from .reducer.endpoints import router as reducer_router
from .schemas import VoidOrganization

router = APIRouter(
    prefix="/void",
    tags=["void", APITag.private],
    dependencies=[Depends(require_void_enabled)],
    include_in_schema=False,
)


@router.get(
    "/organizations/current",
    response_model=VoidOrganization,
    operation_id="organizations:current",
    responses={404: {"model": ResourceNotFound.schema()}},
)
async def current(auth_subject: VoidRead) -> Organization:
    return auth_subject.subject


router.include_router(identity_router)
router.include_router(customer_router)

router.include_router(event_router)
router.include_router(reducer_router)
router.include_router(metric_router)
