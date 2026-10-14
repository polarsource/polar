from fastapi import Depends, Query

from polar.exceptions import NotPermitted, Unauthorized
from polar.meter.auth import MeterRead, MeterWrite
from polar.openapi import APITag
from polar.organization.schemas import OrganizationID
from polar.postgres import (
    AsyncReadSession,
    AsyncSession,
    get_db_read_session,
    get_db_session,
)
from polar.redis import Redis, get_redis
from polar.routing import APIRouter

from .schemas import Config, ConfigApplyResult, ConfigExport, ConfigPlan
from .service import (
    ConfigAsCodeNotEnabled,
    ConfigBenefitConflict,
    ConfigInvalid,
    ConfigMeterConflict,
    ConfigProductConflict,
)
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
    session: AsyncReadSession = Depends(get_db_read_session),
) -> ConfigExport:
    """
    Export the organization's current config as a declarative config document.

    `config` has the shape plan and apply accept, without `organization_id`:
    planning it for the same organization without edits reports no changes.
    Meters without an `external_id`, archived meters, meters that wouldn't pass
    config validation, and meters beyond the config limit are listed in
    `skipped`.
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
                "missing the `organizations:write`, `benefits:write`, "
                "`products:write` or `discounts:write` scope for that section, "
                "or config as code isn't enabled for it."
            ),
            "model": NotPermitted.schema() | ConfigAsCodeNotEnabled.schema(),
        },
        409: {
            "description": (
                "The config has blocking issues, "
                "or another request created the same resource concurrently."
            ),
            "model": ConfigInvalid.schema()
            | ConfigMeterConflict.schema()
            | ConfigBenefitConflict.schema()
            | ConfigProductConflict.schema(),
        },
    },
)
async def apply(
    config: Config,
    auth_subject: MeterWrite,
    session: AsyncSession = Depends(get_db_session),
    redis: Redis = Depends(get_redis),
) -> ConfigApplyResult:
    """
    Apply a declarative config document to the organization.

    Meters, benefits, products and discounts are matched by `external_id`:
    missing ones are created, changed ones are updated, and ones not listed are
    left untouched.
    `settings` are applied first, so products can be priced in a new
    `payments.currency` in the same config. Every active product must have a price in
    the resulting currency, or nothing is applied.
    Everything is applied in one transaction.

    A `settings` section also requires the `organizations:write` scope and
    permission to manage the organization, a `benefits` section the
    `benefits:write` scope, a `products` section the `products:write` scope,
    and a `discounts` section the `discounts:write` scope.
    """
    return await declarative_config_service.apply(session, redis, auth_subject, config)


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
                "missing an organizations, benefits, products or discounts scope "
                "for those sections, "
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

    Returns the action for each resource, and every issue: `error` issues make
    apply fail, `warning` issues don't.

    A `settings` section also requires the `organizations:read` or
    `organizations:write` scope, a `benefits` section `benefits:read` or
    `benefits:write`, a `products` section `products:read` or
    `products:write`, and a `discounts` section `discounts:read` or
    `discounts:write`.
    """
    return await declarative_config_service.plan(session, auth_subject, config)
