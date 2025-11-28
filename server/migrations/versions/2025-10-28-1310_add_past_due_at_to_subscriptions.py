"""add past_due_at to subscriptions

Revision ID: 1ac3957fd2cf
Revises: df6c0fa5e0e9
Create Date: 2025-10-28 13:10:51.719363

"""

import sqlalchemy as sa
from alembic import op

revision = "1ac3957fd2cf"
down_revision = "df6c0fa5e0e9"
branch_labels: tuple[str] | None = None
depends_on: tuple[str] | None = None


def upgrade() -> None:
    op.add_column(
        "subscriptions",
        sa.Column("past_due_at", sa.TIMESTAMP(timezone=True), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("subscriptions", "past_due_at")
