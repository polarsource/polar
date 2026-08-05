"""drop unused billing entry indexes

Revision ID: 71ec0612f44f
Revises: 5a1b80eeae48
Create Date: 2026-08-03 15:45:19.881549

"""

from alembic import op

# Polar Custom Imports

# revision identifiers, used by Alembic.
revision = "71ec0612f44f"
down_revision = "5a1b80eeae48"
branch_labels: tuple[str] | None = None
depends_on: tuple[str] | None = None

INDEXES = {
    "ix_billing_entry_deleted_at": ["deleted_at"],
    "ix_billing_entry_subscription_id": ["subscription_id"],
    "ix_billing_entry_type": ["type"],
    "ix_billing_entry_end_timestamp": ["end_timestamp"],
}


def upgrade() -> None:
    with op.get_context().autocommit_block():
        for index_name in INDEXES:
            op.drop_index(
                index_name,
                table_name="billing_entry",
                if_exists=True,
                postgresql_concurrently=True,
            )


def downgrade() -> None:
    with op.get_context().autocommit_block():
        for index_name, columns in INDEXES.items():
            op.drop_index(
                index_name,
                table_name="billing_entry",
                if_exists=True,
                postgresql_concurrently=True,
            )
            op.create_index(
                index_name,
                "billing_entry",
                columns,
                unique=False,
                postgresql_concurrently=True,
            )
