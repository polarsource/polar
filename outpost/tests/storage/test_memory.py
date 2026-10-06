import pytest

from outpost.storage.memory import MemoryStorage


@pytest.mark.anyio
async def test_memory_aggregations() -> None:
    storage = MemoryStorage()
    for value in (0, -4, 10, 1):
        await storage.write_updates(
            {
                ("customer", "count", "count"): 1,
                ("customer", "sum", "sum"): value,
                ("customer", "min", "min"): value - 0.5,
                ("customer", "max", "max"): value + 0.5,
                ("other", "sum", "sum"): 2**63 + 1,
            }
        )
    await storage.write_updates({})
    assert storage.meters == {
        ("customer", "count"): 4,
        ("customer", "sum"): 7,
        ("customer", "min"): -4.5,
        ("customer", "max"): 10.5,
        ("other", "sum"): 4 * (2**63 + 1),
    }
    assert MemoryStorage().meters == {}
