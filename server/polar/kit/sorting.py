from collections.abc import Awaitable, Callable
from enum import StrEnum
from typing import Annotated

from fastapi import Query
from pydantic import BaseModel, Field

from polar.exceptions import PolarRequestValidationError

type Sorting[PE] = tuple[PE, bool]


def SortingGetter[PE: StrEnum](
    sort_property_enum: type[PE], default_sorting: list[str]
) -> Callable[..., Awaitable[list[Sorting[PE]]]]:
    sort_property_full_enum = StrEnum(  # type: ignore[misc]
        sort_property_enum.__name__,
        [
            value
            for member in sort_property_enum
            for value in (member.value, f"-{member.value}")
        ],
    )

    class SortingParams(BaseModel):
        sorting: list[sort_property_full_enum] | None = Field(  # type: ignore[assignment]
            default_sorting,
            description=(
                "Sorting criterion. "
                "Several criteria can be used simultaneously and will be applied in order. "
                "Add a minus sign `-` before the criteria name to sort by descending order."
            ),
        )

    async def get_sorting(
        params: Annotated[SortingParams, Query()],
    ) -> list[Sorting[PE]]:
        sorting = params.sorting if params.sorting is not None else default_sorting

        parsed_sorting: list[tuple[PE, bool]] = []
        for criteria in sorting:
            desc = False
            if criteria[0] == "-":
                desc = True
                criteria = criteria[1:]
            try:
                parsed_sorting.append((sort_property_enum(criteria), desc))
            except ValueError:
                raise PolarRequestValidationError(
                    [
                        {
                            "loc": ("query", "sorting"),
                            "input": criteria,
                            "msg": "Invalid sorting criterion.",
                            "type": "enum",
                        }
                    ]
                )
        return parsed_sorting

    return get_sorting
