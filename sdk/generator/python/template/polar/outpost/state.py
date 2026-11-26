import collections.abc
import dataclasses
import math

from polar.outpost.errors import NotReadyError
from polar.outpost.reducer import BucketStatistics, Reducer


def _number(value: str) -> int | float:
    if value.isdecimal() or (value[:1] == "-" and value[1:].isdecimal()):
        return int(value)
    number = float(value)
    if not math.isfinite(number):
        raise ValueError("Stored aggregation values must be finite")
    return number


def _decode(value: str | bytes) -> str:
    return value.decode() if isinstance(value, bytes) else value


@dataclasses.dataclass
class ReducerState:
    cold_until: int | None
    cold: BucketStatistics
    buckets: dict[int, BucketStatistics]
    # The part of each bucket Polar has not confirmed yet.
    pending: dict[int, BucketStatistics]
    # The pull's reset count when Polar last answered for it.
    confirmed_after_resets: int | None = None


def decode_state(values: collections.abc.Sequence[str | bytes]) -> ReducerState:
    cold_until: int | None = None
    cold = BucketStatistics()
    buckets: dict[int, BucketStatistics] = {}
    pending: dict[int, BucketStatistics] = {}
    confirmed_after_resets: int | None = None
    # The statistics each `<group>:<statistic>` field writes to, by group: `cold` and every
    # `bucket:<start>` or `pending:<start>` seen so far.
    groups: dict[str, BucketStatistics] = {"cold": cold}
    # Fields and values alternate: zipping one iterator with itself reads them in pairs.
    pairs = iter(values)
    for field, value in zip(pairs, pairs, strict=True):
        if isinstance(field, bytes):
            field = field.decode()
        if isinstance(value, bytes):
            value = value.decode()
        group, separator, statistic = field.rpartition(":")
        bucket = groups.get(group)
        if bucket is None:
            if not separator:
                if field == "cold_until":
                    cold_until = int(value)
                elif field == "reset":
                    confirmed_after_resets = int(value)
                continue
            kind, _, timestamp = group.partition(":")
            if kind == "invalid":
                raise NotReadyError("Outpost cannot read an unconfirmed bucket extremum")
            if kind == "bucket" or kind == "pending":
                bucket = BucketStatistics()
                (buckets if kind == "bucket" else pending)[int(timestamp)] = bucket
                groups[group] = bucket
            else:
                continue
        setattr(bucket, statistic, int(value) if value.isdecimal() else _number(value))
    return ReducerState(
        cold_until=cold_until,
        cold=cold,
        buckets=buckets,
        pending=pending,
        confirmed_after_resets=confirmed_after_resets,
    )


# Polar's totals cover the cold buckets: the local read adds what Polar has not confirmed in
# them, and every local event in the buckets Polar has not sealed yet.
def consumed_units(state: ReducerState, func: str) -> int | float:
    cold_until = state.cold_until
    assert cold_until is not None
    cold = state.cold
    count, total, low, high = cold.count, cold.sum, cold.min, cold.max
    parts = [s for start, s in state.pending.items() if start < cold_until]
    parts += [s for start, s in state.buckets.items() if start >= cold_until]
    for statistics in parts:
        count += statistics.count
        total += statistics.sum
        if statistics.min is not None and (low is None or statistics.min < low):
            low = statistics.min
        if statistics.max is not None and (high is None or statistics.max > high):
            high = statistics.max
    if isinstance(total, float) and not math.isfinite(total):
        raise ValueError("Aggregation values must be finite")
    return BucketStatistics(count, total, low, high).quantity(func)


# The statistics a reducer's quantity adds up: all a read needs of its state.
def _statistics_of(reducer: Reducer) -> str:
    func = reducer["aggregation"]["func"]
    return "sum,count" if func == "avg" else func


# A customer's state for one reducer is None while Polar does not know the customer.
def _is_ready(state: ReducerState | None) -> bool:
    return state is None or state.cold_until is not None
