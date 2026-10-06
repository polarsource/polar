from fastapi import Depends

from polar.exceptions import NotPermitted
from polar.meter.auth import MeterWrite
from polar.openapi import APITag
from polar.postgres import AsyncSession, get_db_session
from polar.routing import APIRouter

from .schemas import BillingConfig, BillingConfigApplyResult
from .service import BillingConfigConflict, BillingConfigNotEnabled
from .service import billing_config as billing_config_service

router = APIRouter(prefix="/billing-config", tags=["billing-config", APITag.private])


@router.post(
    "/apply",
    response_model=BillingConfigApplyResult,
    summary="Apply Billing Config",
    responses={
        200: {"description": "Billing config applied."},
        403: {
            "description": (
                "Not allowed to manage this organization, "
                "or billing config isn't enabled for it."
            ),
            "model": NotPermitted.schema() | BillingConfigNotEnabled.schema(),
        },
        409: {
            "description": "Another config apply created the same meter concurrently.",
            "model": BillingConfigConflict.schema(),
        },
    },
)
async def apply(
    config: BillingConfig,
    auth_subject: MeterWrite,
    session: AsyncSession = Depends(get_db_session),
) -> BillingConfigApplyResult:
    """Create or update the meters declared in a billing config."""
    return await billing_config_service.apply(session, auth_subject, config)
