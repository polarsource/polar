"""add meter_events table

Revision ID: 081d3553f2ed
Revises: 24bb42b493d7
Create Date: 2026-01-07 10:42:17.345848

"""

import sqlalchemy as sa
from alembic import op

# Polar Custom Imports

# revision identifiers, used by Alembic.
revision = "081d3553f2ed"
down_revision = "24bb42b493d7"
branch_labels: tuple[str] | None = None
depends_on: tuple[str] | None = None


def upgrade() -> None:
    op.create_table(
        "meter_events",
        sa.Column("meter_id", sa.Uuid(), nullable=False),
        sa.Column("event_id", sa.Uuid(), nullable=False),
        sa.Column("customer_id", sa.Uuid(), nullable=True),
        sa.Column("external_customer_id", sa.String(), nullable=True),
        sa.Column("organization_id", sa.Uuid(), nullable=False),
        sa.Column("ingested_at", sa.TIMESTAMP(timezone=True), nullable=False),
        sa.Column("timestamp", sa.TIMESTAMP(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(
            ["customer_id"],
            ["customers.id"],
            name=op.f("meter_events_customer_id_fkey"),
            ondelete="set null",
        ),
        sa.ForeignKeyConstraint(
            ["event_id"],
            ["events.id"],
            name=op.f("meter_events_event_id_fkey"),
            ondelete="cascade",
        ),
        sa.ForeignKeyConstraint(
            ["meter_id"],
            ["meters.id"],
            name=op.f("meter_events_meter_id_fkey"),
            ondelete="cascade",
        ),
        sa.ForeignKeyConstraint(
            ["organization_id"],
            ["organizations.id"],
            name=op.f("meter_events_organization_id_fkey"),
            ondelete="cascade",
        ),
        sa.PrimaryKeyConstraint("meter_id", "event_id", name=op.f("meter_events_pkey")),
    )

    with op.get_context().autocommit_block():
        op.create_index(
            "ix_meter_events_meter_customer_ingested",
            "meter_events",
            ["meter_id", "customer_id", "ingested_at"],
            unique=False,
            postgresql_concurrently=True,
        )
        op.create_index(
            "ix_meter_events_meter_external_customer_ingested",
            "meter_events",
            ["meter_id", "external_customer_id", "ingested_at"],
            unique=False,
            postgresql_concurrently=True,
        )
        op.create_index(
            "ix_meter_events_meter_ingested",
            "meter_events",
            ["meter_id", "ingested_at", "event_id"],
            unique=False,
            postgresql_concurrently=True,
        )


def downgrade() -> None:
    op.drop_index(
        "ix_meter_events_meter_ingested",
        table_name="meter_events",
    )
    op.drop_index(
        "ix_meter_events_meter_external_customer_ingested",
        table_name="meter_events",
    )
    op.drop_index(
        "ix_meter_events_meter_customer_ingested",
        table_name="meter_events",
    )
    op.drop_table("meter_events")
