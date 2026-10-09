import uuid
from datetime import UTC, datetime

from polar.reducer_bucket.redis_store import get_reducer_bucket_key

BUCKET_START = datetime(2026, 10, 7, 12, 5, tzinfo=UTC)


class TestGetReducerBucketKey:
    def test_distinguishes_customer_identities(self) -> None:
        reducer_id = uuid.uuid4()
        customer_id = uuid.uuid4()

        keys = {
            get_reducer_bucket_key(reducer_id, BUCKET_START, customer_id, "external"),
            get_reducer_bucket_key(reducer_id, BUCKET_START, customer_id, None),
            get_reducer_bucket_key(reducer_id, BUCKET_START, None, ""),
            get_reducer_bucket_key(reducer_id, BUCKET_START, None, None),
        }

        assert len(keys) == 4

    def test_hashes_external_customer_id(self) -> None:
        key = get_reducer_bucket_key(
            uuid.uuid4(), BUCKET_START, None, "jane@example.com"
        )

        assert "jane@example.com" not in key
