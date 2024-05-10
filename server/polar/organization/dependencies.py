from typing import Annotated

from fastapi import Depends, Query

from polar.auth.dependencies import get_auth_subject
from polar.auth.models import AuthSubject, Subject, is_organization, is_user
from polar.enums import Platforms
from polar.exceptions import BadRequest, PolarRequestValidationError
from polar.models import Organization
from polar.postgres import AsyncSession, get_db_session

from .service import organization as organization_service

_OrganizationNameQuery = Query(
    min_length=1,
    examples=["my-org"],
    description="Filter by organization name.",
)


OrganizationNameQuery = Annotated[str, _OrganizationNameQuery]
OptionalOrganizationNameQuery = Annotated[str | None, _OrganizationNameQuery]

_OrganizationNamePlatform = tuple[str, Platforms]


async def _get_optional_organization_name_platform(
    organization_name: OptionalOrganizationNameQuery = None,
    platform: Platforms | None = Query(None),
) -> _OrganizationNamePlatform | None:
    if organization_name is None:
        return None

    if platform is None:
        raise PolarRequestValidationError(
            [
                {
                    "loc": ("query", "platform"),
                    "msg": "platform is required when organization name is provided.",
                    "type": "missing",
                    "input": None,
                }
            ]
        )

    return (organization_name, platform)


async def _get_organization_name_platform(
    organization_name: OrganizationNameQuery,
    platform: Platforms = Query(...),
) -> _OrganizationNamePlatform:
    return organization_name, platform


OrganizationNamePlatform = Annotated[
    _OrganizationNamePlatform, Depends(_get_organization_name_platform)
]
OptionalOrganizationNamePlatform = Annotated[
    _OrganizationNamePlatform | None, Depends(_get_optional_organization_name_platform)
]


async def _resolve_optional_organization(
    organization_name_platform: OptionalOrganizationNamePlatform,
    auth_subject: AuthSubject[Subject] = Depends(get_auth_subject),
    session: AsyncSession = Depends(get_db_session),
) -> Organization | None:
    # Organization token
    if is_organization(auth_subject):
        if organization_name_platform is not None:
            organization_name, platform = organization_name_platform
            raise PolarRequestValidationError(
                [
                    {
                        "loc": ("query",),
                        "msg": (
                            "You cannot filter by organization "
                            "when authenticated as an organization."
                        ),
                        "type": "organization_token",
                        "input": {
                            "organization_name": organization_name,
                            "platform": platform,
                        },
                    }
                ]
            )
        return auth_subject.subject

    # Get organization by name and platform
    if organization_name_platform is not None:
        organization_name, platform = organization_name_platform
        organization = await organization_service.get_by_name(
            session, platform, organization_name
        )
        if organization is None:
            raise PolarRequestValidationError(
                [
                    {
                        "loc": ("query",),
                        "msg": "Organization not found.",
                        "type": "value_error",
                        "input": {
                            "organization_name": organization_name,
                            "platform": platform,
                        },
                    }
                ]
            )
        return organization

    return None


ResolvedOptionalOrganization = Annotated[
    Organization | None, Depends(_resolve_optional_organization)
]


async def _resolve_organization(
    organization: ResolvedOptionalOrganization,
    auth_subject: AuthSubject[Subject] = Depends(get_auth_subject),
    session: AsyncSession = Depends(get_db_session),
) -> Organization:
    # Try to fallback with the user's personal organization, if any
    if organization is None and is_user(auth_subject):
        organization = await organization_service.get_personal(
            session, auth_subject.subject.id
        )

    if organization is None:
        raise BadRequest("An organization is required.")

    return organization


ResolvedOrganization = Annotated[Organization, Depends(_resolve_organization)]
