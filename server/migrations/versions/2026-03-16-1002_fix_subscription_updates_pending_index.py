"""Fix subscription_updates pending index to exclude soft-deleted rows

Revision ID: a1b2c3d4e5f6
Revises: 147643549822
Create Date: 2026-03-16 10:02:30.000000

"""

from alembic import op

# Polar Custom Imports

# revision identifiers, used by Alembic.
revision = "a1b2c3d4e5f6"
down_revision = "147643549822"
branch_labels: tuple[str] | None = None
depends_on: tuple[str] | None = None


def upgrade() -> None:
    with op.get_context().autocommit_block():
        op.drop_index(
            "ix_subscription_updates_subscription_id_pending",
            table_name="subscription_updates",
            postgresql_concurrently=True,
            postgresql_where="applied_at IS NULL",
        )
        op.create_index(
            "ix_subscription_updates_subscription_id_pending",
            "subscription_updates",
            ["subscription_id"],
            unique=True,
            postgresql_concurrently=True,
            postgresql_where="applied_at IS NULL AND deleted_at IS NULL",
        )


def downgrade() -> None:
    with op.get_context().autocommit_block():
        op.drop_index(
            "ix_subscription_updates_subscription_id_pending",
            table_name="subscription_updates",
            postgresql_concurrently=True,
            postgresql_where="applied_at IS NULL AND deleted_at IS NULL",
        )
        op.create_index(
            "ix_subscription_updates_subscription_id_pending",
            "subscription_updates",
            ["subscription_id"],
            unique=True,
            postgresql_concurrently=True,
            postgresql_where="applied_at IS NULL",
        )
