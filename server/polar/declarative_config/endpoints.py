from typing import Annotated

from fastapi import Depends, Query, status
from pydantic import UUID4

from polar.catalog.service import CatalogNotFound
from polar.exceptions import NotPermitted, Unauthorized
from polar.openapi import APITag, destructive
from polar.postgres import (
    AsyncReadSession,
    AsyncSession,
    get_db_read_session,
    get_db_session,
)
from polar.redis import Redis, get_redis
from polar.routing import APIRouter

from .auth import ConfigOrganizationWrite, ConfigRead, ConfigWrite
from .schemas import (
    Config,
    ConfigApplyResult,
    ConfigDisable,
    ConfigExport,
    ConfigInit,
    ConfigPlan,
    ConfigPrune,
    DeclarativeConfigExportParams,
)
from .service import (
    ConfigAsCodeNotEnabled,
    ConfigBenefitConflict,
    ConfigCatalogPublished,
    ConfigCustomFieldConflict,
    ConfigInvalid,
    ConfigMeterConflict,
    ConfigProductConflict,
    ConfigUnsupportedResources,
)
from .service import declarative_config as declarative_config_service

router = APIRouter(prefix="/config", tags=["config", APITag.private])

CatalogNotFoundResponse = {
    "description": "No catalog has this ID.",
    "model": CatalogNotFound.schema(),
}

CatalogQuery = Annotated[
    UUID4 | None,
    Query(
        description="ID of a catalog, published or draft. Defaults to the live catalog."
    ),
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
                "or missing a scope required by one of the sections."
            ),
            "model": NotPermitted.schema(),
        },
        404: CatalogNotFoundResponse,
        409: {
            "description": (
                "Config as code isn't enabled and config can't manage "
                "some of the organization's benefits or products."
            ),
            "model": ConfigUnsupportedResources.schema(),
        },
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

    With `catalog_id`, the config comes from that catalog version.

    `config` has the shape plan and apply accept, without `organization_id`:
    planning it for the same organization without edits reports no changes.
    Resources without an `external_id`, archived ones, ones config can't express
    (or that reference a skipped resource), and ones beyond the config limit are
    listed in `skipped`, up to the config limit per section.

    Works before config as code is enabled, so the catalog can be reviewed
    before `init`; `enabled` says whether it is.

    Requires the read or write scope of every exported section.
    """
    return await declarative_config_service.export(
        session, auth_subject, filters.organization_id, catalog_id
    )


@router.post(
    "/init",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Init Config",
    responses={
        204: {"description": "Config as code enabled."},
        403: {
            "description": "Not allowed to manage this organization.",
            "model": NotPermitted.schema(),
        },
        409: {
            "description": (
                "The organization has benefits or products config can't manage yet, "
                "or another request gave a resource the same external ID."
            ),
            "model": ConfigUnsupportedResources.schema()
            | ConfigMeterConflict.schema()
            | ConfigBenefitConflict.schema()
            | ConfigProductConflict.schema(),
        },
    },
)
async def init(
    config_init: ConfigInit,
    auth_subject: ConfigOrganizationWrite,
    session: AsyncSession = Depends(get_db_session),
) -> None:
    """
    Enable config as code for the organization.

    With `external_ids`, also give existing meters, benefits and products
    without an `external_id` the requested one, so export includes them and
    apply updates them instead of creating new ones. Requires the write scope
    of each section the assignments touch.

    Enabling also requires `benefits:read` and `products:read`, to check that
    config can manage every benefit and product.

    The products and benefits that have an `external_id` are published as the
    first catalog, unless one is already live. Disabling reverts to it.
    """
    await declarative_config_service.init(session, auth_subject, config_init)


@router.post(
    "/disable",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Disable Config",
    openapi_extra=destructive(),
    responses={
        204: {"description": "Config as code disabled."},
        403: {
            "description": (
                "Not allowed to manage this organization, "
                "or config as code isn't enabled for it."
            ),
            "model": NotPermitted.schema() | ConfigAsCodeNotEnabled.schema(),
        },
        409: {
            "description": "More than one catalog was published.",
            "model": ConfigCatalogPublished.schema(),
        },
    },
)
async def disable(
    config_disable: ConfigDisable,
    auth_subject: ConfigOrganizationWrite,
    session: AsyncSession = Depends(get_db_session),
) -> None:
    """
    Stop managing the organization's catalog as code, so it can be edited in the
    dashboard and API again.

    The draft catalog is discarded, and the live catalog is removed: its
    products and benefits stay as they are. So do meters and settings applied
    in the meantime.

    Only possible while at most one catalog was published.
    """
    await declarative_config_service.disable(session, auth_subject, config_disable)


@router.post(
    "/draft",
    response_model=ConfigApplyResult,
    summary="Draft Config",
    responses={
        200: {"description": "Config saved to the draft catalog."},
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
            | ConfigCustomFieldConflict.schema(),
        },
    },
)
async def draft(
    config: Config,
    auth_subject: ConfigWrite,
    session: AsyncSession = Depends(get_db_session),
    redis: Redis = Depends(get_redis),
) -> ConfigApplyResult:
    """
    Save a declarative config document to the organization's draft catalog.
    Nothing changes for customers until the draft is published.

    Meters, benefits and products are matched by
    `external_id`: missing ones are created, and changed ones are updated.
    Deprecated products are neither created nor updated.
    Deprecated products, and products that `config pull` exports but the config
    doesn't list, are left out of the catalog. Other products, and all
    products when `products` is omitted, are left untouched. A product that
    isn't listed but has a billable subscription or a pending subscription
    update must be marked deprecated instead, or nothing is saved.
    Other resources that aren't listed are left untouched.
    `settings` go live with the catalog, so products can be priced in a new
    `payments.currency` in the same config. Every active product must have a price in
    the resulting currency, or nothing is saved.
    Everything is saved in one transaction.

    Each section requires the write scope for its resource.
    """
    return await declarative_config_service.apply(
        session, redis, auth_subject, config, publish=False
    )


@router.post(
    "/validate",
    response_model=ConfigPlan,
    summary="Validate Config",
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
async def validate(
    config: Config,
    auth_subject: ConfigRead,
    catalog_id: CatalogQuery = None,
    session: AsyncSession = Depends(get_db_session),
) -> ConfigPlan:
    """
    Check a declarative config document and preview what saving it to the draft
    would change, without changing anything.

    Returns the action for each resource, and every issue: `error` issues make
    draft fail, `warning` issues don't.

    With the ID of an archived catalog, the result shows the changes from that
    version instead of the live one, without settings, and the response's
    `catalog` is None.

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
