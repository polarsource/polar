from enum import StrEnum
from typing import Generic, TypeAlias, TypeVar

from fastapi import Query

from polar.exceptions import BadRequest

PE = TypeVar("PE", bound=StrEnum)

Sorting: TypeAlias = tuple[PE, bool]


class SortingGetter(Generic[PE]):
    def __init__(
        self, sort_property_enum: type[PE], default_sorting: list[str]
    ) -> None:
        self.sort_property_enum = sort_property_enum
        self.default_sorting = default_sorting

    async def __call__(
        self,
        sorting: list[str] | None = Query(
            None,
            description=(
                "Sorting criterion. "
                "Several criteria can be used simultaneously and will be applied in order. "
                "Add a minus sign `-` before the criteria name to sort by descending order."
            ),
        ),
    ) -> list[Sorting[PE]]:
        if sorting is None:
            sorting = self.default_sorting

        parsed_sorting: list[tuple[PE, bool]] = []
        for criteria in sorting:
            desc = False
            if criteria[0] == "-":
                desc = True
                criteria = criteria[1:]
            try:
                parsed_sorting.append((self.sort_property_enum(criteria), desc))
            except ValueError as e:
                raise BadRequest() from e
        return parsed_sorting
