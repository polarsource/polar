from typing import Annotated

from fastapi import Depends, Query

from polar.exceptions import BadRequest

from .service.subscription import SearchSort, SearchSortProperty


async def get_search_sorting(
    sorting: list[str] = Query(
        ["-started_at"],
        description=(
            "Sorting criterion. "
            "Several criteria can be used simultaneously and will be applied in order. "
            "Add a minus sign `-` before the criteria name to sort by descending order."
        ),
    ),
) -> list[SearchSort]:
    search_sorting: list[SearchSort] = []
    for criteria in sorting:
        desc = False
        if criteria[0] == "-":
            desc = True
            criteria = criteria[1:]
        try:
            search_sorting.append((SearchSortProperty(criteria), desc))
        except ValueError as e:
            raise BadRequest() from e
    return search_sorting


SearchSorting = Annotated[list[SearchSort], Depends(get_search_sorting)]
