from typing import Annotated

from fastapi import Depends, Query

from polar.enums import Platforms
from polar.exceptions import PolarRequestValidationError

_OrganizationNameQuery = Query(
    min_length=1,
    examples=["my-org"],
    description=(
        "Filter by organization name. "
        "Required unless you are authenticated as an organization."
    ),
)
OrganizationNameQuery = Annotated[str, _OrganizationNameQuery]
OptionalOrganizationNameQuery = Annotated[str | None, _OrganizationNameQuery]

_PlatformQuery = Query(
    examples=[Platforms.github],
    description=(
        "Platform linked to `organization_name`. "
        "Required if `organization_name` is set. "
        "Currently, only `github` is supported."
    ),
)
PlatformQuery = Annotated[Platforms, _PlatformQuery]
OptionalPlatformQuery = Annotated[Platforms | None, _PlatformQuery]

_OrganizationNamePlatform = tuple[str, Platforms]


async def _get_optional_organization_name_platform(
    organization_name: OptionalOrganizationNameQuery = None,
    platform: OptionalPlatformQuery = None,
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
    organization_name: OrganizationNameQuery, platform: PlatformQuery
) -> _OrganizationNamePlatform:
    return organization_name, platform


OrganizationNamePlatform = Annotated[
    _OrganizationNamePlatform, Depends(_get_organization_name_platform)
]
OptionalOrganizationNamePlatform = Annotated[
    _OrganizationNamePlatform | None, Depends(_get_optional_organization_name_platform)
]
