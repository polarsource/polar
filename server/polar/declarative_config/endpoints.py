from fastapi import Depends, Query

from polar.exceptions import NotPermitted, Unauthorized
from polar.meter.auth import MeterRead, MeterWrite
from polar.openapi import APITag
from polar.organization.schemas import OrganizationID
from polar.postgres import AsyncSession, get_db_session
from polar.routing import APIRouter

from .schemas import Config, ConfigApplyResult, ConfigExport, ConfigPlan
from .service import ConfigAsCodeNotEnabled, ConfigInvalid, ConfigMeterConflict
from .service import declarative_config as declarative_config_service

router = APIRouter(prefix="/config", tags=["config", APITag.private])


@router.get(
    "/",
    response_model=ConfigExport,
    summary="Export Config",
    responses={
        200: {"description": "Current config."},
        401: {"description": "Not authenticated.", "model": Unauthorized.schema()},
        403: {
            "description": (
                "Not allowed to read this organization's products, "
                "or config as code isn't enabled for it."
            ),
            "model": NotPermitted.schema() | ConfigAsCodeNotEnabled.schema(),
        },
    },
)
async def export(
    auth_subject: MeterRead,
    organization_id: OrganizationID | None = Query(
        None,
        description=(
            "The ID of the organization to export. "
            "**Required unless you use an organization token.**"
        ),
    ),
    session: AsyncSession = Depends(get_db_session),
) -> ConfigExport:
    """
    Export the organization's current config as a declarative config document.

    `config` can be passed to plan or apply as is: planning it without edits
    reports no changes. Meters without an `external_id`, archived meters, and
    meters that wouldn't pass config validation are listed in `skipped`.
    """
    return await declarative_config_service.export(
        session, auth_subject, organization_id
    )


@router.post(
    "/apply",
    response_model=ConfigApplyResult,
    summary="Apply Config",
    responses={
        200: {"description": "Config applied."},
        401: {"description": "Not authenticated.", "model": Unauthorized.schema()},
        403: {
            "description": (
                "Not allowed to manage this organization, "
                "or config as code isn't enabled for it."
            ),
            "model": NotPermitted.schema() | ConfigAsCodeNotEnabled.schema(),
        },
        409: {
            "description": (
                "The config has blocking issues, "
                "or another request created the same meter concurrently."
            ),
            "model": ConfigInvalid.schema() | ConfigMeterConflict.schema(),
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

    Meters are matched by `external_id`: missing ones are created, changed ones
    are updated, and meters not listed are left untouched. Everything is applied
    in one transaction.
    """
    return await declarative_config_service.apply(session, auth_subject, config)


@router.post(
    "/plan",
    response_model=ConfigPlan,
    summary="Plan Config",
    responses={
        200: {"description": "Config checked."},
        401: {"description": "Not authenticated.", "model": Unauthorized.schema()},
        403: {
            "description": (
                "Not allowed to read this organization's products, "
                "or config as code isn't enabled for it."
            ),
            "model": NotPermitted.schema() | ConfigAsCodeNotEnabled.schema(),
        },
    },
)
async def plan(
    config: Config,
    auth_subject: MeterRead,
    session: AsyncSession = Depends(get_db_session),
) -> ConfigPlan:
    """
    Preview what applying a declarative config document would do, without applying it.

    Returns the action for each meter, and every issue: `error` issues make
    apply fail, `warning` issues don't.
    """
    return await declarative_config_service.plan(session, auth_subject, config)
