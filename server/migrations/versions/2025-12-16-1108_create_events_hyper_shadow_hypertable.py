"""create_events_hyper_shadow_hypertable

Revision ID: 03f24e6aa030
Revises: b3e39dadb512
Create Date: 2025-12-15 11:00:03.649717

"""

import sqlalchemy as sa
from alembic import op

# Polar Custom Imports

# revision identifiers, used by Alembic.
revision = "03f24e6aa030"
down_revision = "b3e39dadb512"
branch_labels: tuple[str] | None = None
depends_on: tuple[str] | None = None


def upgrade() -> None:
    # Create shadow table with same structure (no FKs to events)
    op.execute("""
        CREATE TABLE events_hyper (
            id UUID NOT NULL,
            ingested_at TIMESTAMP WITH TIME ZONE NOT NULL,
            timestamp TIMESTAMP WITH TIME ZONE NOT NULL,
            name VARCHAR(128) NOT NULL,
            source VARCHAR NOT NULL,
            customer_id UUID REFERENCES customers(id),
            external_customer_id VARCHAR,
            external_id VARCHAR,
            parent_id UUID,
            root_id UUID,
            organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
            event_type_id UUID REFERENCES event_types(id),
            user_metadata JSONB NOT NULL,
            PRIMARY KEY (id, ingested_at)
        )
    """)

    # Convert to hypertable with 1-week chunks
    op.execute("""
        SELECT create_hypertable(
            'events_hyper',
            'ingested_at',
            chunk_time_interval => INTERVAL '1 week'
        )
    """)

    # Create partial unique index (must include partitioning column for TimescaleDB)
    op.execute("""
        CREATE UNIQUE INDEX ix_events_hyper_external_id
        ON events_hyper (external_id, ingested_at)
        WHERE external_id IS NOT NULL
    """)

    # Create single-column indexes matching original table
    op.execute("CREATE INDEX ix_events_hyper_id ON events_hyper (id)")
    op.execute("CREATE INDEX ix_events_hyper_timestamp ON events_hyper (timestamp)")
    op.execute("CREATE INDEX ix_events_hyper_name ON events_hyper (name)")
    op.execute("CREATE INDEX ix_events_hyper_source ON events_hyper (source)")
    op.execute("CREATE INDEX ix_events_hyper_customer_id ON events_hyper (customer_id)")
    op.execute(
        "CREATE INDEX ix_events_hyper_external_customer_id ON events_hyper (external_customer_id)"
    )
    op.execute("CREATE INDEX ix_events_hyper_parent_id ON events_hyper (parent_id)")
    op.execute("CREATE INDEX ix_events_hyper_root_id ON events_hyper (root_id)")
    op.execute(
        "CREATE INDEX ix_events_hyper_organization_id ON events_hyper (organization_id)"
    )
    op.execute(
        "CREATE INDEX ix_events_hyper_event_type_id ON events_hyper (event_type_id)"
    )

    # Create composite indexes
    op.execute("""
        CREATE INDEX ix_events_hyper_org_timestamp_id
        ON events_hyper (organization_id, timestamp DESC, id);
    """)

    op.execute("""
        CREATE INDEX ix_events_hyper_org_external_id_ingested
        ON events_hyper (organization_id, external_customer_id, ingested_at DESC);
    """)

    op.execute("""
        CREATE INDEX ix_events_hyper_org_customer_id_ingested
        ON events_hyper (organization_id, customer_id, ingested_at DESC);
    """)

    op.execute("""
        CREATE INDEX ix_events_hyper_external_customer_pattern
        ON events_hyper USING btree (external_customer_id text_pattern_ops);
    """)


def downgrade() -> None:
    op.execute("DROP TABLE IF EXISTS events_hyper CASCADE")
