import datetime

import pytest

from outpost.reducer import BUCKET_SIZE, get_bucket_start
from outpost.storage.memory import MemoryStorage


@pytest.mark.anyio
async def test_memory_aggregations() -> None:
    storage = MemoryStorage()
    for value in (0, -4, 10, 1):
        await storage.write_updates(
            {
                ("customer", "count", 300, "count"): 1,
                ("customer", "sum", 300, "sum"): value,
                ("customer", "min", 300, "min"): value - 0.5,
                ("customer", "max", 300, "max"): value + 0.5,
                ("other", "sum", 300, "sum"): 2**63 + 1,
            }
        )
    await storage.write_updates({})
    assert storage.buckets == {
        ("customer", "count", 300): 4,
        ("customer", "sum", 300): 7,
        ("customer", "min", 300): -4.5,
        ("customer", "max", 300): 10.5,
        ("other", "sum", 300): 4 * (2**63 + 1),
    }
    assert MemoryStorage().buckets == {}


@pytest.mark.anyio
async def test_memory_claim() -> None:
    storage = MemoryStorage()
    current = get_bucket_start(datetime.datetime.now(datetime.UTC))
    keys = [
        ("customer", current, "a"),
        ("customer", current, "a"),
        ("customer", current - BUCKET_SIZE, "a"),
    ]
    assert await storage.claim(keys) == [True, False, True]
    assert await storage.claim(keys[:1]) == [False]
    assert await storage.claim([]) == []


@pytest.mark.anyio
async def test_memory_claim_forgets_older_buckets() -> None:
    storage = MemoryStorage()
    current = get_bucket_start(datetime.datetime.now(datetime.UTC))
    keys = [
        ("customer", current - BUCKET_SIZE, "a"),
        ("customer", current - 2 * BUCKET_SIZE, "b"),
    ]

    await storage.claim(keys)

    assert await storage.claim(keys) == [False, True]
