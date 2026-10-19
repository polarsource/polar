import json
import pathlib

from polar.outpost.reducer import BUCKET_SIZE

# Shared benchmark data, copied from sdk/generator/benchmarks/outpost.json.
DATA = json.loads(pathlib.Path(__file__).with_name("benchmark.json").read_text())
# 5-minute buckets: 5 minutes, 1 hour, 24 hours of usage since the last snapshot.
COLD_UNTIL: int = DATA["cold_until"]
BUCKET_COUNTS: list[int] = DATA["bucket_counts"]
CHANNEL: str = DATA["channel"]
EPOCH: str = DATA["epoch"]


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
    ]
    for index in range(buckets):
        prefix = f"bucket:{COLD_UNTIL + index * BUCKET_SIZE}:"
        fields += [f"{prefix}count", "10", f"{prefix}sum", str(100 + index)]
        fields += [f"{prefix}min", "1", f"{prefix}max", str(50 + index)]
    return fields
