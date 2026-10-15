from polar.outpost.client import Configuration, Snapshot
from polar.outpost.reducer import BUCKET_SIZE

from harness import (
    ExternalCustomerID,
    ExternalCustomerMeterRequest,
    IngestStep,
    ReadStep,
    RestartStep,
    Scenario,
    SnapshotStep,
)

BUCKET = 1791806400000000
CONFIGURATION: Configuration = {
    "reducers": [
        {
            "id": "tokens",
            "meter_ids": ["meter"],
            "filter": {"conjunction": "and", "clauses": []},
            "aggregation": {"func": "sum", "property": "tokens"},
        }
    ],
}
CUSTOMER: ExternalCustomerID = {"external_customer_id": "alice"}
METER: ExternalCustomerMeterRequest = {**CUSTOMER, "meter_id": "meter"}
INITIAL: Snapshot = {
    **CUSTOMER,
    "customer_id": None,
    "meter_id": "meter",
    "cold_until": BUCKET,
    "version": BUCKET + 1,
    "count": 0,
    "sum": 0,
    "min": None,
    "max": None,
    "credited_units": 100,
}
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
                    "timestamp": timestamp,
                    "metadata": {"tokens": units},
                }
            ]
        },
    )


def expect(at: float, client: str, consumed: int, *, within: float = 2) -> ReadStep:
    return ReadStep(
        at,
        client,
        METER,
        {
            "consumed_units": consumed,
            "credited_units": 100,
            "balance": 100 - consumed,
        },
        within=within,
    )


SCENARIOS = [
    Scenario(
        "shared consumption and restart",
        CONFIGURATION,
        [INITIAL],
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
        [INITIAL],
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
                            within=0,
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
        [INITIAL],
        [
            expect(0, "writer", 0),
            expect(0, "reader", 0),
            emit(0.2, "writer", 7),
            expect(0.3, "reader", 7),
            emit(0.4, "reader", 4, timestamp="2026-10-12T12:05:00Z"),
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
            emit(0.9, "writer", 7),
            expect(1, "writer", 11, within=0),
            expect(1, "reader", 11),
        ],
    ),
    Scenario(
        "independent reducer snapshots and weighted average",
        {
            "reducers": [
                {**CONFIGURATION["reducers"][0], "meter_ids": ["meter", "shared"]},
                {
                    "id": "average",
                    "meter_ids": ["average-meter"],
                    "filter": {"conjunction": "and", "clauses": []},
                    "aggregation": {"func": "avg", "property": "tokens"},
                },
            ]
        },
        [
            {**INITIAL, "count": 2, "sum": 20, "min": 5, "max": 15},
            {
                **INITIAL,
                "meter_id": "shared",
                "count": 2,
                "sum": 20,
                "min": 5,
                "max": 15,
                "credited_units": 200,
            },
            {
                **INITIAL,
                "meter_id": "average-meter",
                "count": 2,
                "sum": 20,
                "min": 5,
                "max": 15,
                "credited_units": 150,
            },
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
            emit(0.2, "writer", 2),
            emit(0.2, "reader", 8),
            expect(0.3, "reader", 30),
            ReadStep(
                0.3,
                "reader",
                {**CUSTOMER, "meter_id": "average-meter"},
                {"consumed_units": 7.5},
            ),
            emit(0.4, "writer", 4, timestamp="2026-10-12T12:05:00Z"),
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
]
