from typing import Annotated

from fastapi import Query

_OrganizationNameQuery = Query(
    min_length=1,
    example="my-org",
    description="Filter by organization name.",
)


OrganizationNameQuery = Annotated[str, _OrganizationNameQuery]
OptionalOrganizationNameQuery = Annotated[str | None, _OrganizationNameQuery]
