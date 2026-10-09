import collections.abc
import contextlib
import datetime
import typing

from outpost.env import Environment
from outpost.reducer import BUCKET_SIZE, EventKey, Updates, get_bucket_start


class MemoryStorage:
    def __init__(self) -> None:
        self.buckets: dict[tuple[str, str, int], int | float] = {}
        self.event_keys: set[EventKey] = set()

    @classmethod
    @contextlib.asynccontextmanager
    async def create(
        cls, env: Environment
    ) -> collections.abc.AsyncIterator[typing.Self]:
        yield cls()

    async def write_updates(self, updates: Updates) -> None:
        for (customer_id, reducer_id, bucket_start, func), value in updates.items():
            key = (customer_id, reducer_id, bucket_start)
            previous = self.buckets.get(key)
            match func:
                case "count" | "sum":
                    value = (previous or 0) + value
                case "min":
                    value = min(previous, value) if previous is not None else value
                case "max":
                    value = max(previous, value) if previous is not None else value
                case _:
                    message = f"Invalid aggregation function: {func}"
                    raise ValueError(message)
            self.buckets[key] = value

    async def claim(self, keys: collections.abc.Sequence[EventKey]) -> list[bool]:
        oldest_bucket_start = (
            get_bucket_start(datetime.datetime.now(datetime.UTC)) - BUCKET_SIZE
        )
        self.event_keys = {
            key for key in self.event_keys if key[1] >= oldest_bucket_start
        }
        claimed: list[bool] = []
        for key in keys:
            claimed.append(key not in self.event_keys)
            self.event_keys.add(key)
        return claimed
