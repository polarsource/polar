from typing import Annotated

from fastapi import Query

_RepositoryNameQuery = Query(
    min_length=1,
    examples=["my-repo"],
    description="Filter by repository name.",
)


RepositoryNameQuery = Annotated[str, _RepositoryNameQuery]
OptionalRepositoryNameQuery = Annotated[str | None, _RepositoryNameQuery]
