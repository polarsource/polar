from typing import Annotated, Any

from fastapi import Body, Depends
from pydantic import ValidationError

from polar.exceptions import (
    NotPermitted,
    PolarRequestValidationError,
    Unauthorized,
)
from polar.meter.auth import MeterRead, MeterWrite
from polar.openapi import APITag
from polar.organization.resolver import get_payload_organization
from polar.postgres import AsyncSession, get_db_session
from polar.routing import APIRouter

from .schemas import Config, ConfigApplyResult, ConfigOrganization, ConfigValidation
from .service import ConfigAsCodeNotEnabled, ConfigMeterConflict, ConfigMeterLocked
from .service import declarative_config as declarative_config_service
from .validation import validate as validate_config

router = APIRouter(prefix="/config", tags=["config", APITag.private])


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
                "A meter is already aggregating events and its filter or "
                "aggregation would change, or another request created the "
                "same meter concurrently."
            ),
            "model": ConfigMeterLocked.schema() | ConfigMeterConflict.schema(),
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
    "/validate",
    summary="Validate Config",
    response_model=ConfigValidation,
    responses={
        401: {"description": "Not authenticated.", "model": Unauthorized.schema()},
        403: {
            "description": (
                "Not allowed to read this organization's meters, "
                "or config as code isn't enabled for it."
            ),
            "model": NotPermitted.schema() | ConfigAsCodeNotEnabled.schema(),
        },
    },
)
async def validate(
    auth_subject: MeterRead,
    config: Annotated[
        Any,
        Body(
            description=(
                "The config document. `organization_id` is read from it like "
                "on apply, and is required unless you use an organization token."
            )
        ),
    ],
    session: AsyncSession = Depends(get_db_session),
) -> ConfigValidation:
    """
    Validate a declarative config document against an organization without
    applying it. Every problem is reported at once, with its path in the document.
    """
    organization = await get_payload_organization(
        session, auth_subject, _organization_of(config)
    )
    if not organization.is_config_as_code_enabled:
        raise ConfigAsCodeNotEnabled()
    validated = await validate_config(session, organization, _document_of(config))
    return ConfigValidation(issues=validated.issues)


def _organization_of(config: Any) -> ConfigOrganization:
    if not isinstance(config, dict):
        return ConfigOrganization()
    try:
        return ConfigOrganization.model_validate(config)
    except ValidationError as e:
        raise PolarRequestValidationError(
            [{**error, "loc": ("body", *error["loc"])} for error in e.errors()]
        ) from e


def _document_of(config: Any) -> Any:
    if not isinstance(config, dict):
        return config
    return {key: value for key, value in config.items() if key != "organization_id"}
