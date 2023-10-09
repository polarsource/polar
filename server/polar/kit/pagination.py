import math
from collections.abc import Sequence
from typing import Annotated, Any, Generic, NamedTuple, Self, TypeVar

from fastapi import Depends, Query
from pydantic.generics import GenericModel
from sqlalchemy import Select, func, over
from sqlalchemy.sql._typing import _ColumnsClauseArgument

from polar.config import settings
from polar.kit.db.postgres import AsyncSession
from polar.kit.schemas import Schema

T = TypeVar("T", bound=Any)


class PaginationParams(NamedTuple):
    page: int
    limit: int


async def paginate(
    session: AsyncSession,
    statement: Select[T],
    *,
    pagination: PaginationParams,
    count_clause: _ColumnsClauseArgument[Any] | None = None,
) -> tuple[Sequence[T], int]:
    page, limit = pagination
    offset = limit * (page - 1)
    statement = statement.offset(offset).limit(limit)

    if count_clause is not None:
        statement = statement.add_columns(count_clause)
    else:
        statement = statement.add_columns(over(func.count()))

    result = await session.execute(statement)

    results: list[T] = []
    count = 0
    for row in result.unique().all():
        (*queried_data, count) = row._tuple()
        if len(queried_data) == 1:
            results.append(queried_data[0])
        else:
            results.append(queried_data)

    return results, count


async def get_pagination_params(
    page: int = Query(1, description="Page number, defaults to 1.", gt=0),
    limit: int = Query(
        10,
        description=(
            f"Size of a page, defaults to 10. "
            f"Maximum is {settings.API_PAGINATION_MAX_LIMIT}"
        ),
        gt=0,
    ),
) -> PaginationParams:
    return PaginationParams(page, min(settings.API_PAGINATION_MAX_LIMIT, limit))


PaginationParamsQuery = Annotated[PaginationParams, Depends(get_pagination_params)]


class Pagination(Schema):
    total_count: int
    max_page: int


class ListResource(GenericModel, Generic[T]):
    items: Sequence[T] = []
    pagination: Pagination

    @classmethod
    def from_paginated_results(
        cls, items: Sequence[T], total_count: int, pagination_params: PaginationParams
    ) -> Self:
        return cls(
            items=items,
            pagination=Pagination(
                total_count=total_count,
                max_page=math.ceil(total_count / pagination_params.limit),
            ),
        )
