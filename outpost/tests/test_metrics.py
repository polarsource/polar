from outpost import SNAPSHOT_TIMEOUT
from outpost.metrics import DECIDE_SECONDS


def test_decide_buckets_cover_the_snapshot_timeout() -> None:
    [metric] = DECIDE_SECONDS.collect()
    upper_bounds = {
        float(sample.labels["le"])
        for sample in metric.samples
        if sample.name.endswith("_bucket")
    }
    assert SNAPSHOT_TIMEOUT in upper_bounds
