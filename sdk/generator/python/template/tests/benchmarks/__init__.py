import json
import pathlib
import typing

from polar.outpost.reducer import BUCKET_SIZE, Reducer

# Shared benchmark data, copied from sdk/generator/benchmarks/outpost.json.
DATA = json.loads(pathlib.Path(__file__).with_name("benchmark.json").read_text())
# 5-minute buckets: 5 minutes, 1 hour, 24 hours of usage since the last snapshot.
COLD_UNTIL: int = DATA["cold_until"]
BUCKET_COUNTS: list[int] = DATA["bucket_counts"]
CHANNEL: str = DATA["channel"]
EPOCH: str = DATA["epoch"]
REDUCER: Reducer = DATA["reducer"]
SNAPSHOT: dict[str, typing.Any] = DATA["snapshot"]
# Events pending in one bucket: a batch the buffer just delivered, and a backlog after a 429.
PENDING_COUNTS = [1, 100, 1000]
# What WRITE_BUCKET stores per event: its value.
PENDING_ENTRY = "7"


def pending_ids(count: int) -> list[str]:
    return [f"event-{index}" for index in range(count)]


# The `pending:<start>:<statistic>` fields of a bucket with `count` events of 7 units pending.
def encode_pending(start: int, count: int) -> list[str]:
    prefix = f"pending:{start}:"
    return [
        f"{prefix}count",
        str(count),
        f"{prefix}sum",
        str(7 * count),
        f"{prefix}min",
        "7",
        f"{prefix}max",
        "7",
    ]


# The pending hash of a bucket: one entry per event id.
def pending_entries(ids: list[str]) -> list[str]:
    return [field for external_id in ids for field in (external_id, PENDING_ENTRY)]


# The flat field list decode_state reads: one `bucket:<start>:<statistic>` entry per bucket.
def encode_state(buckets: int) -> list[str]:
    fields = [
        "epoch",
        EPOCH,
        "revision",
        "4242",
        "cold_until",
        str(COLD_UNTIL),
        "snapshot_version",
        str(COLD_UNTIL + 1),
        "cold:count",
        "1000",
        "cold:sum",
        "123456",
        "cold:min",
        "1",
        "cold:max",
        "999",
        "credited:meter",
        "1000000",
        "credited_version:meter",
        str(COLD_UNTIL + 1),
    ]
    for index in range(buckets):
        prefix = f"bucket:{COLD_UNTIL + index * BUCKET_SIZE}:"
        fields += [f"{prefix}count", "10", f"{prefix}sum", str(100 + index)]
        fields += [f"{prefix}min", "1", f"{prefix}max", str(50 + index)]
    return fields
