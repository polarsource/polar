import math
from collections.abc import Iterator
from decimal import Decimal


def non_negative_running_sum(values: Iterator[int]) -> int:
    """
    Calculate the non-negative running sum of a sequence.
    The sum never goes below zero - if adding a value would make it negative,
    the sum becomes zero instead.

    Args:
        values: An iterable of integers

    Returns:
        The non-negative running sum
    """
    current_sum = 0

    for value in values:
        current_sum = max(0, current_sum + value)

    return current_sum


def polar_round(number: int | float | Decimal) -> int:
    """
    Round to nearest integer, but round .5 away from 0.
    This means `polar_round(8.5) == 9.0` and `polar_round(-8.5) == -9.0`.

    We can't use Python's built-in `round()` as that rounds 0.5 to 0.0.
    """
    if number >= 0:
        return math.ceil(number) if number - int(number) >= 0.5 else math.floor(number)
    else:
        return math.floor(number) if number - int(number) <= -0.5 else math.ceil(number)
