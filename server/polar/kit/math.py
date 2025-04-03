from collections.abc import Iterator


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
