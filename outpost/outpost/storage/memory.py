import collections.abc
import contextlib
import typing

from outpost.env import Environment
from outpost.reducer import Updates


class MemoryStorage:
    def __init__(self) -> None:
        self.meters: dict[tuple[str, str], int | float] = {}

    @classmethod
    @contextlib.asynccontextmanager
    async def create(
        cls, env: Environment
    ) -> collections.abc.AsyncIterator[typing.Self]:
        yield cls()

    async def write_updates(self, updates: Updates) -> None:
        for (customer_id, meter_id, func), value in updates.items():
            key = (customer_id, meter_id)
            previous = self.meters.get(key)
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
            self.meters[key] = value
