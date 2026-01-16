"""Add composite partial indexes for events table

Revision ID: 4b8c9d0e1f2a
Revises: 3a7b8c9d0e1f
Create Date: 2026-01-16

"""

import sqlalchemy as sa
from alembic import op

# Polar Custom Imports

# revision identifiers, used by Alembic.
revision = "4b8c9d0e1f2a"
down_revision = "3a7b8c9d0e1f"
branch_labels: tuple[str] | None = None
depends_on: tuple[str] | None = None


def upgrade() -> None:
    with op.get_context().autocommit_block():
        op.create_index(
            "ix_events_org_source_name_external_customer_id_ingested_at",
            "events",
            [
                "organization_id",
                "source",
                "name",
                "external_customer_id",
                sa.literal_column("ingested_at DESC"),
            ],
            unique=False,
            postgresql_where="external_customer_id IS NOT NULL",
            postgresql_concurrently=True,
        )
        op.create_index(
            "ix_events_org_source_name_customer_id_ingested_at",
            "events",
            [
                "organization_id",
                "source",
                "name",
                "customer_id",
                sa.literal_column("ingested_at DESC"),
            ],
            unique=False,
            postgresql_where="customer_id IS NOT NULL",
            postgresql_concurrently=True,
        )


def downgrade() -> None:
    with op.get_context().autocommit_block():
        op.drop_index(
            "ix_events_org_source_name_customer_id_ingested_at",
            table_name="events",
            postgresql_concurrently=True,
        )
        op.drop_index(
            "ix_events_org_source_name_external_customer_id_ingested_at",
            table_name="events",
            postgresql_concurrently=True,
        )
