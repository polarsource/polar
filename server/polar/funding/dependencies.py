from typing import Annotated

from fastapi import Query

from .service import ListFundingSortBy

ListFundingSorting = Annotated[
    list[ListFundingSortBy],
    Query(
        description=(
            "Sorting criterion. "
            "Several criteria can be used simultaneously and will be applied in order."
        ),
    ),
]
