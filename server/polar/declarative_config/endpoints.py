from fastapi import Depends

from polar.exceptions import NotPermitted, Unauthorized
from polar.meter.auth import MeterWrite
from polar.openapi import APITag
from polar.postgres import AsyncSession, get_db_session
from polar.routing import APIRouter

from .schemas import Config, ConfigApplyResult
from .service import ConfigAsCodeNotEnabled
from .service import declarative_config as declarative_config_service

router = APIRouter(prefix="/config", tags=["config", APITag.private])


@router.post(
    "/apply",
    response_model=ConfigApplyResult,
    summary="Apply Config",
    responses={
        200: {"description": "Config validated."},
        401: {"description": "Not authenticated.", "model": Unauthorized.schema()},
        403: {
            "description": (
                "Not allowed to manage this organization, "
                "or config as code isn't enabled for it."
            ),
            "model": NotPermitted.schema() | ConfigAsCodeNotEnabled.schema(),
        },
    },
)
async def apply(
    config: Config,
    auth_subject: MeterWrite,
    session: AsyncSession = Depends(get_db_session),
) -> ConfigApplyResult:
    """
    Apply a declarative config document to the organization.

    **Preview:** the config is validated, but changes aren't persisted yet.
    """
    return await declarative_config_service.apply(session, auth_subject, config)
