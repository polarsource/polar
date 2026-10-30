from typing import Annotated

from fastapi import Depends, Query
from pydantic import UUID4

from polar.catalog.service import CatalogNotFound
from polar.exceptions import NotPermitted, Unauthorized
from polar.openapi import APITag
from polar.postgres import (
    AsyncReadSession,
    AsyncSession,
    get_db_read_session,
    get_db_session,
)
from polar.redis import Redis, get_redis
from polar.routing import APIRouter

from .auth import ConfigRead, ConfigWrite
from .schemas import (
    Config,
    ConfigApplyResult,
    ConfigExport,
    ConfigPlan,
    ConfigPrune,
    DeclarativeConfigExportParams,
)
from .service import (
    ConfigAsCodeNotEnabled,
    ConfigBenefitConflict,
    ConfigInvalid,
    ConfigMeterConflict,
    ConfigProductConflict,
    ConfigWebhookConflict,
)
from .service import declarative_config as declarative_config_service

router = APIRouter(prefix="/config", tags=["config", APITag.private])

CatalogNotFoundResponse = {
    "description": "No published catalog has this ID.",
    "model": CatalogNotFound.schema(),
}

CatalogQuery = Annotated[
    UUID4 | None,
    Query(description="ID of a published catalog. Defaults to the live catalog."),
]


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
                "missing a scope required by one of the sections, "
                "or config as code isn't enabled for it."
            ),
            "model": NotPermitted.schema() | ConfigAsCodeNotEnabled.schema(),
        },
        404: CatalogNotFoundResponse,
    },
)
async def export(
    filters: Annotated[DeclarativeConfigExportParams, Query()],
    auth_subject: ConfigRead,
    catalog_id: CatalogQuery = None,
    session: AsyncReadSession = Depends(get_db_read_session),
) -> ConfigExport:
    """
    Export the organization's current config as a declarative config document.

    With `catalog_id`, products come from that catalog version. Settings, meters
    and benefits aren't versioned, so they're always the current ones.

    `config` has the shape plan and apply accept, without `organization_id`:
    planning it for the same organization without edits reports no changes.
    Resources without an `external_id`, archived ones, ones config can't express
    (or that reference a skipped resource), and ones beyond the config limit are
    listed in `skipped`, up to the config limit per section. Webhook endpoints
    are not exported.

    Requires the read or write scope of every exported section.
    """
    return await declarative_config_service.export(
        session, auth_subject, filters.organization_id, catalog_id
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
                "missing a scope required by one of the sections, "
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
            | ConfigProductConflict.schema()
            | ConfigWebhookConflict.schema(),
        },
    },
)
async def apply(
    config: Config,
    auth_subject: ConfigWrite,
    session: AsyncSession = Depends(get_db_session),
    redis: Redis = Depends(get_redis),
) -> ConfigApplyResult:
    """
    Apply a declarative config document to the organization.

    Meters, benefits, products and webhook endpoints are matched by
    `external_id`: missing ones are created, and changed ones are updated.
    Deprecated products are neither created nor updated.
    Deprecated products, and products that `config pull` exports but the config
    doesn't list, are left out of the published catalog. Other products, and all
    products when `products` is omitted, are left untouched. A product that
    isn't listed but has a billable subscription or a pending subscription
    update must be marked deprecated instead, or nothing is applied.
    Other resources that aren't listed are left untouched.
    `settings` are applied first, so products can be priced in a new
    `payments.currency` in the same config. Every active product must have a price in
    the resulting currency, or nothing is applied.
    Everything is applied in one transaction.

    Each section requires the write scope for its resource.
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
                "missing a scope required by one of the sections, "
                "or config as code isn't enabled for it."
            ),
            "model": NotPermitted.schema() | ConfigAsCodeNotEnabled.schema(),
        },
        404: CatalogNotFoundResponse,
    },
)
async def plan(
    config: Config,
    auth_subject: ConfigRead,
    catalog_id: CatalogQuery = None,
    session: AsyncSession = Depends(get_db_session),
) -> ConfigPlan:
    """
    Preview what applying a declarative config document would do, without applying it.

    Returns the action for each resource, and every issue: `error` issues make
    apply fail, `warning` issues don't.

    With the ID of an archived catalog, products are compared to that version
    instead of the live one. The plan then shows the changes from that version,
    not what apply would do, and the response's `catalog` is None.

    Each section requires the read or write scope for its resource.
    """
    return await declarative_config_service.plan(
        session, auth_subject, config, catalog_id
    )


@router.post(
    "/prune",
    response_model=ConfigPrune,
    summary="Prune Config",
    responses={
        200: {"description": "Deprecated resources checked."},
        401: {"description": "Not authenticated.", "model": Unauthorized.schema()},
        403: {
            "description": (
                "Not allowed to read this organization's products, "
                "missing a scope required by one of the sections, "
                "or config as code isn't enabled for it."
            ),
            "model": NotPermitted.schema() | ConfigAsCodeNotEnabled.schema(),
        },
    },
)
async def prune(
    config: Config,
    auth_subject: ConfigRead,
    session: AsyncReadSession = Depends(get_db_read_session),
) -> ConfigPrune:
    """
    Report which deprecated resources in a declarative config document are still in use.

    A deprecated resource can be removed from the config once no customer uses it
    and no product or benefit staying in the config references it.

    Each section requires the read or write scope for its resource.
    """
    return await declarative_config_service.prune(session, auth_subject, config)
