from prometheus_client import Counter, Histogram

LATENCY_BUCKETS = (
    0.0001,
    0.00025,
    0.0005,
    0.001,
    0.0025,
    0.005,
    0.01,
    0.025,
    0.05,
    0.1,
    0.25,
    0.5,
    1.0,
)

INGEST_SECONDS = Histogram(
    "outpost_ingest_seconds",
    "Time to handle an ingest request.",
    buckets=LATENCY_BUCKETS,
)
REDUCE_SECONDS = Histogram(
    "outpost_reduce_seconds",
    "Time to reduce an ingested batch.",
    buckets=LATENCY_BUCKETS,
)
EVENTS_INGESTED = Counter("outpost_events_ingested", "Events ingested.")
