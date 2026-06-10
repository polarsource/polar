from enum import StrEnum
from typing import Annotated

from fastapi import Depends

from polar.kit.sorting import Sorting, SortingGetter


class LLMProviderConfigSortProperty(StrEnum):
    created_at = "created_at"
    provider = "provider"
    model_name = "model_name"


ListSorting = Annotated[
    list[Sorting[LLMProviderConfigSortProperty]],
    Depends(SortingGetter(LLMProviderConfigSortProperty, ["-created_at"])),
]
