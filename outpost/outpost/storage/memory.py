import collections.abc
import contextlib
import datetime
import typing

from outpost.env import Environment
from outpost.reducer import (
    BUCKET_SIZE,
    CustomerState,
    EventKey,
    Snapshot,
    Updates,
    get_bucket_start,
)


class MemoryStorage:
    def __init__(self) -> None:
        self.buckets: dict[tuple[str, str, int], int | float] = {}
        self.event_keys: set[EventKey] = set()
        self.snapshots: dict[str, Snapshot] = {}

    @classmethod
    @contextlib.asynccontextmanager
    async def create(
        cls, env: Environment
    ) -> collections.abc.AsyncIterator[typing.Self]:
        yield cls()

    async def write_updates(self, updates: Updates) -> None:
        for (customer_id, reducer_id, bucket_start, func), value in updates.items():
            snapshot = self.snapshots.get(customer_id)
            if snapshot is not None and bucket_start < snapshot["cold_until"]:
                continue
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

    async def apply_snapshot(self, snapshot: Snapshot) -> None:
        customer_id = snapshot["external_customer_id"]
        current = self.snapshots.get(customer_id)
        if current is not None and current["cold_until"] > snapshot["cold_until"]:
            return
        self.snapshots[customer_id] = snapshot
        # ponytail: full scan, index buckets per customer if the memory store grows
        self.buckets = {
            key: value
            for key, value in self.buckets.items()
            if key[0] != customer_id or key[2] >= snapshot["cold_until"]
        }
        if current is None:
            for bucket in snapshot["buckets"]:
                key = (customer_id, bucket["reducer_id"], bucket["bucket_start"])
                self.buckets[key] = bucket["value"]

    async def read(self, customer_id: str) -> CustomerState:
        snapshot = self.snapshots.get(customer_id)
        return {
            "cold_until": snapshot["cold_until"] if snapshot else None,
            "cold": snapshot["cold"] if snapshot else {},
            "credited": snapshot["credited"] if snapshot else {},
            "buckets": {
                (reducer_id, bucket_start): value
                for (customer, reducer_id, bucket_start), value in self.buckets.items()
                if customer == customer_id
            },
        }
