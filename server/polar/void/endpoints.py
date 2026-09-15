from fastapi import Depends

from polar.exceptions import ResourceNotFound
from polar.models import Organization
from polar.openapi import APITag
from polar.routing import APIRouter

from .auth import VoidRead, require_void_enabled
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
