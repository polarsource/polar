"""Add checkouts.subscription_id index

Revision ID: a1e05225c056
Revises: b13c8489dbea
Create Date: 2026-05-20 08:53:55.799664

"""

from alembic import op

# Polar Custom Imports

# revision identifiers, used by Alembic.
revision = "a1e05225c056"
down_revision = "b13c8489dbea"
branch_labels: tuple[str] | None = None
depends_on: tuple[str] | None = None


def upgrade() -> None:
    with op.get_context().autocommit_block():
        op.create_index(
            op.f("ix_checkouts_subscription_id"),
            "checkouts",
            ["subscription_id"],
            unique=False,
            postgresql_concurrently=True,
        )


def downgrade() -> None:
    with op.get_context().autocommit_block():
        op.drop_index(
            op.f("ix_checkouts_subscription_id"),
            table_name="checkouts",
            postgresql_concurrently=True,
        )
