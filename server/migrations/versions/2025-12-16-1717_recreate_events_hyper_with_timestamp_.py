"""recreate_events_hyper_with_timestamp_partition

Revision ID: 27c616f714dd
Revises: 974ff0719c1d
Create Date: 2025-12-16 17:17:31.979737

"""

import sqlalchemy as sa
from alembic import op

# Polar Custom Imports

# revision identifiers, used by Alembic.
revision = "27c616f714dd"
down_revision = "974ff0719c1d"
branch_labels: tuple[str] | None = None
depends_on: tuple[str] | None = None


def upgrade() -> None:
    # Drop existing hypertable (partitioned by ingested_at)
    op.execute("DROP TABLE IF EXISTS events_hyper CASCADE")

    # Recreate with timestamp as the partition column for efficient chunk exclusion
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
            PRIMARY KEY (id, timestamp)
        )
    """)

    # Convert to hypertable partitioned by timestamp (not ingested_at)
    op.execute("""
        SELECT create_hypertable(
            'events_hyper',
            'timestamp',
            chunk_time_interval => INTERVAL '1 week'
        )
    """)

    op.execute("""
        CREATE UNIQUE INDEX ix_events_hyper_external_id
        ON events_hyper (external_id, timestamp)
        WHERE external_id IS NOT NULL
    """)

    # Single-column indexes
    op.execute("CREATE INDEX ix_events_hyper_id ON events_hyper (id)")
    op.execute("CREATE INDEX ix_events_hyper_ingested_at ON events_hyper (ingested_at)")
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

    op.execute("""
        CREATE INDEX ix_events_hyper_org_timestamp_id
        ON events_hyper (organization_id, timestamp DESC, id)
    """)

    op.execute("""
        CREATE INDEX ix_events_hyper_org_customer_timestamp
        ON events_hyper (organization_id, customer_id, timestamp DESC)
    """)

    op.execute("""
        CREATE INDEX ix_events_hyper_org_external_customer_timestamp
        ON events_hyper (organization_id, external_customer_id, timestamp DESC)
    """)

    op.execute("""
        CREATE INDEX ix_events_hyper_external_customer_pattern
        ON events_hyper USING btree (external_customer_id text_pattern_ops)
    """)


def downgrade() -> None:
    # Drop and recreate with original ingested_at partition (for rollback)
    op.execute("DROP TABLE IF EXISTS events_hyper CASCADE")

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

    op.execute("""
        SELECT create_hypertable(
            'events_hyper',
            'ingested_at',
            chunk_time_interval => INTERVAL '1 week'
        )
    """)
