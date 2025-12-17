from enum import StrEnum
from inspect import Parameter, Signature
from typing import Any

from fastapi import Query
from makefun import with_signature

from polar.exceptions import PolarRequestValidationError

type Sorting[PE] = tuple[PE, bool]


class _SortingGetter[PE: StrEnum]:
    def __init__(
        self, sort_property_enum: type[PE], default_sorting: list[str]
    ) -> None:
        self.sort_property_enum = sort_property_enum
        self.default_sorting = default_sorting

    async def __call__(self, sorting: list[str] | None) -> list[Sorting[PE]]:
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


def SortingGetter[PE: StrEnum](
    sort_property_enum: type[PE], default_sorting: list[str]
) -> _SortingGetter[PE]:
    """
    Here comes some blood magic 🧙‍♂️

    Generate a version of `_SortingGetter` with an overriden `__call__` signature.

    By doing so, we can dynamically inject the allowed sorting properties into FastAPI
    dependency, so they are properrly detected by the OpenAPI generator.
    """
    enum_values = []
    for value in sort_property_enum:
        enum_values.append(value.value)
        enum_values.append(f"-{value.value}")

    sort_property_full_enum = StrEnum(  # type: ignore[misc]
        sort_property_enum.__name__,
        enum_values,
    )

    parameters: list[Parameter] = [
        Parameter(name="self", kind=Parameter.POSITIONAL_OR_KEYWORD),
        Parameter(
            name="sorting",
            kind=Parameter.POSITIONAL_OR_KEYWORD,
            default=Query(
                default_sorting,
                description=(
                    "Sorting criterion. "
                    "Several criteria can be used simultaneously and will be applied in order. "
                    "Add a minus sign `-` before the criteria name to sort by descending order."
                ),
            ),
            annotation=list[sort_property_full_enum] | None,
        ),
    ]
    signature = Signature(parameters)

    class _SortingGetterSignature(_SortingGetter[Any]):
        @with_signature(signature)
        async def __call__(self, sorting: Any) -> list[Sorting[Any]]:
            return await super().__call__(sorting)

    return _SortingGetterSignature(sort_property_enum, default_sorting)
