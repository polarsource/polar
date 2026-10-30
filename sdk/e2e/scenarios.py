import itertools

from polar.outpost.client import Configuration, Snapshot
from polar.outpost.reducer import BUCKET_SIZE, Reducer

from harness import (
    ConfirmStep,
    DisconnectStep,
    ExternalCustomerID,
    ExternalCustomerMeterRequest,
    Failure,
    IngestedStep,
    IngestStep,
    ReadStep,
    RedisStep,
    RestartStep,
    Scenario,
    SnapshotStep,
)

BUCKET = 1791806400000000


def credit_reducer(meter_id: str) -> Reducer:
    return {
        "id": f"credits-{meter_id}",
        "kind": "credit",
        "meter_ids": [meter_id],
        "filter": {
            "conjunction": "and",
            "clauses": [
                {"property": "source", "operator": "eq", "value": "system"},
                {"property": "name", "operator": "eq", "value": "meter.credited"},
                {"property": "meter_id", "operator": "eq", "value": meter_id},
            ],
        },
        "aggregation": {"func": "sum", "property": "units"},
    }


TOKENS: Reducer = {
    "id": "tokens",
    "kind": "usage",
    "meter_ids": ["meter"],
    "filter": {"conjunction": "and", "clauses": []},
    "aggregation": {"func": "sum", "property": "tokens"},
}
CONFIGURATION: Configuration = {"reducers": [TOKENS, credit_reducer("meter")]}
_ids = itertools.count(1)
CUSTOMER: ExternalCustomerID = {"external_customer_id": "alice"}
METER: ExternalCustomerMeterRequest = {**CUSTOMER, "meter_id": "meter"}
INITIAL: Snapshot = {
    **CUSTOMER,
    "customer_id": None,
    "customer_exists": True,
    "reducer_id": "tokens",
    "cold_until": BUCKET,
    "version": BUCKET + 1,
    "count": 0,
    "sum": 0,
    "min": None,
    "max": None,
}


def credits(
    units: int, *, meter_id: str = "meter", version: int = BUCKET + 1
) -> Snapshot:
    return {
        **INITIAL,
        "reducer_id": f"credits-{meter_id}",
        "cold_until": version,
        "version": version,
        "count": 1,
        "sum": units,
        "min": units,
        "max": units,
    }


CREDITS = credits(100)
WRITERS = ("writer-1", "writer-2", "writer-3", "writer-4")
CONCURRENT_CLIENTS = (*WRITERS, "reader-1", "reader-2")


def emit(
    at: float, client: str, units: int, *, timestamp: str = "2026-10-12T12:00:00Z"
) -> IngestStep:
    return IngestStep(
        at,
        client,
        {
            "events": [
                {
                    **CUSTOMER,
                    "name": "call",
                    "external_id": f"event-{next(_ids)}",
                    "timestamp": timestamp,
                    "metadata": {"tokens": units},
                }
            ]
        },
    )


# Polar ingested the events of these steps, as the snapshot that follows accounts for.
def confirm(at: float, client: str, *steps: IngestStep) -> ConfirmStep:
    events = [event for step in steps for event in step.arguments["events"]]
    return ConfirmStep(at, client, {"events": events})


# Polar stored the events of these steps: it confirms them to a client applying a snapshot.
def ingested(at: float, *steps: IngestStep) -> IngestedStep:
    events = [event for step in steps for event in step.arguments["events"]]
    return IngestedStep(at, {"events": events})


def sealed(version_offset: int, count: int, total: int) -> Snapshot:
    return {
        **INITIAL,
        "cold_until": BUCKET + BUCKET_SIZE,
        "version": BUCKET + BUCKET_SIZE + version_offset,
        "count": count,
        "sum": total,
        "min": 7 if count else None,
        "max": 7 if count else None,
    }


def expect(
    at: float, client: str, consumed: int, *, credited: int = 100, within: float = 2
) -> ReadStep:
    return ReadStep(
        at,
        client,
        METER,
        {
            "consumed_units": consumed,
            "credited_units": credited,
            "balance": credited - consumed,
        },
        within=within,
    )


