import math
from collections.abc import Sequence
from typing import Annotated, Any, NamedTuple, Self, overload

from fastapi import Depends, Query
from pydantic import BaseModel, GetCoreSchemaHandler
from pydantic._internal._repr import display_as_type
from pydantic_core import CoreSchema
from sqlalchemy import Select, func, literal, select
from sqlalchemy.sql._typing import _ColumnsClauseArgument
from sqlalchemy.sql.selectable import Subquery

from polar.config import settings
from polar.kit.db.models import RecordModel
from polar.kit.db.models.base import Model
from polar.kit.db.postgres import AsyncReadSession
from polar.kit.schemas import ClassName, Schema


class PaginationParams(NamedTuple):
    page: int
    limit: int


def count_subquery(statement: Select[Any]) -> Subquery:
    """Build a count-safe subquery from a Select.

    `.subquery()` materializes every mapped column of the underlying entity,
    including those marked `deferred=True`. For count queries we only need
    row cardinality, so project a literal to avoid referencing (or loading)
    unused columns.
    """
    return statement.with_only_columns(literal(1)).order_by(None).subquery()


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

    if count_clause is not None:
        paginated = statement.offset(offset).limit(limit)
        paginated = paginated.add_columns(count_clause)
        result = await session.execute(paginated)
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

    count_statement = select(func.count()).select_from(count_subquery(statement))
    count_result = await session.execute(count_statement)
    count = count_result.scalar_one()

    paginated = statement.offset(offset).limit(limit)
    result = await session.execute(paginated)
    results = []
    for row in result.unique().all():
        queried_data = row._tuple()
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


class CursorPagination(Schema):
    has_next_page: bool


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


class ListResourceWithCursorPagination[T: Any](BaseModel):
    items: list[T]
    pagination: CursorPagination

    @classmethod
    def from_results(
        cls,
        items: Sequence[T],
        has_next_page: bool,
    ) -> Self:
        return cls(
            items=list(items),
            pagination=CursorPagination(has_next_page=has_next_page),
        )

    @classmethod
    def model_parametrized_name(cls, params: tuple[type[Any], ...]) -> str:
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
        result = handler(source)
        result["ref"] = cls.__name__  # type: ignore
        return result
