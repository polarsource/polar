"""Add organizations.review_category

Revision ID: 7c1f3b9e2d4a
Revises: e99cc2a4a4ab
Create Date: 2026-10-01 12:00:00.000000

"""

import sqlalchemy as sa
from alembic import op

# Polar Custom Imports

# revision identifiers, used by Alembic.
revision = "7c1f3b9e2d4a"
down_revision = "e99cc2a4a4ab"
branch_labels: tuple[str] | None = None
depends_on: tuple[str] | None = None


def upgrade() -> None:
    # Ensures we don't break app by applying a deadlock-inducing migration.
    # CREATE INDEX CONCURRENTLY needs its own, far larger timeout -- see ADR-0006.
    op.execute("SET LOCAL lock_timeout = '5s'")
    op.add_column(
        "organizations",
        sa.Column(
            "review_category",
            sa.String(),
            nullable=False,
            server_default="standard",
        ),
    )


def downgrade() -> None:
    # Ensures we don't break app by applying a deadlock-inducing migration.
    # CREATE INDEX CONCURRENTLY needs its own, far larger timeout -- see ADR-0006.
    op.execute("SET LOCAL lock_timeout = '5s'")
    op.drop_column("organizations", "review_category")
