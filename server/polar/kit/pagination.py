import math
from collections.abc import Sequence
from typing import Annotated, Any, NamedTuple, Self, overload

from fastapi import Depends, Query
from pydantic import BaseModel, GetCoreSchemaHandler
from pydantic._internal._repr import display_as_type
from pydantic_core import CoreSchema
from sqlalchemy import Select, func, over
from sqlalchemy.sql._typing import _ColumnsClauseArgument

from polar.config import settings
from polar.kit.db.models import RecordModel
from polar.kit.db.models.base import Model
from polar.kit.db.postgres import AsyncReadSession
from polar.kit.schemas import ClassName, Schema


class PaginationParams(NamedTuple):
    page: int
    limit: int


@overload
async def paginate[RM: RecordModel](
    session: AsyncReadSession,
    statement: Select[tuple[RM]],
    *,
    pagination: PaginationParams,
    count_clause: _ColumnsClauseArgument[Any] | None = None,
) -> tuple[Sequence[RM], int]: ...


@overload
async def paginate[M: Model](
    session: AsyncReadSession,
    statement: Select[tuple[M]],
    *,
    pagination: PaginationParams,
    count_clause: _ColumnsClauseArgument[Any] | None = None,
) -> tuple[Sequence[M], int]: ...


@overload
async def paginate[T: Any](
    session: AsyncReadSession,
    statement: Select[T],
    *,
    pagination: PaginationParams,
    count_clause: _ColumnsClauseArgument[Any] | None = None,
) -> tuple[Sequence[T], int]: ...


async def paginate(
    session: AsyncReadSession,
    statement: Select[Any],
    *,
    pagination: PaginationParams,
    count_clause: _ColumnsClauseArgument[Any] | None = None,
) -> tuple[Sequence[Any], int]:
    page, limit = pagination
    offset = limit * (page - 1)
    statement = statement.offset(offset).limit(limit)

    if count_clause is not None:
        statement = statement.add_columns(count_clause)
    else:
        statement = statement.add_columns(over(func.count()))

    result = await session.execute(statement)

    results: list[Any] = []
    count = 0
    for row in result.unique().all():
        (*queried_data, c) = row._tuple()
        count = int(c)
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
            f"Maximum is {settings.API_PAGINATION_MAX_LIMIT}."
        ),
        gt=0,
    ),
) -> PaginationParams:
    return PaginationParams(page, min(settings.API_PAGINATION_MAX_LIMIT, limit))


PaginationParamsQuery = Annotated[PaginationParams, Depends(get_pagination_params)]


class Pagination(Schema):
    total_count: int
    max_page: int


class ListResource[T: Any](BaseModel):
    items: list[T]
    pagination: Pagination

    @classmethod
    def from_paginated_results(
        cls, items: Sequence[T], total_count: int, pagination_params: PaginationParams
    ) -> Self:
        return cls(
            items=list(items),
            pagination=Pagination(
                total_count=total_count,
                max_page=math.ceil(total_count / pagination_params.limit),
            ),
        )

    @classmethod
    def model_parametrized_name(cls, params: tuple[type[Any], ...]) -> str:
        """
        Override default model name implementation to detect `ClassName` metadata.

        It's useful to shorten the name when a long union type is used.
        """
        param_names = []
        for param in params:
            if hasattr(param, "__metadata__"):
                for metadata in param.__metadata__:
                    if isinstance(metadata, ClassName):
                        param_names.append(metadata.name)
            else:
                param_names.append(display_as_type(param))

        params_component = ", ".join(param_names)
        return f"{cls.__name__}[{params_component}]"

    @classmethod
    def __get_pydantic_core_schema__(
        cls, source: type[BaseModel], handler: GetCoreSchemaHandler, /
    ) -> CoreSchema:
        """
        Override the schema to set the `ref` field to the overridden class name.
        """
        result = handler(source)
        result["ref"] = cls.__name__  # type: ignore
        return result
