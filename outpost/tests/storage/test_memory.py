import pytest

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
