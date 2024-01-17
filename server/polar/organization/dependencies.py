from typing import Annotated

from fastapi import Depends, Query

from polar.enums import Platforms
from polar.exceptions import BadRequest

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
        raise BadRequest("platform is required when organization_name is set")

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
