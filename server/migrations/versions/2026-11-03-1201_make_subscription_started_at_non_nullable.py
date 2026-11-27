"""make subscription started_at non-nullable

Revision ID: 3b83f6b7a95c
Revises: 0f781c42ed87
"""

import sqlalchemy as sa
from alembic import op

revision = "3b83f6b7a95c"
down_revision = "0f781c42ed87"
branch_labels: tuple[str] | None = None
depends_on: tuple[str] | None = None


def upgrade() -> None:
    # Fewer than 20 rows in production have a null started_at, so this is safe without a separate backfill.
    op.execute(
        "UPDATE subscriptions SET started_at = created_at WHERE started_at IS NULL"
    )
    op.alter_column(
        "subscriptions",
        "started_at",
        existing_type=sa.TIMESTAMP(timezone=True),
        nullable=False,
    )


def downgrade() -> None:
    op.alter_column(
        "subscriptions",
        "started_at",
        existing_type=sa.TIMESTAMP(timezone=True),
        nullable=True,
    )
