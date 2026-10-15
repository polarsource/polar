"""Add reducer bucket billed_at and order_id

Revision ID: 836d98c9c876
Revises: 7df5de861459
Create Date: 2026-10-15 14:18:09.273104

"""

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision = "836d98c9c876"
down_revision = "7df5de861459"
branch_labels: tuple[str] | None = None
depends_on: tuple[str] | None = None


def upgrade() -> None:
    # Ensures we don't break app by applying a deadlock-inducing migration.
    op.execute("SET LOCAL lock_timeout = '5s'")
    op.add_column(
        "reducer_buckets",
        sa.Column("billed_at", sa.TIMESTAMP(timezone=True), nullable=True),
    )
    op.add_column("reducer_buckets", sa.Column("order_id", sa.Uuid(), nullable=True))
    op.create_foreign_key(
        op.f("reducer_buckets_order_id_fkey"),
        "reducer_buckets",
        "orders",
        ["order_id"],
        ["id"],
    )


def downgrade() -> None:
    # Ensures we don't break app by applying a deadlock-inducing migration.
    op.execute("SET LOCAL lock_timeout = '5s'")
    op.drop_constraint(
        op.f("reducer_buckets_order_id_fkey"), "reducer_buckets", type_="foreignkey"
    )
    op.drop_column("reducer_buckets", "order_id")
    op.drop_column("reducer_buckets", "billed_at")
