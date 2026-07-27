from polar.enums import RecurringInterval


def meter_interval_divides_billing_interval(
    meter_interval: RecurringInterval,
    meter_interval_count: int,
    billing_interval: RecurringInterval,
    billing_interval_count: int,
) -> bool:
    """
    Whether a meter interval evenly divides a billing interval.

    The meter cycle must re-align with the billing cycle at every renewal, so the
    meter interval has to divide the billing interval cleanly. Day/week intervals are
    commensurable with each other (a week is 7 days) and month/year intervals are
    commensurable with each other (a year is 12 months), but the two families don't
    convert cleanly — so only a handful of cross-family combinations are valid. This
    mirrors the interval matrix in the design document.
    """
    m, n = meter_interval_count, billing_interval_count
    match (meter_interval, billing_interval):
        # Day/week meter interval on day/week billing
        case (RecurringInterval.day, RecurringInterval.day) | (
            RecurringInterval.week,
            RecurringInterval.week,
        ):
            return n % m == 0
        case (RecurringInterval.day, RecurringInterval.week):
            return (n * 7) % m == 0
        # A daily meter interval is the only day/week cadence that re-aligns on a
        # month/year boundary (every day is itself a valid sub-boundary).
        case (RecurringInterval.day, RecurringInterval.month) | (
            RecurringInterval.day,
            RecurringInterval.year,
        ):
            return m == 1
        # Month/year meter interval on month/year billing
        case (RecurringInterval.month, RecurringInterval.month) | (
            RecurringInterval.year,
            RecurringInterval.year,
        ):
            return n % m == 0
        case (RecurringInterval.month, RecurringInterval.year):
            return (n * 12) % m == 0
        # Anything else is impossible (meter interval coarser than billing) or would drift.
        case _:
            return False
