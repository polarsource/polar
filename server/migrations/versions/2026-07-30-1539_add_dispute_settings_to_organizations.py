"""add dispute_settings to organizations

Revision ID: 98f971463e5d
Revises: 72c8a2d0ea56
Create Date: 2026-07-30 15:39:20.081950

"""

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

# Polar Custom Imports

# revision identifiers, used by Alembic.
revision = "98f971463e5d"
down_revision = "72c8a2d0ea56"
branch_labels: tuple[str] | None = None
depends_on: tuple[str] | None = None


def upgrade() -> None:
    # Ensures we don't break app by applying a deadlock-inducing migration
    # `organizations` is a busy table: allow longer to acquire the lock.
    op.execute("SET LOCAL lock_timeout = '30s'")
    op.add_column(
        "organizations",
        sa.Column(
            "dispute_settings", postgresql.JSONB(astext_type=sa.Text()), nullable=True
        ),
    )


def downgrade() -> None:
    # Ensures we don't break app by applying a deadlock-inducing migration
    # `organizations` is a busy table: allow longer to acquire the lock.
    op.execute("SET LOCAL lock_timeout = '30s'")
    op.drop_column("organizations", "dispute_settings")
