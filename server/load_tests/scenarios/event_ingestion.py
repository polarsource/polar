"""
Event ingestion load test scenarios.

Simulates production event ingestion patterns based on observed Mycheli.AI traffic:
- Power-law customer distribution (top 1 = 35%, top 5 = 78%, top 10 = 90%)
- Event types: generate.text (70%) and generate.image (30%)
- Meter slugs: v1:meter:pack (60%) and v1:meter:tier (40%)
"""

from locust import HttpUser, TaskSet, between, task

from load_tests.common import (
    PowerLawDistribution,
    generate_event_batch,
    get_auth_headers,
)
from load_tests.config import config


class EventIngestionTaskSet(TaskSet):
    """
    Task set for event ingestion load testing.

    Simulates batch event ingestion with power-law customer distribution
    matching observed production patterns.
    """

    distribution: PowerLawDistribution | None = None

    def on_start(self) -> None:
        """Initialize distribution on task start."""
        if not config.event_external_customer_ids:
            raise ValueError(
                "LOAD_TEST_EVENT_EXTERNAL_CUSTOMER_IDS environment variable is required. "
                "Set it to a comma-separated list of external customer IDs."
            )
        self.distribution = PowerLawDistribution(config.event_external_customer_ids)

    @task
    def ingest_events(self) -> None:
        """Ingest a batch of events."""
        if self.distribution is None:
            return

        batch = generate_event_batch(distribution=self.distribution)

        with self.client.post(
            "/v1/events/ingest",
            json={"events": batch},
            headers=get_auth_headers(),
            name="[Events] Ingest Batch",
            catch_response=True,
        ) as response:
            if response.status_code == 200:
                data = response.json()
                inserted = data.get("inserted", 0)
                duplicates = data.get("duplicates", 0)
                if inserted > 0 or duplicates > 0:
                    response.success()
                else:
                    response.failure("No events inserted or duplicated")
            elif response.status_code == 401:
                response.failure("Unauthorized - check LOAD_TEST_API_TOKEN")
            elif response.status_code == 403:
                response.failure("Forbidden - check API token permissions")
            elif response.status_code == 422:
                try:
                    error_data = response.json()
                    detail = error_data.get("detail", response.text)
                    response.failure(f"Validation error: {detail}")
                except Exception:
                    response.failure(f"Validation error: {response.text}")
            else:
                response.failure(f"HTTP {response.status_code}: {response.text[:200]}")


class EventIngestionUser(HttpUser):
    """
    Load test user for event ingestion.

    Simulates event ingestion traffic following Mycheli.AI production patterns:
    - 18k events/hour, 2.7k requests/hour (~7 events/batch)
    - Peak: 747 events/min (observed 2025-11-29)
    - Power-law customer distribution (top 1=35%, top 5=78%, top 10=90%)

    Scaling guide (with default batch_size=7, wait_time=0.5-1.5s):
    Each user makes ~40-120 requests/min = ~280-840 events/min

    To match production loads:
    - 1-2 users  ~= 300-750 events/min  (1x production peak)
    - 3-4 users  ~= 900-1500 events/min (2x production peak)
    - 5-8 users  ~= 1500-3000 events/min (4x production peak)
    - 10+ users  ~= 3000+ events/min (stress test)
    """

    wait_time = between(0.5, 1.5)
    tasks = [EventIngestionTaskSet]

    def on_start(self) -> None:
        """Validate configuration on user start."""
        if not config.event_external_customer_ids:
            raise ValueError(
                "LOAD_TEST_EVENT_EXTERNAL_CUSTOMER_IDS is required for event ingestion tests"
            )
        if not config.api_token:
            raise ValueError(
                "LOAD_TEST_API_TOKEN is required for event ingestion tests"
            )
