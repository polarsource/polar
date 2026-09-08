"""Add order item period timestamps

Revision ID: 80df375e5679
Revises: fec1e6242c3f
Create Date: 2026-09-08 09:43:45.550891

"""

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision = "80df375e5679"
down_revision = "fec1e6242c3f"
branch_labels: tuple[str] | None = None
depends_on: tuple[str] | None = None


def upgrade() -> None:
    # Ensures we don't break app by applying a deadlock-inducing migration
    op.execute("SET LOCAL lock_timeout = '5s'")
    op.add_column(
        "order_items",
        sa.Column("start_timestamp", sa.TIMESTAMP(timezone=True), nullable=True),
    )
    op.add_column(
        "order_items",
        sa.Column("end_timestamp", sa.TIMESTAMP(timezone=True), nullable=True),
    )


def downgrade() -> None:
    # Ensures we don't break app by applying a deadlock-inducing migration
    op.execute("SET LOCAL lock_timeout = '5s'")
    op.drop_column("order_items", "end_timestamp")
    op.drop_column("order_items", "start_timestamp")
