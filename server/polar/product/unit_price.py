from polar.exceptions import PolarRequestValidationError

from .guard import UnitPrice


def validate_unit_limits(
    price: UnitPrice,
    units: int,
    loc: tuple[str, ...] = ("body", "units"),
    *,
    min_units: int | None = None,
    max_units: int | None = None,
) -> None:
    """Validate a unit quantity against the price's minimum/maximum.

    `min_units`/`max_units` narrow the price's own bounds with caller-level
    constraints, like the ones a checkout carries. Shared by the checkout and
    off-session order flows so both enforce identical bounds.
    """
    minimum_units = price.get_minimum_purchasable_units()
    maximum_units = price.get_maximum_units()

    if min_units is not None:
        minimum_units = max(minimum_units, min_units)
    if max_units is not None:
        if maximum_units is not None:
            maximum_units = min(maximum_units, max_units)
        else:
            maximum_units = max_units

    if units < minimum_units:
        raise PolarRequestValidationError(
            [
                {
                    "type": "greater_than_equal",
                    "loc": loc,
                    "msg": f"Minimum {minimum_units} units required.",
                    "input": units,
                    "ctx": {"ge": minimum_units},
                }
            ]
        )

    if maximum_units is not None and units > maximum_units:
        raise PolarRequestValidationError(
            [
                {
                    "type": "less_than_equal",
                    "loc": loc,
                    "msg": f"Maximum {maximum_units} units allowed.",
                    "input": units,
                    "ctx": {"le": maximum_units},
                }
            ]
        )


__all__ = ["validate_unit_limits"]
