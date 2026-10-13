from polar.outpost.client import Configuration, Snapshot

from harness import (
    ExternalCustomerID,
    ExternalCustomerMeterRequest,
    IngestStep,
    ReadStep,
    RestartStep,
    Scenario,
    SnapshotStep,
)

BUCKET = 1791806400
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
    "cold_until": BUCKET,
    "cold": {"tokens": 0},
    "credited": {"meter": 100},
}


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
            expect(0, "writer", 0),
            expect(0, "reader", 0),
            emit(0.2, "writer", 7),
            emit(0.2, "reader", 3),
            expect(0.4, "writer", 10),
            expect(0.4, "reader", 10),
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
                    "cold_until": BUCKET + 300,
                    "cold": {"tokens": 7},
                },
            ),
            expect(0.7, "writer", 11),
            expect(0.7, "reader", 11),
            emit(0.9, "writer", 7),
            expect(1, "writer", 11, within=0),
            expect(1, "reader", 11),
        ],
    ),
]
