"""add text_pattern_ops indexes for external_id

Revision ID: 26cae817076b
Revises: 827dddaa615a
Create Date: 2025-12-11 15:04:51.599479

"""

from alembic import op

# Polar Custom Imports

# revision identifiers, used by Alembic.
revision = "26cae817076b"
down_revision = "827dddaa615a"
branch_labels: tuple[str] | None = None
depends_on: tuple[str] | None = None


def upgrade() -> None:
    with op.get_context().autocommit_block():
        op.create_index(
            "ix_customers_external_id_pattern",
            "customers",
            ["external_id"],
            unique=False,
            postgresql_ops={"external_id": "text_pattern_ops"},
            postgresql_concurrently=True,
        )
        op.create_index(
            "ix_events_external_customer_id_pattern",
            "events",
            ["external_customer_id"],
            unique=False,
            postgresql_ops={"external_customer_id": "text_pattern_ops"},
            postgresql_concurrently=True,
        )


def downgrade() -> None:
    with op.get_context().autocommit_block():
        op.drop_index(
            "ix_events_external_customer_id_pattern",
            table_name="events",
            postgresql_concurrently=True,
        )
        op.drop_index(
            "ix_customers_external_id_pattern",
            table_name="customers",
            postgresql_concurrently=True,
        )