SCENARIOS = [
    Scenario(
        "shared consumption and restart",
        CONFIGURATION,
        [INITIAL, CREDITS],
        [
            expect(0, "writer", 0),
            expect(0, "reader", 0),
            emit(0.2, "writer", 7),
            expect(0.3, "writer", 7, within=0),
            expect(0.3, "reader", 7),
            emit(0.5, "reader", 3),
            expect(0.6, "writer", 10),
            expect(0.6, "reader", 10, within=0),
            RestartStep(0.8, "reader"),
            expect(1.2, "reader", 10),
        ],
    ),
    Scenario(
        "concurrent writers",
        CONFIGURATION,
        [INITIAL, CREDITS],
        [
            *(expect(0, client, 0, within=0.4) for client in CONCURRENT_CLIENTS),
            *(
                step
                for round_index in range(5)
                for step in [
                    *(
                        emit(0.5 + round_index * 0.3, writer, units)
                        for units, writer in enumerate(WRITERS, start=1)
                    ),
                    *(
                        expect(
                            0.510 + round_index * 0.3,
                            client,
                            (round_index + 1) * 10,
                            within=0.2,
                        )
                        for client in CONCURRENT_CLIENTS
                    ),
                ]
            ),
            *(expect(2, client, 50, within=0) for client in CONCURRENT_CLIENTS),
        ],
    ),
    Scenario(
        "snapshot reconciliation",
        CONFIGURATION,
        [INITIAL, CREDITS],
        [
            expect(0, "writer", 0),
            expect(0, "reader", 0),
            seven := emit(0.2, "writer", 7),
            expect(0.3, "reader", 7),
            emit(0.4, "reader", 4, timestamp="2026-10-12T12:05:00Z"),
            confirm(0.45, "writer", seven),
            SnapshotStep(
                0.5,
                {
                    **INITIAL,
                    "cold_until": BUCKET + BUCKET_SIZE,
                    "version": BUCKET + BUCKET_SIZE + 1,
                    "count": 1,
                    "sum": 7,
                    "min": 7,
                    "max": 7,
                },
            ),
            expect(0.7, "writer", 11),
            expect(0.7, "reader", 11),
            # A late event in a cold bucket counts until Polar confirms it.
            emit(0.9, "writer", 7),
            expect(1, "writer", 18, within=0),
            expect(1, "reader", 18),
        ],
    ),
    Scenario(
        "server confirmation",
        CONFIGURATION,
        [INITIAL, CREDITS],
        [
            expect(0, "writer", 0),
            expect(0, "reader", 0),
            seven := emit(0.2, "writer", 7),
            expect(0.3, "reader", 7),
            # Polar stored the event: sealing the bucket settles it, counted once.
            ingested(0.4, seven),
            SnapshotStep(0.5, sealed(1, 1, 7)),
            expect(0.7, "writer", 7),
            expect(0.7, "reader", 7),
            # A late event Polar has not stored stays pending through a snapshot.
            late := emit(0.9, "writer", 7),
            expect(1, "writer", 14, within=0),
            SnapshotStep(1.1, sealed(2, 1, 7)),
            expect(1.3, "writer", 14),
            expect(1.3, "reader", 14),
            # Stored at last, it leaves pending as the snapshot counting it applies.
            ingested(1.4, late),
            SnapshotStep(1.5, sealed(3, 2, 14)),
            expect(1.7, "writer", 14),
            expect(1.7, "reader", 14),
        ],
    ),
    Scenario(
        "independent reducer snapshots and weighted average",
        {
            "reducers": [
                {**TOKENS, "meter_ids": ["meter", "shared"]},
                {
                    "id": "average",
                    "kind": "usage",
                    "meter_ids": ["average-meter"],
                    "filter": {"conjunction": "and", "clauses": []},
                    "aggregation": {"func": "avg", "property": "tokens"},
                },
                credit_reducer("meter"),
                credit_reducer("shared"),
                credit_reducer("average-meter"),
            ]
        },
        [
            {**INITIAL, "count": 2, "sum": 20, "min": 5, "max": 15},
            {
                **INITIAL,
                "reducer_id": "average",
                "count": 2,
                "sum": 20,
                "min": 5,
                "max": 15,
            },
            CREDITS,
            credits(200, meter_id="shared"),
            credits(150, meter_id="average-meter"),
        ],
        [
            expect(0, "writer", 20),
            expect(0, "reader", 20),
            ReadStep(
                0,
                "reader",
                {**CUSTOMER, "meter_id": "shared"},
                {"consumed_units": 20, "credited_units": 200, "balance": 180},
            ),
            ReadStep(
                0,
                "reader",
                {**CUSTOMER, "meter_id": "average-meter"},
                {"consumed_units": 10, "credited_units": 150, "balance": 140},
            ),
            two := emit(0.2, "writer", 2),
            eight := emit(0.2, "reader", 8),
            expect(0.3, "reader", 30),
            ReadStep(
                0.3,
                "reader",
                {**CUSTOMER, "meter_id": "average-meter"},
                {"consumed_units": 7.5},
            ),
            emit(0.4, "writer", 4, timestamp="2026-10-12T12:05:00Z"),
            confirm(0.45, "writer", two, eight),
            SnapshotStep(
                0.5,
                {
                    **INITIAL,
                    "cold_until": BUCKET + BUCKET_SIZE,
                    "version": BUCKET + 2 * BUCKET_SIZE + 2,
                    "count": 4,
                    "sum": 30,
                    "min": 2,
                    "max": 15,
                },
            ),
            expect(0.7, "reader", 34),
            ReadStep(
                0.7,
                "reader",
                {**CUSTOMER, "meter_id": "shared"},
                {"consumed_units": 34, "credited_units": 200},
            ),
            ReadStep(
                0.7,
                "reader",
                {**CUSTOMER, "meter_id": "average-meter"},
                {"consumed_units": 6.8},
            ),
            SnapshotStep(
                0.8,
                {
                    **INITIAL,
                    "cold_until": BUCKET + BUCKET_SIZE,
                    "version": BUCKET + 2 * BUCKET_SIZE + 1,
                    "count": 4,
                    "sum": 999,
                },
            ),
            expect(0.9, "reader", 34),
            SnapshotStep(
                1,
                {
                    **INITIAL,
                    "cold_until": BUCKET + BUCKET_SIZE,
                    "version": BUCKET + 2 * BUCKET_SIZE + 3,
                    "count": 6,
                    "sum": 40,
                    "min": 2,
                    "max": 15,
                },
            ),
            expect(1.2, "reader", 44),
            ReadStep(
                1.2,
                "reader",
                {**CUSTOMER, "meter_id": "average-meter"},
                {"consumed_units": 6.8},
            ),
            RestartStep(1.3, "reader"),
            expect(1.6, "reader", 44),
        ],
    ),
    Scenario(
        "cold read waits for the first snapshot",
        CONFIGURATION,
        [{**INITIAL, "count": 1, "sum": 5, "min": 5, "max": 5}, CREDITS],
        [expect(0, "reader", 5, within=0)],
    ),
    Scenario(
        "unknown customer reads none",
        CONFIGURATION,
        [INITIAL, CREDITS],
        [
            ReadStep(
                0,
                "reader",
                {"external_customer_id": "bob", "meter_id": "meter"},
                None,
            )
        ],
    ),
    Scenario(
        "reconnect after Polar drops the connection",
        CONFIGURATION,
        [INITIAL, CREDITS],
        [
            expect(0, "writer", 0),
            expect(0, "reader", 0),
            seven := emit(0.2, "writer", 7),
            DisconnectStep(0.4),
            three := emit(0.5, "reader", 3),
            expect(0.6, "writer", 10),
            confirm(1.4, "writer", seven, three),
            SnapshotStep(
                1.5,
                {
                    **INITIAL,
                    "cold_until": BUCKET + BUCKET_SIZE,
                    "version": BUCKET + BUCKET_SIZE + 1,
                    "count": 3,
                    "sum": 12,
                    "min": 2,
                    "max": 7,
                },
            ),
            expect(1.6, "writer", 12),
            expect(1.6, "reader", 12),
        ],
    ),
    Scenario(
        "redis outage fails fast then recovers",
        CONFIGURATION,
        [INITIAL, CREDITS],
        [
            expect(0, "writer", 0),
            expect(0, "reader", 0),
            emit(0.2, "writer", 5),
            expect(0.3, "reader", 5),
            RedisStep(0.5, available=False),
            ReadStep(
                0.7,
                "reader",
                {"external_customer_id": "bob", "meter_id": "meter"},
                None,
                failure=Failure("Redis is unavailable", within=0.5),
            ),
            IngestStep(
                0.7,
                "writer",
                {
                    "events": [
                        {
                            **CUSTOMER,
                            "name": "call",
                            "external_id": "redis-outage",
                            "metadata": {"tokens": 1},
                        }
                    ]
                },
                failure=Failure("Redis is unavailable", within=0.5),
            ),
            RedisStep(1, available=True),
            expect(1.2, "reader", 5, within=3),
            expect(1.2, "writer", 5, within=3),
        ],
    ),
    Scenario(
        "credit snapshot alone updates every client",
        CONFIGURATION,
        [INITIAL, CREDITS],
        [
            expect(0, "writer", 0),
            expect(0, "reader-1", 0),
            expect(0, "reader-2", 0),
            emit(0.2, "writer", 7),
            expect(0.3, "reader-1", 7),
            expect(0.3, "reader-2", 7),
            SnapshotStep(0.5, credits(150, version=BUCKET + 2)),
            expect(0.6, "writer", 7, credited=150),
            expect(0.6, "reader-1", 7, credited=150),
            expect(0.6, "reader-2", 7, credited=150),
        ],
    ),
    Scenario(
        "stale credit snapshot is ignored",
        CONFIGURATION,
        [INITIAL, CREDITS],
        [
            expect(0, "writer", 0),
            expect(0, "reader", 0),
            SnapshotStep(0.2, credits(150, version=BUCKET + 3)),
            expect(0.3, "writer", 0, credited=150),
            expect(0.3, "reader", 0, credited=150),
            SnapshotStep(0.5, credits(999, version=BUCKET + 2)),
            expect(0.8, "writer", 0, credited=150, within=0),
            expect(0.8, "reader", 0, credited=150, within=0),
        ],
    ),
]
